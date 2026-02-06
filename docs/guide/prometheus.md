# Prometheus Metrics

The API exposes Prometheus metrics at `/metrics` for monitoring and observability.

```bash
curl http://localhost:3000/metrics
```

## Available Metrics

### HTTP

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Request duration |
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Total requests |

### Signup

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `signup_requests_total` | Counter | `endpoint`, `status` | Signup requests |
| `signup_duration_seconds` | Histogram | `endpoint` | Signup processing time |

### Google Sheets

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `sheets_requests_total` | Counter | `operation`, `status` | Sheets API requests |
| `sheets_request_duration_seconds` | Histogram | `operation` | Sheets API latency |

### Turnstile

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `turnstile_requests_total` | Counter | `status` | Verification requests |
| `turnstile_validation_duration_seconds` | Histogram | - | Verification latency |

Default Node.js process metrics (`node_cpu_*`, `node_memory_*`, `process_*`) are also collected.

## Configuration

Metrics are enabled by default. Disable with:

```bash
ENABLE_METRICS=false
```

## Prometheus Scrape Config

```yaml
scrape_configs:
  - job_name: 'signup-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
        labels:
          service: 'signup-api'
```

### Docker Compose with Prometheus

```yaml
services:
  signup-api:
    image: your-registry/signup-api:latest
    ports:
      - "3000:3000"

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
```

## Useful Queries

```promql
# Error rate
rate(signup_requests_total{status="error"}[5m])

# P95 latency
histogram_quantile(0.95, rate(signup_duration_seconds_bucket[5m]))

# Success rate
rate(signup_requests_total{status="success"}[5m]) / rate(signup_requests_total[5m])

# Sheets API latency
rate(sheets_request_duration_seconds_sum[5m]) / rate(sheets_request_duration_seconds_count[5m])

# Turnstile success rate
rate(turnstile_requests_total{status="success"}[5m]) / rate(turnstile_requests_total[5m])

# HTTP 5xx rate
rate(http_requests_total{status_code=~"5.."}[5m])
```

## Grafana Dashboard Panels

1. **Request Rate**: `rate(signup_requests_total[1m])`
2. **Error Rate**: `rate(signup_requests_total{status="error"}[5m])`
3. **P95 Latency**: `histogram_quantile(0.95, rate(signup_duration_seconds_bucket[5m]))`
4. **Sheets API Status**: `rate(sheets_requests_total[1m])`
5. **Turnstile Verification**: `rate(turnstile_requests_total[1m])`

## Alert Rules

```yaml
groups:
  - name: signup_api
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(signup_requests_total{status="error"}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High error rate on signup API

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(signup_duration_seconds_bucket[5m])) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: P95 latency above 5 seconds

      - alert: SheetsAPIFailure
        expr: rate(sheets_requests_total{status="error"}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: Google Sheets API failures detected
```
