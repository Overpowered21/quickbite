# Assignment 2 — Question 2

A self-contained ML lifecycle demonstration: **train → track → register/version → deploy → monitor**. It uses scikit-learn's bundled Iris dataset (150 rows, four measurements, three flower species) and a standardized logistic regression model. No external dataset download is needed.

## Requirements covered

| Requirement | Implementation |
|---|---|
| MLflow lifecycle and experiment tracking | `train.py` creates runs in `q2-iris-classification`. |
| Parameters, metrics, and artifacts | Logs `C`, iteration limit, random seed, split sizes, scaling; training/test accuracy and test macro-F1; model artifact, input example, and input/output signature. |
| Model version management | Registers `iris-classifier`, creating a new numbered version per training run; moves the `champion` alias to that version. |
| Model deployment | `service.py` resolves `champion` at startup, loads that exact registered version, and serves `/predict`. Responses and `/health` identify the loaded version. |
| Prometheus monitoring | Scrapes `/metrics` every five seconds: HTTP request counts, status codes, latency histogram, and loaded model version. |
| Grafana visualization | Automatically provisions a Prometheus datasource and a dashboard for availability, model version, prediction throughput, error ratio, and p95 latency. |

## Run with Docker Compose

Requires Docker Engine/Desktop with **Docker Compose v2**. From the project root:

```bash
docker compose -f q2/compose.yaml up --build -d
docker compose -f q2/compose.yaml ps -a
docker compose -f q2/compose.yaml logs train model-service
```

Startup order is MLflow healthy → one-shot training finishes successfully → model API healthy → Prometheus → Grafana. The `train` container exiting with code **0** is expected. The first build installs Python dependencies and may take several minutes.

| Component | URL | Details |
|---|---|---|
| MLflow | http://localhost:5000 | Open the experiment and the `iris-classifier` registered model. |
| Model API | http://localhost:8000/docs | Interactive API documentation. |
| Model health | http://localhost:8000/health | Reports the actual loaded model version. |
| Raw metrics | http://localhost:8000/metrics | Prometheus text exposition. |
| Prometheus | http://localhost:9090 | Check **Status → Targets** for `model-service` being UP. |
| Grafana | http://localhost:3001 | Login: **admin / q2-admin**. Open **Dashboards → Assignment 2 Q2 → Q2 — Model API monitoring**. |

MLflow's SQLite tracking/registry database and model artifacts, Prometheus samples, and Grafana state persist in separate Docker volumes. Training and serving access artifacts through MLflow's HTTP artifact endpoint.

## Predict and demonstrate monitoring

Input order is **sepal length, sepal width, petal length, petal width**, all in centimeters. Four finite positive values are required.

```bash
curl -fsS http://localhost:8000/health
curl -fsS http://localhost:8000/predict \
  -H 'Content-Type: application/json' \
  -d '{"features":[5.1,3.5,1.4,0.2]}'
```

Expected prediction: `{"prediction":0,"species":"setosa","model_version":"1"}` on the first run. Version numbers increase with subsequent training runs.

Generate traffic for the dashboard:

```bash
for i in $(seq 1 60); do
  curl -fsS http://localhost:8000/predict \
    -H 'Content-Type: application/json' \
    -d '{"features":[5.1,3.5,1.4,0.2]}' > /dev/null
  sleep 1
done

# Deliberately invalid input: HTTP 422, recorded as a request error.
curl -i http://localhost:8000/predict \
  -H 'Content-Type: application/json' -d '{"features":[5.1]}'
```

Wait at least two scrapes (about ten seconds) for rate panels. Prometheus queries to try:

```promql
up{job="model-service"}
model_loaded{job="model-service"}
model_http_requests_total{job="model-service",route="/predict"}
```

For an availability demonstration, stop the API with `docker compose -f q2/compose.yaml stop model-service`, wait for a scrape and observe `up = 0`, then recover with `docker compose -f q2/compose.yaml start model-service`.

## Create and deploy another model version

```bash
docker compose -f q2/compose.yaml run --rm train python train.py --c 0.5
docker compose -f q2/compose.yaml restart model-service
curl -fsS http://localhost:8000/health
```

The new run logs the changed `C` parameter, creates another registered version, and updates `champion`. The API pins a version at startup; restart it to deploy the updated alias. Compare runs and versions in MLflow and see the new version in Grafana.

To roll back, open `iris-classifier` in MLflow's Models page, assign `champion` to an earlier version, and restart `model-service` again.

## Stop

```bash
docker compose -f q2/compose.yaml down
```

Add `-v` to that command only when intentionally resetting the demonstration's database, model artifacts, and monitoring history.

## Local validation

See the validation results below for what was actually run in the implementation environment. Docker Compose configuration and dashboard provisioning still require a Docker-capable environment for full runtime validation.
