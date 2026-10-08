"""Serve the registered champion model and expose Prometheus HTTP metrics."""

from contextlib import asynccontextmanager
import os
from time import perf_counter
from typing import Annotated

from fastapi import FastAPI, Request, Response
import mlflow
from mlflow import MlflowClient
import pandas as pd
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from pydantic import BaseModel, Field


REQUESTS = Counter(
    "model_http_requests_total", "Model API HTTP requests", ["method", "route", "status_code"]
)
LATENCY = Histogram(
    "model_http_request_duration_seconds", "Model API HTTP latency", ["method", "route"]
)
MODEL_LOADED = Gauge(
    "model_loaded", "Whether a registered model version is loaded", ["model_name", "version"]
)
FEATURE_NAMES = ["sepal_length", "sepal_width", "petal_length", "petal_width"]
SPECIES = ["setosa", "versicolor", "virginica"]


@asynccontextmanager
async def lifespan(app):
    mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "http://127.0.0.1:5000"))
    model_name = os.getenv("MODEL_NAME", "iris-classifier")
    version = MlflowClient().get_model_version_by_alias(model_name, "champion").version
    app.state.model = mlflow.pyfunc.load_model(f"models:/{model_name}/{version}")
    app.state.model_name = model_name
    app.state.model_version = version
    loaded = MODEL_LOADED.labels(model_name=model_name, version=version)
    loaded.set(1)
    try:
        yield
    finally:
        loaded.set(0)


app = FastAPI(title="Assignment 2 Q2 — Iris model", lifespan=lifespan)


@app.middleware("http")
async def record_metrics(request: Request, call_next):
    # Do not count Prometheus scrapes as application traffic.
    if request.url.path == "/metrics":
        return await call_next(request)
    start = perf_counter()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        matched_route = request.scope.get("route")
        route = matched_route.path if matched_route else "unmatched"
        REQUESTS.labels(request.method, route, str(status)).inc()
        LATENCY.labels(request.method, route).observe(perf_counter() - start)


class PredictionRequest(BaseModel):
    features: list[Annotated[float, Field(gt=0, allow_inf_nan=False)]] = Field(
        min_length=4,
        max_length=4,
        description="Sepal length, sepal width, petal length, petal width in centimeters",
        examples=[[5.1, 3.5, 1.4, 0.2]],
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_name": app.state.model_name,
        "model_version": app.state.model_version,
    }


@app.post("/predict")
def predict(body: PredictionRequest):
    frame = pd.DataFrame([body.features], columns=FEATURE_NAMES)
    prediction = int(app.state.model.predict(frame)[0])
    return {
        "prediction": prediction,
        "species": SPECIES[prediction],
        "model_version": app.state.model_version,
    }


@app.get("/metrics", include_in_schema=False)
def metrics():
    return Response(generate_latest(), headers={"Content-Type": CONTENT_TYPE_LATEST})
