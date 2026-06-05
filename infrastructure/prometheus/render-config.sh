#!/bin/sh
set -eu

cat > /tmp/prometheus.yml <<EOF
global:
  scrape_interval: 10s
  evaluation_interval: 10s

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets:
          - ${PROMETHEUS_TARGET_HOST:-host.docker.internal}:${PROMETHEUS_PORT:-9090}

  - job_name: api-gateway
    metrics_path: /prometheus-targets/api-gateway/metrics
    static_configs:
      - targets:
          - ${PROMETHEUS_TARGET_HOST:-host.docker.internal}:${NGINX_PORT:-8080}

  - job_name: auth-service
    metrics_path: /prometheus-targets/auth-service/metrics
    static_configs:
      - targets:
          - ${PROMETHEUS_TARGET_HOST:-host.docker.internal}:${NGINX_PORT:-8080}

  - job_name: metrics-service
    metrics_path: /prometheus-targets/metrics-service/metrics
    static_configs:
      - targets:
          - ${PROMETHEUS_TARGET_HOST:-host.docker.internal}:${NGINX_PORT:-8080}

  - job_name: alert-service
    metrics_path: /prometheus-targets/alert-service/metrics
    static_configs:
      - targets:
          - ${PROMETHEUS_TARGET_HOST:-host.docker.internal}:${NGINX_PORT:-8080}
EOF

exec /bin/prometheus \
  --config.file=/tmp/prometheus.yml \
  --storage.tsdb.retention.time=3d
