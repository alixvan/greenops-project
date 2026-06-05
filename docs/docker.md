# Procedure Docker

## Prerequis

- Docker Desktop ou Docker Engine avec Docker Compose v2.
- Node.js 22 pour les verifications locales hors conteneur.

## Configuration

Copier le modele d'environnement :

```bash
cp .env.example .env
```

Modifier au minimum :

- `POSTGRES_PASSWORD`
- `DB_PASSWORD`
- `JWT_SECRET`
- `GRAFANA_ADMIN_PASSWORD`

## Lancement

```bash
docker compose up --build
```

Services exposes :

| Service | URL |
| --- | --- |
| Application | http://localhost:8080 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3002 |

Les ports viennent de `.env`. Si Docker indique un conflit de port, changez uniquement les variables publiques :

```env
NGINX_PORT=8081
PROMETHEUS_PORT=9091
PROMETHEUS_TARGET_HOST=10.9.1.152
GRAFANA_PORT=3006
```

Puis relancez :

```bash
docker compose up -d
docker compose ps
```

Sur la machine de validation du projet, les ports utilises sont `8081` pour l'application, `9091` pour Prometheus et `3006` pour Grafana.

## Verification

```bash
docker compose ps
docker compose logs -f api-gateway
curl http://localhost:8080/gateway-health
curl http://localhost:8080/api/platform/health
```

Pour Prometheus et Grafana :

```bash
curl http://localhost:9090/-/healthy
curl http://localhost:3002/api/health
```

Les targets Prometheus Docker sont exposees via Nginx avec des chemins dedies :

| Job | URL locale si `NGINX_PORT=8081` |
| --- | --- |
| `api-gateway` | http://localhost:8081/prometheus-targets/api-gateway/metrics |
| `auth-service` | http://localhost:8081/prometheus-targets/auth-service/metrics |
| `metrics-service` | http://localhost:8081/prometheus-targets/metrics-service/metrics |
| `alert-service` | http://localhost:8081/prometheus-targets/alert-service/metrics |

Dans l'interface Prometheus, les liens de targets pointent vers `${PROMETHEUS_TARGET_HOST}:${NGINX_PORT}` pour rester ouvrables depuis le navigateur de la machine hote. Sur Windows, utilisez l'IP locale de la machine si `host.docker.internal` ne s'ouvre pas dans le navigateur.

Grafana charge automatiquement :

- la datasource `Prometheus`, configuree vers `http://prometheus:9090` dans le reseau Docker ;
- le dashboard `GreenOps Observability`, fourni dans `infrastructure/grafana/dashboards`.

Identifiants Grafana par defaut apres copie de `.env.example` :

| Utilisateur | Mot de passe |
| --- | --- |
| `admin` | `GreenOps2026!Secure` |

## Reset des donnees

```bash
docker compose down -v
docker compose up --build
```

## Images applicatives

Chaque service applicatif possede son propre Dockerfile optimise :

- `frontend/Dockerfile`
- `services/api-gateway/Dockerfile`
- `services/auth-service/Dockerfile`
- `services/metrics-service/Dockerfile`
- `services/alert-service/Dockerfile`

Les images Node utilisent `npm ci --omit=dev`, `NODE_ENV=production` et l'utilisateur non-root `node`.
