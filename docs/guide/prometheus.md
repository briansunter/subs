# Prometheus Metrics

The signup API exposes [Prometheus](https://prometheus.io/) metrics for monitoring and observability.

## Metrics Endpoint

The metrics are available at the `/metrics` endpoint in Prometheus text format:

```bash
curl http://localhost:3000/metrics
```

Example response:

```
# HELP http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.005",method="GET",route="/api/health",status_code="200"} 1
http_request_duration_seconds_bucket{le="0.01",method="GET",route="/api/health",status_code="200"} 1
...

# HELP signup_requests_total Total number of signup requests
# TYPE signup_requests_total counter
signup_requests_total{endpoint="/api/signup",status="success"} 42
signup_requests_total{endpoint="/api/signup",status="error"} 3

# HELP sheets_requests_total Total number of Google Sheets API requests
# TYPE sheets_requests_total counter
sheets_requests_total{operation="appendSignup",status="success"} 42
```

## Available Metrics

### HTTP Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Duration of HTTP requests |
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Total number of HTTP requests |

### Signup Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `signup_requests_total` | Counter | `endpoint`, `status` | Total number of signup requests |
| `signup_duration_seconds` | Histogram | `endpoint` | Duration of signup processing |

### Google Sheets Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `sheets_requests_total` | Counter | `operation`, `status` | Total number of Google Sheets API requests |
| `sheets_request_duration_seconds` | Histogram | `operation` | Duration of Google Sheets API requests |

### Discord Webhook Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `discord_webhook_total` | Counter | `type`, `status` | Total number of Discord webhook notifications |

### Turnstile Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `turnstile_requests_total` | Counter | `status` | Total number of Turnstile verification requests |
| `turnstile_validation_duration_seconds` | Histogram | - | Duration of Turnstile token validation |

### System Metrics

Default Prometheus metrics are also collected, including:

| Metric | Type | Description |
|--------|------|-------------|
| `node_cpu_usage_seconds_total` | Counter | Total CPU time |
| `node_memory_*` | Gauge | Memory usage |
| `process_*` | Gauge | Process-level metrics |

## Configuring Prometheus

### Using Prometheus Service Discovery (Kubernetes/Docker Swarm)

The Docker image includes Prometheus annotations for automatic service discovery:

```dockerfile
LABEL prometheus.io/scrape="true"
LABEL prometheus.io/port="3000"
LABEL prometheus.io/path="/metrics"
```

If using Prometheus with Kubernetes or Docker Swarm, the metrics endpoint will be automatically discovered.

### Manual Prometheus Configuration

Add the following scrape configuration to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'signup-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
        labels:
          service: 'signup-api'
          environment: 'production'
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  signup-api:
    image: your-registry/signup-api:latest
    ports:
      - "3000:3000"
    environment:
      - GOOGLE_SHEET_ID=${GOOGLE_SHEET_ID}
      # ... other env vars

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
```

## Example Queries

### Error Rate

```promql
rate(signup_requests_total{status="error"}[5m])
```

### Request Duration (P95)

```promql
histogram_quantile(0.95, rate(signup_duration_seconds_bucket[5m]))
```

### Success Rate

```promql
rate(signup_requests_total{status="success"}[5m]) / rate(signup_requests_total[5m])
```

### Google Sheets API Latency

```promql
rate(sheets_request_duration_seconds_sum[5m]) / rate(sheets_request_duration_seconds_count[5m])
```

### Turnstile Success Rate

```promql
rate(turnstile_requests_total{status="success"}[5m]) / rate(turnstile_requests_total[5m])
```

### HTTP Error Rate by Endpoint

```promql
rate(http_requests_total{status_code=~"5.."}[5m])
```

## Grafana Dashboards

You can create a Grafana dashboard to visualize the metrics. Here are some recommended panels:

1. **Request Rate**: `rate(signup_requests_total[1m])` (graph)
2. **Error Rate**: `rate(signup_requests_total{status="error"}[5m])` (graph)
3. **Latency**: `histogram_quantile(0.95, rate(signup_duration_seconds_bucket[5m]))` (graph)
4. **Google Sheets API Status**: `rate(sheets_requests_total[1m])` (stat)
5. **Turnstile Verification Rate**: `rate(turnstile_requests_total[1m])` (stat)

## Alerts

Example Prometheus alert rules:

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
          description: "{{ $value }} errors per second"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(signup_duration_seconds_bucket[5m])) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High latency on signup API
          description: "P95 latency is {{ $value }}s"

      - alert: SheetsAPIFailure
        expr: rate(sheets_requests_total{status="error"}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: Google Sheets API failures
          description: "{{ $value }} failed requests per second"
```

## Testing Metrics

To verify metrics are being collected:

1. Start the server
2. Make some requests:
   ```bash
   curl -X POST http://localhost:3000/api/signup \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```
3. Check the metrics endpoint:
   ```bash
   curl http://localhost:3000/metrics | grep signup
   ```
4. You should see metrics incrementing:
   ```
   signup_requests_total{endpoint="/api/signup",status="success"} 1
   ```
