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

## Verification

```bash
docker compose ps
docker compose logs -f api-gateway
curl http://localhost:8080/gateway-health
curl http://localhost:8080/api/platform/health
```

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
