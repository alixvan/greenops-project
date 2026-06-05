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
