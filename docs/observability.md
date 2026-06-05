# Observabilite

L'observabilite repose sur Prometheus pour la collecte des metriques et Grafana pour la visualisation.

## Prometheus

Prometheus est expose par Docker Compose sur le port defini par `PROMETHEUS_PORT`.

| Contexte | URL |
| --- | --- |
| Valeur par defaut | http://localhost:9090 |
| Validation locale si port occupe | http://localhost:9091 |

La configuration se trouve dans `infrastructure/prometheus/prometheus.yml`.

Targets scrapes :

| Job | Endpoint |
| --- | --- |
| `prometheus` | `prometheus:9090` |
| `api-gateway` | `api-gateway:3000/metrics` |
| `auth-service` | `auth-service:3001/metrics` |
| `metrics-service` | `metrics-service:3003/metrics` |
| `alert-service` | `alert-service:3004/metrics` |

Verification rapide :

```bash
curl http://localhost:9090/-/healthy
```

Si le port a ete change dans `.env`, remplacez `9090` par la valeur de `PROMETHEUS_PORT`.

## Grafana

Grafana est expose sur le port defini par `GRAFANA_PORT`.

| Contexte | URL |
| --- | --- |
| Valeur par defaut | http://localhost:3002 |
| Validation locale si port occupe | http://localhost:3006 |

Identifiants :

| Champ | Valeur de demonstration |
| --- | --- |
| Utilisateur | `admin` |
| Mot de passe | `GreenOps2026!Secure` |

Ces valeurs viennent de `.env.example` et doivent etre remplacees pour un environnement reel.

Le provisioning automatique charge :

- `infrastructure/grafana/provisioning/datasources/prometheus.yml` pour connecter Grafana a Prometheus ;
- `infrastructure/grafana/provisioning/dashboards/dashboards.yml` pour declarer le dossier de dashboards ;
- `infrastructure/grafana/dashboards/greenops-overview.json` pour afficher le dashboard `GreenOps Observability`.

## Dashboard GreenOps

Le dashboard contient trois vues de base :

| Panel | Requete PromQL | Objectif |
| --- | --- | --- |
| Disponibilite des services | `up{job=~"api-gateway|auth-service|metrics-service|alert-service|prometheus"}` | Voir si les services sont scrapes et joignables |
| Trafic API Gateway | `sum by (route, status) (rate(greenops_gateway_http_requests_total[5m]))` | Observer le trafic entrant par route et statut HTTP |
| Memoire des microservices | `process_resident_memory_bytes{job=~"api-gateway|auth-service|metrics-service|alert-service"}` | Suivre la memoire residentielle des services Node.js |

## Diagnostic

Si Grafana ou Prometheus ne s'affiche pas :

1. Verifier les ports exposes :

```bash
docker compose ps
```

2. Tester Prometheus :

```bash
curl http://localhost:9090/-/healthy
```

3. Tester Grafana :

```bash
curl http://localhost:3002/api/health
```

4. Verifier les logs :

```bash
docker compose logs prometheus
docker compose logs grafana
```

5. Si les ports par defaut sont occupes, modifier `.env`, par exemple :

```env
PROMETHEUS_PORT=9091
GRAFANA_PORT=3006
```
