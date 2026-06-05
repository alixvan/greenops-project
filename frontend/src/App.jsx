import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import hero from "./assets/hero.png";

const initialForm = {
  username: "",
  email: "",
  password: "",
};

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return `${Number(value).toFixed(1)}${suffix}`;
}

function StatusBadge({ status }) {
  const normalized = String(status || "unknown").toLowerCase();
  return <span className={`status status-${normalized}`}>{status || "UNKNOWN"}</span>;
}

function getObservabilityLinks() {
  if (typeof window === "undefined") {
    return [];
  }

  const host = window.location.hostname || "localhost";
  const protocol = window.location.protocol || "http:";
  const portOverrides = window.location.port === "8081"
    ? { prometheus: "9091", grafana: "3006" }
    : { prometheus: "9090", grafana: "3002" };

  return [
    {
      name: "Prometheus",
      detail: "Targets et metriques applicatives",
      url: `${protocol}//${host}:${portOverrides.prometheus}`,
      status: "UP",
    },
    {
      name: "Grafana",
      detail: "Dashboard GreenOps Observability",
      url: `${protocol}//${host}:${portOverrides.grafana}`,
      status: "UP",
    },
  ];
}

function EnergyChart({ metrics }) {
  const points = useMemo(() => {
    if (!metrics.length) {
      return "";
    }

    const max = Math.max(...metrics.map((metric) => metric.kilowatts), 100);
    return metrics
      .map((metric, index) => {
        const x = metrics.length === 1 ? 180 : (index / (metrics.length - 1)) * 340 + 10;
        const y = 135 - (metric.kilowatts / max) * 110;
        return `${x},${y}`;
      })
      .join(" ");
  }, [metrics]);

  return (
    <div className="chart-frame" aria-label="Courbe de consommation energetique">
      <svg viewBox="0 0 360 150" role="img">
        <line x1="10" y1="135" x2="350" y2="135" className="chart-axis" />
        <line x1="10" y1="24" x2="350" y2="24" className="chart-grid" />
        <line x1="10" y1="80" x2="350" y2="80" className="chart-grid" />
        {points && <polyline points={points} className="chart-line" />}
        {metrics.map((metric, index) => {
          const max = Math.max(...metrics.map((item) => item.kilowatts), 100);
          const x = metrics.length === 1 ? 180 : (index / (metrics.length - 1)) * 340 + 10;
          const y = 135 - (metric.kilowatts / max) * 110;
          return <circle key={metric.id || index} cx={x} cy={y} r="4" className="chart-dot" />;
        })}
      </svg>
    </div>
  );
}

