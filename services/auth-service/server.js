require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const redis = require("redis");
const client = require("prom-client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
});

const redisClient = redis.createClient({
  url: "redis://redis:6379",
});

redisClient.connect();

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: "postgres",
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Token manquant",
    });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET,
    (err, user) => {
      if (err) {
        return res.status(403).json({
          message: "Token invalide",
        });
      }

      req.user = user;
      next();
    }
  );
}
function authorizeRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({
        message: "Accès interdit",
      });
    }

    next();
  };
}
        
app.get("/api", async (req, res) => {
  try {
    const cachedUsers =
      await redisClient.get("users");

    if (cachedUsers) {
      return res.json({
        source: "redis-cache",
        users: JSON.parse(cachedUsers),
      });
    }

    const result = await pool.query(
      "SELECT id, username, email, role FROM users"
    );

    await redisClient.set(
      "users",
      JSON.stringify(result.rows)
    );

    res.json({
      source: "postgres",
      users: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } =
      req.body;

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users
      (username,email,password)
      VALUES ($1,$2,$3)
      RETURNING id,username,email
    `,
      [username, email, hashedPassword]
    );

    await redisClient.del("users");

    res.status(201).json({
      message: "Utilisateur créé",
      user: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      `
      SELECT * FROM users
      WHERE email=$1
    `,
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({
        message: "Utilisateur introuvable",
      });
    }

    const validPassword =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!validPassword) {
      return res.status(401).json({
        message: "Mot de passe incorrect",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    res.json({
      message: "Connexion réussie",
      token,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/create-admin", async (req, res) => {
  const hashedPassword =
    await bcrypt.hash("password123", 10);

  const result = await pool.query(
    `
    INSERT INTO users
    (username,email,password,role)
    VALUES ($1,$2,$3,$4)
    RETURNING id,email,role
    `,
    [
      "admin2",
      "admin2@greenops.com",
      hashedPassword,
      "admin",
    ]
  );

  res.json(result.rows[0]);
});

app.get(
  "/api/profile",
  authenticateToken,
  async (req, res) => {
    res.json({
      message: "Route protégée",
      user: req.user,
    });
  }
);

app.get(
  "/api/admin",
  authenticateToken,
  authorizeRole("admin"),
  async (req, res) => {
    res.json({
      message:
        "Bienvenue administrateur",
      user: req.user,
    });
  }
);

app.get("/api/metrics", async (req, res) => {
  res.set(
    "Content-Type",
    register.contentType
  );

  res.end(await register.metrics());
});

const PORT =
  process.env.AUTH_SERVICE_PORT || 3001;

app.listen(PORT, () => {
  console.log(
    `Auth service running on ${PORT}`
  );
});