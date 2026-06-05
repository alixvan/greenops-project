# Procedure Kubernetes

## Prerequis

- Un cluster Kubernetes local ou distant.
- Un Ingress Controller compatible Nginx.
- Metrics Server pour les HPA.
- Images Docker applicatives disponibles dans le cluster.

## Build des images locales

```bash
docker build -t greenops/frontend:latest frontend
docker build -t greenops/api-gateway:latest services/api-gateway
docker build -t greenops/auth-service:latest services/auth-service
docker build -t greenops/metrics-service:latest services/metrics-service
docker build -t greenops/alert-service:latest services/alert-service
```

Avec Minikube :

```bash
minikube image load greenops/frontend:latest
minikube image load greenops/api-gateway:latest
minikube image load greenops/auth-service:latest
minikube image load greenops/metrics-service:latest
minikube image load greenops/alert-service:latest
```

## Secrets

Le fichier `kubernetes/base/03-secrets.example.yaml` est un modele. Pour un environnement reel, remplacer les valeurs avant de l'appliquer ou creer le secret directement :

```bash
kubectl create namespace greenops
kubectl -n greenops create secret generic greenops-secrets \
  --from-literal=POSTGRES_USER=greenops_user \
  --from-literal=POSTGRES_PASSWORD='change-me' \
  --from-literal=DB_USER=greenops_user \
  --from-literal=DB_PASSWORD='change-me' \
  --from-literal=JWT_SECRET='change-this-jwt-secret' \
  --from-literal=GRAFANA_ADMIN_USER=admin \
  --from-literal=GRAFANA_ADMIN_PASSWORD='change-me'
```

## Deploiement

```bash
kubectl apply -k kubernetes/base
kubectl -n greenops get pods
kubectl -n greenops get svc
```

## Acces applicatif

Avec Ingress :

```bash
echo "127.0.0.1 greenops.local" | sudo tee -a /etc/hosts
```

Puis ouvrir http://greenops.local.

Sans Ingress :

```bash
kubectl -n greenops port-forward svc/frontend 8080:80
kubectl -n greenops port-forward svc/api-gateway 3000:3000
kubectl -n greenops port-forward svc/prometheus 9090:9090
kubectl -n greenops port-forward svc/grafana 3002:3000
```

## Scaling et resilience

Verifier les replicas :

```bash
kubectl -n greenops get deploy
kubectl -n greenops get hpa
```

Tester la resilience :

```bash
kubectl -n greenops delete pod -l app=api-gateway
kubectl -n greenops rollout status deploy/api-gateway
```

Forcer un scaling manuel :

```bash
kubectl -n greenops scale deploy/metrics-service --replicas=4
kubectl -n greenops get pods -l app=metrics-service
```

## Observabilite

Prometheus scrappe :

- `api-gateway:3000/metrics`
- `auth-service:3001/metrics`
- `metrics-service:3003/metrics`
- `alert-service:3004/metrics`

Grafana est provisionne avec une datasource Prometheus.
