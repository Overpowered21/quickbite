# Assignment 2 — Question 3: End-to-End DevOps Pipeline

**Application:** QuickBite food-delivery web application with the Assignment 2 Q2 Iris model lifecycle and monitoring stack.

**Objective:** Demonstrate how Agile planning, Git/GitHub, GitHub Actions, Docker Compose, MLflow, Prometheus, and Grafana work together in the project.

## 1. Workflow and Implementation

### 1.1 Agile Planning

The project uses Agile planning to organize requirements and development tasks. The prioritized user stories and acceptance criteria are documented in `AGILE_ASSIGNMENT_Q1.md`. The Jira-ready product backlog is maintained in `JIRA_BACKLOG.md`, including registration/login, restaurant browsing, and restaurant search.

### 1.2 Version Control

The project source code is maintained in Git and hosted on GitHub:

https://github.com/Overpowered21/quickbite

The `main` branch contains the application, CI/CD workflow, Docker deployment configuration, and Q2 model lifecycle and monitoring implementation. Git commits provide traceability for project changes.

### 1.3 Continuous Integration and Delivery

The GitHub Actions workflow is defined in `.github/workflows/ci-cd.yml`. It runs on pushes to `main`, pull requests, and manual workflow dispatch.

The workflow performs the following operations:

1. Checks out the repository.
2. Sets up Node.js 20.
3. Installs the application dependencies.
4. Runs the automated test suite using `npm test`.
5. Builds and starts the Docker Compose application.
6. Checks the application HTTP response at `http://127.0.0.1:3000/`.
7. Displays the Compose deployment status.
8. Stops the temporary deployment during cleanup.

### 1.4 Docker-Based Application Deployment

The root `Dockerfile` defines the QuickBite application image. The root `docker-compose.yml` builds and runs the application and publishes it on port 3000.

The GitHub Actions workflow verifies the application using a temporary Docker Compose deployment. This demonstrates automated testing, container image building, application startup, HTTP verification, and cleanup.

### 1.5 MLflow Model Lifecycle

The Q2 implementation uses the Iris dataset and a standardized logistic-regression model.

The `q2/train.py` script trains the model and records parameters, metrics, artifacts, the model signature, and an input example in the MLflow experiment `q2-iris-classification`. The trained model is registered as `iris-classifier`, with the `champion` alias identifying the selected model version.

The `q2/service.py` application loads the registered model and exposes API endpoints, including `/health` and `/predict`.

The Q2 stack is started using:

`docker compose -f q2/compose.yaml up --build -d`

### 1.6 Monitoring with Prometheus and Grafana

The Q2 model API exposes a `/metrics` endpoint. Prometheus scrapes the `model-service:8000` target every five seconds using the configuration in `q2/monitoring/prometheus.yml`.

Grafana is provisioned with a Prometheus data source and a dashboard defined in `q2/monitoring/dashboard.json`. The dashboard displays monitoring information such as scrape availability, loaded model version, prediction traffic, error ratio, and p95 latency.

Prediction requests can be generated to populate the dashboard and demonstrate how application activity is reflected in monitoring metrics.

**Workflow scope:** The current GitHub Actions workflow automates the root QuickBite application deployment. The Q2 MLflow, model API, Prometheus, and Grafana services are demonstrated separately through the Q2 Docker Compose configuration. The Q2 stack is not represented as an additional GitHub Actions job.

## 2. Execution Evidence

| Pipeline area | Evidence and result |
|---|---|
| Automated tests | The local test run reported 26 tests passed and 0 failed. |
| Git and GitHub | Git history records the CI/CD workflow, Docker Compose deployment, Q2 MLflow and monitoring implementation, and Q3 documentation. |
| GitHub Actions | The recorded workflow run completed successfully: [GitHub Actions Run #2](https://github.com/Overpowered21/quickbite/actions/runs/37823879253). |
| QuickBite deployment | The successful workflow run verifies the Docker Compose build and startup, HTTP check on port 3000, deployment status, and cleanup. |
| MLflow lifecycle | The Q2 stack ran locally. The MLflow interface showed experiment runs and the registered `iris-classifier` model version. The training container completed successfully. |
| Prometheus monitoring | The Prometheus Targets page showed the `model-service` target as UP. |
| Grafana monitoring | After prediction requests were generated, the Grafana dashboard displayed monitoring graphs. Screenshots were captured for the MLflow experiment, model registry, Prometheus target status, and Grafana dashboard. |

The GitHub Actions execution verifies the automated QuickBite CI/CD workflow. The local Q2 execution and screenshots provide separate evidence for model lifecycle and monitoring.

## 3. Demonstration Commands

Run the following commands from the project root.

### QuickBite application

```bash
npm test
docker compose up --build -d
docker compose ps
```

Verify the application at:

`http://localhost:3000`

Stop the root application when finished:

```bash
docker compose down
```

### Q2 model lifecycle and monitoring

Start the Q2 services:

```bash
docker compose -f q2/compose.yaml up --build -d
docker compose -f q2/compose.yaml ps -a
docker compose -f q2/compose.yaml logs train model-service
```

Check model API health:

```bash
curl -fsS http://localhost:8000/health
```

Submit a sample prediction:

```bash
curl -fsS http://localhost:8000/predict -H "Content-Type: application/json" -d "{\"features\":[5.1,3.5,1.4,0.2]}"
```

### Q2 service URLs

- MLflow: `http://localhost:5000`
- Model API documentation: `http://localhost:8000/docs`
- Prometheus: `http://localhost:9091`
- Grafana: `http://localhost:3001`

Prometheus uses host port 9091 in the current local setup because port 9090 was already occupied by another project.

## 4. Conclusion

The QuickBite project demonstrates an end-to-end DevOps workflow connecting Agile planning, Git-based version control, automated testing, GitHub Actions, Docker Compose deployment, MLflow model lifecycle management, and Prometheus/Grafana monitoring.

The successful GitHub Actions run provides evidence of the automated QuickBite CI/CD pipeline, while the local Q2 execution and captured screenshots demonstrate the model lifecycle and monitoring stack. Together, these components show how application changes can be tested and deployed, while service performance and model activity can be monitored for future improvements.