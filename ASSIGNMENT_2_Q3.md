# Assignment 2 — Question 3: End-to-End DevOps Pipeline

**Application:** QuickBite food-delivery web application with the Assignment 2 Q2 Iris
model lifecycle and monitoring stack.

**Objective:** Show how the existing Agile planning, Git/GitHub, GitHub Actions,
Docker Compose, MLflow, Prometheus, and Grafana work fit together without adding a new
platform or application feature.

## 1. Architecture and workflow

The complete workflow is shown in
[`ASSIGNMENT_2_Q3_ARCHITECTURE.md`](ASSIGNMENT_2_Q3_ARCHITECTURE.md).

The flow is:

1. **Plan:** Q1 defines the prioritized QuickBite stories and acceptance criteria in
   [`AGILE_ASSIGNMENT_Q1.md`](AGILE_ASSIGNMENT_Q1.md). The Jira-ready product backlog is
   [`JIRA_BACKLOG.md`](JIRA_BACKLOG.md), covering US-01 registration/login, US-02
   restaurant browsing, and US-11 restaurant search.
2. **Version control:** Work is maintained in the Git repository
   [`Overpowered21/quickbite`](https://github.com/Overpowered21/quickbite), on `main`.
   The existing history shows the application, GitHub Actions, Docker Compose, and Q2
   lifecycle/monitoring being added as separate traceable changes.
3. **CI/CD:**
   [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) runs on pushes to
   `main`, pull requests, and manual dispatch. It checks out the revision, installs
   Node.js 20, runs `npm test`, builds and starts the root Compose deployment, checks
   `http://127.0.0.1:3000/`, displays Compose status, and tears the deployment down.
4. **Application deployment:** The root
   [`docker-compose.yml`](docker-compose.yml) builds the Node.js image from
   [`Dockerfile`](Dockerfile), publishes QuickBite on port 3000, and uses the image
   health check. This is the application deployment verified by the current Actions
   workflow.
5. **MLflow model lifecycle:** The existing Q2 stack is started from the same checked-
   out repository with
   `docker compose -f q2/compose.yaml up --build -d`. Its dependency order is MLflow
   healthy → one-shot `train` successful → model API healthy → Prometheus → Grafana.
   [`q2/train.py`](q2/train.py) trains the standardized Iris logistic-regression model,
   records the `q2-iris-classification` experiment's parameters, metrics, artifacts,
   signature, and input example, registers `iris-classifier`, and assigns the
   `champion` alias. [`q2/service.py`](q2/service.py) resolves that alias at startup,
   loads the exact registered version, and exposes `/health` and `/predict`.
6. **Monitoring:** The model API exposes `/metrics`. The existing
   [`q2/monitoring/prometheus.yml`](q2/monitoring/prometheus.yml) scrapes
   `model-service:8000` every five seconds. Grafana is provisioned with the Prometheus
    datasource ([`q2/monitoring/datasource.yml`](q2/monitoring/datasource.yml) and
    [`q2/monitoring/dashboards.yml`](q2/monitoring/dashboards.yml)) and
    [`q2/monitoring/dashboard.json`](q2/monitoring/dashboard.json), which displays
    scrape availability, loaded model version, prediction throughput, error ratio, and
    p95 latency. Monitoring results feed defects or improvements back into the backlog
    for the next iteration.

The existing Q2 monitoring stack observes the Q2 model API. The current GitHub Actions
file automates the root QuickBite deployment; Q2's Compose lifecycle is the documented
repository-level demonstration path and is not falsely represented as an additional
Actions job.

## 2. Execution evidence

| Pipeline area | Evidence and observed result |
|---|---|
| Local CI | `npm test` was executed in this checkout: **26 tests passed, 0 failed**. |
| Git/GitHub traceability | The local `main` history contains `84288f7` (GitHub Actions), `9c15628` (Docker Compose deployment), and `5328045` (Q2 MLflow and monitoring). The repository remote is `https://github.com/Overpowered21/quickbite`. |
| GitHub Actions CI/CD | [Run #2](https://github.com/Overpowered21/quickbite/actions/runs/37823879253) for commit `9c1562832ce783718f242a18c5b1818c19f73eda` completed with **success**. Its job steps succeeded for Node setup, tests, Docker Compose build/deploy, HTTP verification, Compose status, and cleanup. |
| QuickBite deployment | The successful Actions run provides execution evidence for `docker compose up --build -d`, the HTTP readiness check on port 3000, `docker compose ps`, and `docker compose down`. |
| Q2 model lifecycle | The repeatable commands and expected observations are recorded in [`q2/README.md`](q2/README.md): `train` exits with code 0, MLflow contains experiment/model versions, `/health` identifies the loaded version, and changing `--c` creates a new version and moves `champion`. The implementation is in `q2/train.py`, `q2/service.py`, and `q2/compose.yaml`. |
| Q2 monitoring | [`q2/README.md`](q2/README.md) provides the checks for `/metrics`, Prometheus **Status → Targets** (`model-service` UP), Grafana's Q2 dashboard, generated prediction traffic, invalid-input errors, and an availability stop/start demonstration. |

The sandbox used for this documentation has Node.js but does not have the Docker CLI,
so the Q2 Compose runtime was not re-run locally during this documentation pass. The
Q2 commands, service ordering, endpoints, Prometheus queries, and dashboard panels
above are taken directly from the existing Q2 implementation and README; the Docker
deployment evidence shown as executed is the public GitHub Actions run listed above.

## 3. Demonstration commands

From the project root, the existing work can be demonstrated in this order:

```bash
# QuickBite CI and local application
npm test
docker compose up --build -d
curl --fail http://127.0.0.1:3000/
docker compose ps

# Q2 MLflow, model API, Prometheus, and Grafana
docker compose -f q2/compose.yaml up --build -d
docker compose -f q2/compose.yaml ps -a
docker compose -f q2/compose.yaml logs train model-service
curl -fsS http://localhost:8000/health
curl -fsS http://localhost:8000/predict \
  -H 'Content-Type: application/json' \
  -d '{"features":[5.1,3.5,1.4,0.2]}'
```

The existing Q2 URLs are MLflow `http://localhost:5000`, model API
`http://localhost:8000`, Prometheus `http://localhost:9090`, and Grafana
`http://localhost:3001`. The Q2 README contains the traffic-generation, invalid-input,
model-version update, rollback, and shutdown commands used to complete the demonstration.