function App() {
  const [form, setForm] = useState(initialForm);
  const [mode, setMode] = useState("login");
  const [token, setToken] = useState(() => localStorage.getItem("greenops_token") || "");
  const [profile, setProfile] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [platform, setPlatform] = useState({ status: "UNKNOWN", services: [] });
  const [liveMetric, setLiveMetric] = useState(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const latest = liveMetric || metrics[metrics.length - 1];
  const observabilityLinks = useMemo(() => getObservabilityLinks(), []);

  async function loadPlatform() {
    const response = await axios.get("/api/platform/health");
    setPlatform(response.data);
  }

  async function loadDashboard() {
    const [metricsResponse, summaryResponse, alertResponse] = await Promise.all([
      axios.get("/api/energy/metrics", { params: { limit: 14 } }),
      axios.get("/api/energy/summary"),
      axios.get("/api/alerts/history", { params: { limit: 6 } }),
    ]);

    setMetrics(metricsResponse.data);
    setSummary(summaryResponse.data);
    setAlerts(alertResponse.data);
  }

  const loadProfile = useCallback(async (currentToken) => {
    if (!currentToken) {
      setProfile(null);
      return;
    }

    const response = await axios.get("/api/auth/profile", {
      headers: { Authorization: `Bearer ${currentToken}` },
    });
    setProfile(response.data.user);
  }, []);

  useEffect(() => {
    Promise.allSettled([loadPlatform(), loadDashboard()]);
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    loadProfile(token).catch(() => {
      localStorage.removeItem("greenops_token");
      setToken("");
      setProfile(null);
    });
  }, [loadProfile, token]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const response = await axios.get("/api/energy/live");
        setLiveMetric(response.data);
        await loadDashboard();
      } catch {
        setNotice("Flux temps reel indisponible");
      }
    }, 15000);

    return () => window.clearInterval(interval);
  }, []);

  function updateForm(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleAuth(event) {
    event.preventDefault();
    setLoading(true);
    setNotice("");

    try {
      if (mode === "login") {
        const response = await axios.post("/api/auth/login", {
          email: form.email,
          password: form.password,
        });

        localStorage.setItem("greenops_token", response.data.token);
        setToken(response.data.token);
        setProfile(response.data.user);
        setNotice("Session ouverte");
      } else {
        await axios.post("/api/auth/register", form);
        setMode("login");
        setNotice("Compte cree");
      }
    } catch (error) {
      setNotice(error.response?.data?.message || "Operation refusee");
    } finally {
      setLoading(false);
    }
  }

  async function evaluateAlerts() {
    setLoading(true);
    setNotice("");

    try {
      const response = await axios.post("/api/alerts/evaluate");
      setLiveMetric(response.data.metric);
      await loadDashboard();
      setNotice(response.data.alerts.length ? "Alerte enregistree" : "Aucun seuil critique");
    } catch (error) {
      setNotice(error.response?.data?.error || "Evaluation impossible");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("greenops_token");
    setToken("");
    setProfile(null);
    setNotice("Session fermee");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={hero} alt="" />
          <div>
            <p className="eyebrow">GreenOps</p>
            <h1>Platform</h1>
          </div>
        </div>

        <form className="auth-panel" onSubmit={handleAuth}>
          <div className="panel-heading">
            <h2>{mode === "login" ? "Connexion" : "Inscription"}</h2>
            <button
              className="link-button"
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Creer" : "Retour"}
            </button>
          </div>

          {mode === "register" && (
            <label>
              Nom
              <input name="username" value={form.username} onChange={updateForm} />
            </label>
          )}

          <label>
            Email
            <input name="email" type="email" value={form.email} onChange={updateForm} />
          </label>

          <label>
            Mot de passe
            <input name="password" type="password" value={form.password} onChange={updateForm} />
          </label>

          <button className="primary-button" type="submit" disabled={loading}>
            {mode === "login" ? "Se connecter" : "Valider"}
          </button>
        </form>

        {profile && (
          <div className="profile-panel">
            <p className="eyebrow">Session</p>
            <strong>{profile.username}</strong>
            <span>{profile.email}</span>
            <StatusBadge status={profile.role} />
            <button className="secondary-button" type="button" onClick={logout}>
              Deconnexion
            </button>
          </div>
        )}

        {notice && <p className="notice">{notice}</p>}
      </aside>

      <main className="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">Supervision energie</p>
            <h2>Tableau de bord operationnel</h2>
          </div>
          <div className="topbar-actions">
            <StatusBadge status={platform.status} />
            <button className="secondary-button" type="button" onClick={() => Promise.allSettled([loadPlatform(), loadDashboard()])}>
              Actualiser
            </button>
            <button className="primary-button" type="button" onClick={evaluateAlerts} disabled={loading}>
              Evaluer
            </button>
          </div>
        </header>

        <section className="kpi-grid">
          <article className="metric-card">
            <span>Puissance</span>
            <strong>{formatNumber(latest?.kilowatts, " kW")}</strong>
            <small>{latest?.site || "Aucun site"}</small>
          </article>
          <article className="metric-card">
            <span>Renouvelable</span>
            <strong>{formatNumber(latest?.renewablePercentage, "%")}</strong>
            <small>part moyenne: {formatNumber(summary?.averageRenewablePercentage, "%")}</small>
          </article>
          <article className="metric-card">
            <span>Carbone</span>
            <strong>{formatNumber(latest?.carbonGrams, " g")}</strong>
            <small>moyenne: {formatNumber(summary?.averageCarbonGrams, " g")}</small>
          </article>
          <article className="metric-card">
            <span>Pic mesure</span>
            <strong>{formatNumber(summary?.peakKilowatts, " kW")}</strong>
            <small>{summary?.samples || 0} echantillons</small>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel chart-panel">
            <div className="panel-heading">
              <h3>Consommation recente</h3>
              <span>{metrics.length} points</span>
            </div>
            <EnergyChart metrics={metrics} />
          </article>

          <article className="panel">
            <div className="panel-heading">
              <h3>Microservices</h3>
              <span>{platform.services.length} checks</span>
            </div>
            <div className="service-list">
              {platform.services.map((service) => (
                <div className="service-row" key={service.name}>
                  <span>{service.name}</span>
                  <StatusBadge status={service.status} />
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="panel observability-panel">
          <div className="panel-heading">
            <h3>Observabilite</h3>
            <span>Prometheus et Grafana</span>
          </div>

          <div className="observability-list">
            {observabilityLinks.map((link) => (
              <a className="observability-link" href={link.url} target="_blank" rel="noreferrer" key={link.name}>
                <div>
                  <strong>{link.name}</strong>
                  <span>{link.detail}</span>
                </div>
                <StatusBadge status={link.status} />
              </a>
            ))}
          </div>
        </section>

        <section className="panel alerts-panel">
          <div className="panel-heading">
            <h3>Historique des alertes</h3>
            <span>{alerts.length} evenements</span>
          </div>

          <div className="alerts-table">
            {alerts.length === 0 && <p className="empty-state">Aucune alerte enregistree</p>}
            {alerts.map((alert) => (
              <div className="alert-row" key={alert.id}>
                <strong>{alert.type}</strong>
                <span>{alert.message}</span>
                <span>{formatNumber(alert.value)}</span>
                <StatusBadge status={alert.severity} />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
