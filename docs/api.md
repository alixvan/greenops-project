# API Applicative

Toutes les routes publiques passent par l'API Gateway avec le prefixe `/api`.

## Plateforme

```http
GET /api/platform/health
```

Retourne l'etat agrege des microservices.

## Authentification

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "user",
  "email": "user@greenops.local",
  "password": "Password123!"
}
```

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@greenops.local",
  "password": "Admin123!"
}
```

```http
GET /api/auth/profile
Authorization: Bearer <token>
```

```http
GET /api/auth/admin/users
Authorization: Bearer <admin-token>
```

## Metriques energetiques

```http
GET /api/energy/metrics?limit=20
GET /api/energy/latest
GET /api/energy/live
GET /api/energy/summary
```

Ajouter une mesure :

```http
POST /api/energy/metrics
Content-Type: application/json

{
  "site": "Paris DC-1",
  "kilowatts": 64.2,
  "renewablePercentage": 61.4,
  "carbonGrams": 330.5,
  "temperatureC": 22.4
}
```

## Alertes

```http
POST /api/alerts/evaluate
GET /api/alerts
GET /api/alerts/history?limit=20
```

Les seuils sont configurables via variables d'environnement :

- `ENERGY_THRESHOLD_KW`
- `CARBON_THRESHOLD_GRAMS`
- `RENEWABLE_MIN_PERCENTAGE`

## Monitoring

Chaque service expose `/metrics` au format Prometheus :

- `api-gateway:3000/metrics`
- `auth-service:3001/metrics`
- `metrics-service:3003/metrics`
- `alert-service:3004/metrics`
