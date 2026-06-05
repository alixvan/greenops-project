require("dotenv").config();

const express = require("express");
const cors = require("cors");
const promClient = require("prom-client");
const pool = require("./db");

const app = express();
const register = new promClient.Registry();

promClient.collectDefaultMetrics({ register });

const httpRequests = new promClient.Counter({
  name: "greenops_metrics_http_requests_total",
  help: "Total HTTP requests handled by metrics-service",
  labelNames: ["method", "route", "status"],
});
const currentKilowatts = new promClient.Gauge({
  name: "greenops_energy_kilowatts",
  help: "Latest observed energy consumption in kW",
  labelNames: ["site"],
});
const renewableShare = new promClient.Gauge({
  name: "greenops_renewable_percentage",
  help: "Latest renewable energy percentage",
  labelNames: ["site"],
});

register.registerMetric(httpRequests);
register.registerMetric(currentKilowatts);
register.registerMetric(renewableShare);

const sites = ["Paris DC-1", "Lyon Edge", "Nantes Lab"];

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
    CREATE TABLE IF NOT EXISTS energy_metrics (
      id SERIAL PRIMARY KEY,
      site VARCHAR(120) NOT NULL,
      kilowatts NUMERIC(8, 2) NOT NULL,
      renewable_percentage NUMERIC(5, 2) NOT NULL,
      carbon_grams NUMERIC(8, 2) NOT NULL,
      temperature_c NUMERIC(5, 2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const count = await pool.query("SELECT COUNT(*)::int AS total FROM energy_metrics");

  if (count.rows[0].total === 0) {
    await pool.query(`
      INSERT INTO energy_metrics
        (site, kilowatts, renewable_percentage, carbon_grams, temperature_c, created_at)
      VALUES
        ('Paris DC-1', 58.40, 64.00, 312.00, 22.10, NOW() - INTERVAL '55 minutes'),
        ('Paris DC-1', 62.90, 60.50, 338.20, 22.40, NOW() - INTERVAL '45 minutes'),
        ('Paris DC-1', 71.30, 52.10, 401.90, 23.00, NOW() - INTERVAL '35 minutes'),
        ('Lyon Edge', 42.20, 74.30, 201.40, 20.60, NOW() - INTERVAL '30 minutes'),
        ('Lyon Edge', 47.80, 69.90, 230.10, 21.20, NOW() - INTERVAL '20 minutes'),
        ('Nantes Lab', 36.60, 81.40, 168.80, 19.90, NOW() - INTERVAL '10 minutes')
    `);
  }
}

const schemaReady = ensureSchema();
schemaReady.catch((error) => {
  console.error("Metrics schema initialization failed", error.message);
});

function randomBetween(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function buildMetric(input = {}) {
  const site = input.site || sites[Math.floor(Math.random() * sites.length)];
  const kilowatts = Number(input.kilowatts ?? randomBetween(35, 86));
  const renewablePercentage = Number(
    input.renewablePercentage ?? input.renewable_percentage ?? randomBetween(38, 84)
  );
  const carbonGrams = Number(
    input.carbonGrams ?? input.carbon_grams ?? randomBetween(150, 470)
  );
  const temperatureC = Number(
    input.temperatureC ?? input.temperature_c ?? randomBetween(18, 27)
  );

  return {
    site,
    kilowatts,
    renewablePercentage,
    carbonGrams,
    temperatureC,
  };
}

function mapMetric(row) {
  return {
    id: row.id,
    site: row.site,
    kilowatts: Number(row.kilowatts),
    renewablePercentage: Number(row.renewable_percentage),
    carbonGrams: Number(row.carbon_grams),
    temperatureC: Number(row.temperature_c),
    createdAt: row.created_at,
  };
}

async function insertMetric(metric) {
  const result = await pool.query(
    `
      INSERT INTO energy_metrics
        (site, kilowatts, renewable_percentage, carbon_grams, temperature_c)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [
      metric.site,
      metric.kilowatts,
      metric.renewablePercentage,
      metric.carbonGrams,
      metric.temperatureC,
    ]
  );

  const saved = mapMetric(result.rows[0]);
  currentKilowatts.set({ site: saved.site }, saved.kilowatts);
  renewableShare.set({ site: saved.site }, saved.renewablePercentage);
  return saved;
}

app.get("/health", (req, res) => {
  res.json({ service: "metrics-service", status: "UP" });
});

app.get(
  "/ready",
  asyncHandler(async (req, res) => {
    await schemaReady;
    await pool.query("SELECT 1");
    res.json({ service: "metrics-service", ready: true });
  })
);

app.get(
  "/metrics",
  asyncHandler(async (req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  })
);

app.get(
  "/energy/metrics",
  asyncHandler(async (req, res) => {
    await schemaReady;
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const result = await pool.query(
      `
        SELECT *
        FROM energy_metrics
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [limit]
    );

    res.json(result.rows.map(mapMetric).reverse());
  })
);

app.get(
  "/energy/latest",
  asyncHandler(async (req, res) => {
    await schemaReady;
    const result = await pool.query(
      `
        SELECT *
        FROM energy_metrics
        ORDER BY created_at DESC
        LIMIT 1
      `
    );

    if (!result.rows[0]) {
      return res.json(await insertMetric(buildMetric()));
    }

    const latest = mapMetric(result.rows[0]);
    currentKilowatts.set({ site: latest.site }, latest.kilowatts);
    renewableShare.set({ site: latest.site }, latest.renewablePercentage);
    return res.json(latest);
  })
);

app.get(
  "/energy/metrics/live",
  asyncHandler(async (req, res) => {
    await schemaReady;
    res.status(201).json(await insertMetric(buildMetric(req.query)));
  })
);

app.post(
  "/energy/metrics",
  asyncHandler(async (req, res) => {
    await schemaReady;
    res.status(201).json(await insertMetric(buildMetric(req.body)));
  })
);

app.get(
  "/energy/summary",
  asyncHandler(async (req, res) => {
    await schemaReady;
    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS samples,
        ROUND(AVG(kilowatts), 2) AS avg_kw,
        ROUND(MAX(kilowatts), 2) AS peak_kw,
        ROUND(AVG(renewable_percentage), 2) AS avg_renewable,
        ROUND(AVG(carbon_grams), 2) AS avg_carbon
      FROM energy_metrics
    `);

    const summary = result.rows[0];
    res.json({
      samples: Number(summary.samples || 0),
      averageKilowatts: Number(summary.avg_kw || 0),
      peakKilowatts: Number(summary.peak_kw || 0),
      averageRenewablePercentage: Number(summary.avg_renewable || 0),
      averageCarbonGrams: Number(summary.avg_carbon || 0),
    });
  })
);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: error.message });
});

const PORT = Number(process.env.PORT || 3003);

app.listen(PORT, () => {
  console.log(`Metrics service running on port ${PORT}`);
});
