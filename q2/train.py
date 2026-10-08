"""Train, track, and register a small Iris classifier for Assignment 2 Q2."""

import argparse
import json
import math
import os

import mlflow
import mlflow.sklearn
from mlflow import MlflowClient
from mlflow.models import infer_signature
from sklearn.datasets import load_iris
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--c", type=float, default=1.0, help="Logistic regression C")
    args = parser.parse_args()
    if not math.isfinite(args.c) or args.c <= 0:
        parser.error("--c must be a finite positive number")

    mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "http://127.0.0.1:5000"))
    mlflow.set_experiment("q2-iris-classification")
    model_name = os.getenv("MODEL_NAME", "iris-classifier")

    iris = load_iris(as_frame=True)
    features = iris.data.set_axis(
        ["sepal_length", "sepal_width", "petal_length", "petal_width"], axis=1
    )
    x_train, x_test, y_train, y_test = train_test_split(
        features, iris.target, test_size=0.2, random_state=42, stratify=iris.target
    )
    model = make_pipeline(
        StandardScaler(), LogisticRegression(C=args.c, max_iter=200, random_state=42)
    )

    with mlflow.start_run(run_name="logistic-regression") as run:
        mlflow.log_params(
            {
                "model_type": "LogisticRegression",
                "C": args.c,
                "max_iter": 200,
                "random_state": 42,
                "test_size": 0.2,
                "train_rows": len(x_train),
                "test_rows": len(x_test),
                "scaler": "StandardScaler",
            }
        )
        mlflow.set_tags({"dataset": "sklearn.datasets.load_iris", "assignment": "2-Q2"})
        model.fit(x_train, y_train)
        predictions = model.predict(x_test)
        metrics = {
            "train_accuracy": accuracy_score(y_train, model.predict(x_train)),
            "test_accuracy": accuracy_score(y_test, predictions),
            "test_f1_macro": f1_score(y_test, predictions, average="macro"),
        }
        mlflow.log_metrics(metrics)
        artifact = mlflow.sklearn.log_model(
            model,
            artifact_path="model",
            signature=infer_signature(x_train, model.predict(x_train)),
            input_example=x_train.iloc[:3],
        )

    version = mlflow.register_model(artifact.model_uri, model_name)
    client = MlflowClient()
    client.set_model_version_tag(model_name, version.version, "assignment", "2-Q2")
    client.set_registered_model_alias(model_name, "champion", version.version)
    print(
        json.dumps(
            {
                "run_id": run.info.run_id,
                "model_name": model_name,
                "model_version": version.version,
                "alias": "champion",
                "metrics": metrics,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
