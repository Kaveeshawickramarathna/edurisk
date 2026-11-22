"""
EduRisk Machine Learning Training & Evaluation Pipeline.

Trains and evaluates three candidate classification models (Logistic Regression,
Decision Tree, Random Forest) on a clearly labelled demo synthetic dataset
(or an optional supplied labelled CSV dataset), evaluates them on a stratified
held-out test split, and persists the best-performing model alongside its
evaluation report.

Important transparency notice (Proposal Section 8):
Predictions from models trained on synthetic/demo data are explicitly marked
with `is_demo = True` and serve only as a demonstrable portfolio workflow —
not as a validated clinical/institutional prediction system.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
ARTIFACTS_DIR = BASE_DIR / "artifacts"

FEATURE_COLUMNS = [
    "attendance_percentage",
    "assignment_score",
    "quiz_score",
    "previous_gpa",
    "missed_submissions",
    "lms_activity_score",
]

RISK_LABELS = ["LOW", "MEDIUM", "HIGH"]
LABEL_TO_INT = {label: idx for idx, label in enumerate(RISK_LABELS)}
INT_TO_LABEL = {idx: label for idx, label in enumerate(RISK_LABELS)}


def generate_demo_dataset(n_samples: int = 1200, seed: int = 42) -> pd.DataFrame:
    """
    Generate a reproducible synthetic/demo academic dataset with realistic
    correlations and stochastic noise across LOW, MEDIUM, and HIGH risk cohorts.
    """
    rng = np.random.default_rng(seed)

    # Latent academic engagement factor (0 = struggling, 1 = strong)
    engagement = rng.beta(a=2.2, b=1.8, size=n_samples)

    attendance = np.clip(38 + 60 * engagement + rng.normal(0, 10, n_samples), 15, 100)
    assignment = np.clip(32 + 63 * engagement + rng.normal(0, 11, n_samples), 10, 100)
    quiz = np.clip(28 + 65 * engagement + rng.normal(0, 12, n_samples), 10, 100)
    prev_gpa = np.clip(1.2 + 2.65 * engagement + rng.normal(0, 0.38, n_samples), 0.5, 4.0)
    missed = np.clip(
        np.round(6.5 * (1.0 - engagement) + rng.normal(0, 1.3, n_samples)),
        0,
        12,
    ).astype(int)
    lms_activity = np.clip(20 + 75 * engagement + rng.normal(0, 13, n_samples), 5, 100)

    # Future outcome risk score (with realistic unobserved noise)
    risk_signal = (
        0.28 * (100 - attendance) / 100.0
        + 0.22 * (100 - assignment) / 100.0
        + 0.16 * (100 - quiz) / 100.0
        + 0.16 * (4.0 - prev_gpa) / 4.0
        + 0.10 * (missed / 10.0)
        + 0.08 * (100 - lms_activity) / 100.0
        + rng.normal(0, 0.055, n_samples)
    )

    risk_category = np.where(
        risk_signal >= 0.48,
        "HIGH",
        np.where(risk_signal >= 0.30, "MEDIUM", "LOW"),
    )

    df = pd.DataFrame(
        {
            "attendance_percentage": np.round(attendance, 2),
            "assignment_score": np.round(assignment, 2),
            "quiz_score": np.round(quiz, 2),
            "previous_gpa": np.round(prev_gpa, 2),
            "missed_submissions": missed,
            "lms_activity_score": np.round(lms_activity, 2),
            "risk_category": risk_category,
        }
    )
    return df


def build_candidate_models(seed: int = 42) -> Dict[str, Any]:
    """Candidate models specified in Proposal Section 8."""
    return {
        "Logistic Regression": Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "clf",
                    LogisticRegression(
                        max_iter=1000,
                        class_weight="balanced",
                        random_state=seed,
                    ),
                ),
            ]
        ),
        "Decision Tree": Pipeline(
            [
                (
                    "clf",
                    DecisionTreeClassifier(
                        max_depth=6,
                        min_samples_leaf=8,
                        class_weight="balanced",
                        random_state=seed,
                    ),
                )
            ]
        ),
        "Random Forest": Pipeline(
            [
                (
                    "clf",
                    RandomForestClassifier(
                        n_estimators=150,
                        max_depth=8,
                        min_samples_leaf=5,
                        class_weight="balanced",
                        random_state=seed,
                    ),
                )
            ]
        ),
    }


def extract_feature_importances(pipeline: Pipeline, feature_names: list[str]) -> Dict[str, float]:
    clf = pipeline.named_steps["clf"]
    if hasattr(clf, "feature_importances_"):
        raw = np.asarray(clf.feature_importances_, dtype=float)
    elif hasattr(clf, "coef_"):
        # Mean absolute coefficient magnitude across classes (standardized inputs)
        raw = np.mean(np.abs(clf.coef_), axis=0)
    else:
        raw = np.ones(len(feature_names), dtype=float)

    total = float(raw.sum()) or 1.0
    return {name: round(float(val / total), 4) for name, val in zip(feature_names, raw)}


def train_and_evaluate(dataset_path: Path | None = None, is_demo: bool = True) -> Dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    if dataset_path is not None and dataset_path.exists():
        df = pd.read_csv(dataset_path)
        dataset_source = str(dataset_path.name)
    else:
        df = generate_demo_dataset(n_samples=1200, seed=42)
        demo_csv = DATA_DIR / "demo_academic_dataset.csv"
        df.to_csv(demo_csv, index=False)
        dataset_source = "demo_academic_dataset.csv (synthetic demo data)"
        is_demo = True

    missing_cols = [c for c in FEATURE_COLUMNS + ["risk_category"] if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Dataset missing required columns: {missing_cols}")

    X = df[FEATURE_COLUMNS].astype(float)
    y = df["risk_category"].map(LABEL_TO_INT).astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, stratify=y, random_state=42
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    candidates = build_candidate_models(seed=42)

    comparison = []
    fitted_models = {}

    for name, pipeline in candidates.items():
        # 5-fold cross-validation F1-macro on training partition for fair selection
        cv_f1 = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring="f1_macro")

        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)

        acc = float(accuracy_score(y_test, y_pred))
        macro_prec = float(precision_score(y_test, y_pred, average="macro", zero_division=0))
        macro_rec = float(recall_score(y_test, y_pred, average="macro", zero_division=0))
        macro_f1 = float(f1_score(y_test, y_pred, average="macro", zero_division=0))

        cls_report = classification_report(
            y_test, y_pred, target_names=RISK_LABELS, output_dict=True, zero_division=0
        )
        cm = confusion_matrix(y_test, y_pred, labels=[0, 1, 2]).tolist()

        high_recall = float(cls_report["HIGH"]["recall"])
        high_precision = float(cls_report["HIGH"]["precision"])
        high_f1 = float(cls_report["HIGH"]["f1-score"])

        # Selection score balances overall macro-F1 and HIGH-risk recall (Proposal Section 8)
        selection_score = round(0.5 * float(cv_f1.mean()) + 0.5 * high_recall, 4)

        metrics = {
            "model_name": name,
            "cv_macro_f1_mean": round(float(cv_f1.mean()), 4),
            "cv_macro_f1_std": round(float(cv_f1.std()), 4),
            "test_accuracy": round(acc, 4),
            "test_macro_precision": round(macro_prec, 4),
            "test_macro_recall": round(macro_rec, 4),
            "test_macro_f1": round(macro_f1, 4),
            "high_risk_recall": round(high_recall, 4),
            "high_risk_precision": round(high_precision, 4),
            "high_risk_f1": round(high_f1, 4),
            "selection_score": selection_score,
            "confusion_matrix": {
                "labels": RISK_LABELS,
                "matrix": cm,
            },
            "per_class": {
                label: {
                    "precision": round(float(cls_report[label]["precision"]), 4),
                    "recall": round(float(cls_report[label]["recall"]), 4),
                    "f1_score": round(float(cls_report[label]["f1-score"]), 4),
                    "support": int(cls_report[label]["support"]),
                }
                for label in RISK_LABELS
            },
            "feature_importances": extract_feature_importances(pipeline, FEATURE_COLUMNS),
        }
        comparison.append(metrics)
        fitted_models[name] = pipeline

    # Select best candidate by selection_score (baseline preferred on ties)
    comparison.sort(key=lambda m: m["selection_score"], reverse=True)
    best_metrics = comparison[0]
    best_name = best_metrics["model_name"]
    best_pipeline = fitted_models[best_name]

    # Store training feature stats for transparent indicator explanations
    feature_stats = {
        col: {
            "mean": round(float(X_train[col].mean()), 4),
            "std": round(float(X_train[col].std() or 1.0), 4),
            "min": round(float(X_train[col].min()), 4),
            "max": round(float(X_train[col].max()), 4),
        }
        for col in FEATURE_COLUMNS
    }

    class_distribution = {
        label: int((df["risk_category"] == label).sum()) for label in RISK_LABELS
    }

    report = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "is_demo": is_demo,
        "dataset_source": dataset_source,
        "total_samples": int(len(df)),
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "class_distribution": class_distribution,
        "features": FEATURE_COLUMNS,
        "selected_model": best_name,
        "selection_criterion": "Balanced 5-fold CV Macro-F1 (50%) and Held-out High-Risk Recall (50%)",
        "selected_model_metrics": best_metrics,
        "candidate_models": comparison,
        "disclaimer": (
            "DEMO MODEL NOTICE: Trained on synthetic demo academic records for portfolio and workflow demonstration. "
            "Risk categories are decision-support indicators associated with recorded features, not causal proof or final academic judgments."
            if is_demo
            else "Decision-support model evaluated on held-out labelled test data. Indicators reflect statistical associations, not proof of causation."
        ),
    }

    bundle = {
        "model": best_pipeline,
        "model_name": best_name,
        "features": FEATURE_COLUMNS,
        "risk_labels": RISK_LABELS,
        "feature_importances": best_metrics["feature_importances"],
        "feature_stats": feature_stats,
        "is_demo": is_demo,
        "trained_at": report["trained_at"],
    }

    joblib.dump(bundle, ARTIFACTS_DIR / "model_bundle.joblib")
    with open(ARTIFACTS_DIR / "evaluation_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and evaluate EduRisk candidate ML models.")
    parser.add_argument(
        "--dataset",
        type=str,
        default=None,
        help="Optional path to a labelled CSV dataset containing required features and risk_category.",
    )
    parser.add_argument(
        "--validated",
        action="store_true",
        help="Mark model as trained on a validated external dataset (sets is_demo=False).",
    )
    args = parser.parse_args()

    dataset_path = Path(args.dataset) if args.dataset else None
    report = train_and_evaluate(dataset_path=dataset_path, is_demo=not args.validated)

    print(f"\n=== EduRisk ML Training Complete ({report['dataset_source']}) ===")
    print(f"Samples: {report['total_samples']} (Train: {report['train_samples']}, Test: {report['test_samples']})")
    print(f"Selected Model: {report['selected_model']} (is_demo={report['is_demo']})\n")
    for m in report["candidate_models"]:
        print(
            f"  - {m['model_name']:20s} | Acc: {m['test_accuracy']:.3f} | "
            f"Macro-F1: {m['test_macro_f1']:.3f} | High-Risk Recall: {m['high_risk_recall']:.3f} | "
            f"Score: {m['selection_score']:.3f}"
        )


if __name__ == "__main__":
    main()
