require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const redis = require("redis");
const promClient = require("prom-client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const register = new promClient.Registry();
const jwtSecret = process.env.JWT_SECRET || "greenops-dev-secret";

promClient.collectDefaultMetrics({ register });

const httpRequests = new promClient.Counter({
  name: "greenops_auth_http_requests_total",
  help: "Total HTTP requests handled by auth-service",
  labelNames: ["method", "route", "status"],
});
register.registerMetric(httpRequests);

const pool = new Pool({
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || "postgres",
  port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || 5432),
  database: process.env.DB_NAME || process.env.POSTGRES_DB,
  user: process.env.DB_USER || process.env.POSTGRES_USER,
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
});

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://redis:6379",
});
const adminPasswordHash =
  "$2b$10$6wrRSnsPrj2azJW1ChQnKeDyM19OOmQLV.ENKhkteR/5OcMJwQa6u";

redisClient.on("error", (error) => {
  console.error("Redis error", error.message);
});
redisClient.connect().catch((error) => {
  console.error("Redis connection failed", error.message);
});

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.on("finish", () => {
    httpRequests.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    });
  });
  next();
});

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(
    `
      INSERT INTO users (username, email, password, role)
      VALUES ('admin', 'admin@greenops.local', $1, 'admin')
      ON CONFLICT (email) DO NOTHING
    `,
    [adminPasswordHash]
  );
}

const schemaReady = ensureSchema();
schemaReady.catch((error) => {
  console.error("Auth schema initialization failed", error.message);
});

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.created_at,
  };
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token manquant" });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch (error) {
    return res.status(403).json({ message: "Token invalide" });
  }
}

function authorizeRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ message: "Acces interdit" });
    }
    return next();
  };
}

async function registerUser(req, res) {
  await schemaReady;
  const { username, email, password } = req.body;

  if (!username || !email || !password || password.length < 8) {
    return res.status(400).json({
      message: "username, email et password de 8 caracteres minimum sont requis",
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `
      INSERT INTO users (username, email, password, role)
      VALUES ($1, $2, $3, 'user')
      RETURNING id, username, email, role, created_at
    `,
    [username, email.toLowerCase(), hashedPassword]
  );

  await redisClient.del("users").catch(() => undefined);

  return res.status(201).json({
    message: "Utilisateur cree",
    user: publicUser(result.rows[0]),
  });
}

async function loginUser(req, res) {
  await schemaReady;
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "email et password sont requis" });
  }

  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email.toLowerCase(),
  ]);
  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ message: "Identifiants invalides" });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ message: "Identifiants invalides" });
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
  );

  return res.json({
    message: "Connexion reussie",
    token,
    user: publicUser(user),
  });
}

app.get("/health", (req, res) => {
  res.json({ service: "auth-service", status: "UP" });
});

app.get(
  "/ready",
  asyncHandler(async (req, res) => {
    await schemaReady;
    await pool.query("SELECT 1");
    await redisClient.ping();
    res.json({ service: "auth-service", ready: true });
  })
);

app.get(
  "/metrics",
  asyncHandler(async (req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  })
);

app.post("/auth/register", asyncHandler(registerUser));
app.post("/auth/login", asyncHandler(loginUser));

app.get("/auth/profile", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

app.get(
  "/auth/admin/users",
  authenticateToken,
  authorizeRole("admin"),
  asyncHandler(async (req, res) => {
    await schemaReady;
    const cachedUsers = await redisClient.get("users").catch(() => null);

    if (cachedUsers) {
      return res.json({ source: "redis", users: JSON.parse(cachedUsers) });
    }

    const result = await pool.query(
      "SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC"
    );

    await redisClient
      .setEx("users", 60, JSON.stringify(result.rows.map(publicUser)))
      .catch(() => undefined);

    return res.json({ source: "postgres", users: result.rows.map(publicUser) });
  })
);

app.post("/api/register", asyncHandler(registerUser));
app.post("/api/login", asyncHandler(loginUser));
app.get("/api/profile", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: error.message });
});

const PORT = Number(process.env.AUTH_SERVICE_PORT || process.env.PORT || 3001);

app.listen(PORT, () => {
  console.log(`Auth service running on ${PORT}`);
});
