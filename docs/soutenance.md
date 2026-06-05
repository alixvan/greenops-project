# Support de Soutenance

## Demonstration Docker

1. Lancer `docker compose up --build`.
2. Ouvrir http://localhost:8080.
3. Se connecter avec `admin@greenops.local` / `Admin123!`.
4. Actualiser le dashboard.
5. Declencher `Evaluer` pour generer des alertes selon les seuils.
6. Ouvrir Prometheus sur http://localhost:9090.
7. Ouvrir Grafana sur http://localhost:3002.

## Demonstration Kubernetes

1. Builder ou charger les images dans le cluster.
2. Appliquer `kubectl apply -k kubernetes/base`.
3. Montrer `kubectl -n greenops get pods`.
4. Montrer l'Ingress ou un port-forward.
5. Supprimer un pod applicatif et observer le redemarrage.
6. Afficher les HPA avec `kubectl -n greenops get hpa`.

## Points a expliquer

- Pourquoi une API Gateway centralise les appels frontend.
- Pourquoi PostgreSQL est utilise pour la persistance.
- Pourquoi Redis est limite au cache.
- Comment Prometheus collecte les metriques.
- Comment Grafana consomme Prometheus.
- Comment Docker Compose segmente les reseaux.
- Comment Kubernetes ameliore disponibilite, probes, scaling et exposition.

## Correspondance cahier des charges

| Exigence | Implementation |
| --- | --- |
| Frontend React | `frontend` |
| API Gateway | `services/api-gateway` |
| Auth JWT et roles | `services/auth-service` |
| Services metiers | `metrics-service`, `alert-service` |
| PostgreSQL | `postgres`, `database/init.sql` |
| Redis | `redis` |
| Reverse proxy | `infrastructure/nginx/default.conf` |
| Prometheus/Grafana | `infrastructure/prometheus`, services compose, manifests K8s |
| Dockerfiles optimises | un Dockerfile par service |
| Docker Compose | `docker-compose.yml` |
| Kubernetes | `kubernetes/base` |
| HPA/probes/PVC/Ingress | manifests Kubernetes |
| CI/CD | `.github/workflows/ci.yml` |
