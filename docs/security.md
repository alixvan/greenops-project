# Securite

## Secrets

Les secrets applicatifs ne doivent pas etre versionnes.

Le depot contient :

- `.env.example` pour Docker ;
- `kubernetes/base/03-secrets.example.yaml` comme modele pedagogique.

Les valeurs reelles doivent etre injectees localement, via GitHub Secrets, via un Secret Kubernetes cree manuellement, ou via un outil de type Sealed Secrets / External Secrets.

## Authentification

- Les mots de passe sont hashes avec bcrypt.
- Les sessions utilisent JWT.
- Les routes admin exigent un token avec `role=admin`.
- L'ancien endpoint ouvert de creation admin a ete supprime.

## Reseaux

Docker Compose isole :

- le point d'entree public ;
- les services applicatifs ;
- le reseau data interne ;
- le reseau observabilite.

PostgreSQL et Redis ne sont pas exposes directement sur l'hote.

## Conteneurs

Les services Node :

- utilisent `npm ci --omit=dev` dans les images de production ;
- tournent avec l'utilisateur non-root `node` ;
- exposent des probes HTTP pour limiter les indisponibilites.

## Kubernetes

Les manifests utilisent :

- `Secret` pour les donnees sensibles ;
- `ConfigMap` pour la configuration non sensible ;
- `readinessProbe` et `livenessProbe` ;
- `resources.requests` et `resources.limits` ;
- `HorizontalPodAutoscaler` pour la scalabilite.
