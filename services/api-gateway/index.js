require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const promClient = require("prom-client");

const app = express();
const register = new promClient.Registry();

promClient.collectDefaultMetrics({ register });

const httpRequests = new promClient.Counter({
  name: "greenops_gateway_http_requests_total",
  help: "Total HTTP requests handled by api-gateway",
  labelNames: ["method", "route", "status"],
});

register.registerMetric(httpRequests);

const services = {
  auth: process.env.AUTH_SERVICE_URL || "http://auth-service:3001",
  metrics: process.env.METRICS_SERVICE_URL || "http://metrics-service:3003",
  alerts: process.env.ALERT_SERVICE_URL || "http://alert-service:3004",
};

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

async function forward(req, res, targetUrl) {
  const response = await axios({
    method: req.method,
    url: targetUrl,
    data: req.body,
    params: req.query,
    headers: {
      authorization: req.headers.authorization,
    },
    validateStatus: () => true,
  });

  return res.status(response.status).json(response.data);
}

app.get("/health", (req, res) => {
  res.json({ service: "api-gateway", status: "UP" });
});

app.get(
  "/metrics",
  asyncHandler(async (req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  })
);

app.get(
  "/api/platform/health",
  asyncHandler(async (req, res) => {
    const checks = await Promise.allSettled(
      Object.entries(services).map(async ([name, url]) => {
        const response = await axios.get(`${url}/health`, { timeout: 2500 });
        return [name, response.data];
      })
    );

    const payload = checks.map((check, index) => {
      const name = Object.keys(services)[index];
      if (check.status === "fulfilled") {
        return { name, status: check.value[1].status || "UP" };
      }

      return { name, status: "DOWN", error: check.reason.message };
    });

    res.json({
      status: payload.every((item) => item.status === "UP") ? "UP" : "DEGRADED",
      services: payload,
    });
  })
);

app.post("/api/auth/register", asyncHandler((req, res) => forward(req, res, `${services.auth}/auth/register`)));
app.post("/api/auth/login", asyncHandler((req, res) => forward(req, res, `${services.auth}/auth/login`)));
app.get("/api/auth/profile", asyncHandler((req, res) => forward(req, res, `${services.auth}/auth/profile`)));
app.get("/api/auth/admin/users", asyncHandler((req, res) => forward(req, res, `${services.auth}/auth/admin/users`)));

app.post("/api/register", asyncHandler((req, res) => forward(req, res, `${services.auth}/auth/register`)));
app.post("/api/login", asyncHandler((req, res) => forward(req, res, `${services.auth}/auth/login`)));
app.get("/api/profile", asyncHandler((req, res) => forward(req, res, `${services.auth}/auth/profile`)));

app.get("/api/energy/metrics", asyncHandler((req, res) => forward(req, res, `${services.metrics}/energy/metrics`)));
app.post("/api/energy/metrics", asyncHandler((req, res) => forward(req, res, `${services.metrics}/energy/metrics`)));
app.get("/api/energy/latest", asyncHandler((req, res) => forward(req, res, `${services.metrics}/energy/latest`)));
app.get("/api/energy/live", asyncHandler((req, res) => forward(req, res, `${services.metrics}/energy/metrics/live`)));
app.get("/api/energy/summary", asyncHandler((req, res) => forward(req, res, `${services.metrics}/energy/summary`)));

app.get("/api/alerts", asyncHandler((req, res) => forward(req, res, `${services.alerts}/alerts`)));
app.get("/api/alerts/history", asyncHandler((req, res) => forward(req, res, `${services.alerts}/alerts/history`)));
app.post("/api/alerts/evaluate", asyncHandler((req, res) => forward(req, res, `${services.alerts}/alerts/evaluate`)));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(502).json({
    error: "Gateway upstream error",
    detail: error.message,
  });
});

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
