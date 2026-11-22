"""
EduRisk FastAPI Machine Learning Service.

Exposes:
- GET  /health      Service & model readiness check
- GET  /model-info  Candidate model comparison, held-out metrics & demo transparency notice
- POST /predict     Academic risk estimation with non-causal indicator explanations & support actions
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import List, Dict, Any

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from train import FEATURE_COLUMNS, RISK_LABELS, train_and_evaluate

BASE_DIR = Path(__file__).resolve().parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "model_bundle.joblib"
REPORT_PATH = ARTIFACTS_DIR / "evaluation_report.json"

app = FastAPI(
    title="EduRisk ML Service",
    description="Academic Risk Prediction & Non-Causal Indicator Explanation API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_bundle: Dict[str, Any] | None = None
evaluation_report: Dict[str, Any] | None = None


def ensure_artifacts_loaded() -> None:
    global model_bundle, evaluation_report
    if not MODEL_PATH.exists() or not REPORT_PATH.exists():
        train_and_evaluate()
    model_bundle = joblib.load(MODEL_PATH)
    with open(REPORT_PATH, "r", encoding="utf-8") as f:
        evaluation_report = json.load(f)


ensure_artifacts_loaded()


class PredictionRequest(BaseModel):
    attendance_percentage: float = Field(..., ge=0, le=100, description="Attendance percentage (0-100)")
    assignment_score: float = Field(..., ge=0, le=100, description="Average assignment score (0-100)")
    quiz_score: float = Field(..., ge=0, le=100, description="Average quiz score (0-100)")
    previous_gpa: float = Field(..., ge=0, le=4.0, description="Previous semester GPA (0.0-4.0)")
    missed_submissions: int = Field(..., ge=0, le=50, description="Count of missed or late submissions")
    lms_activity_score: float = Field(..., ge=0, le=100, description="LMS engagement score (0-100)")


INDICATOR_CONFIG = {
    "attendance_percentage": {
        "label": "Attendance Percentage",
        "benchmark": 75.0,
        "higher_is_better": True,
        "unit": "%",
        "low_action": {
            "category": "Attendance Support",
            "title": "Schedule an attendance check-in with academic advisor",
            "description": "Discuss any scheduling, health, or personal barriers affecting class participation and agree on a weekly attendance goal.",
            "priority": "HIGH",
        },
    },
    "assignment_score": {
        "label": "Assignment Performance",
        "benchmark": 65.0,
        "higher_is_better": True,
        "unit": "%",
        "low_action": {
            "category": "Academic Tutoring",
            "title": "Enroll in course tutoring or assignment feedback clinic",
            "description": "Review rubric expectations and past assignment feedback with the module tutor before the next submission.",
            "priority": "HIGH",
        },
    },
    "quiz_score": {
        "label": "Quiz Performance",
        "benchmark": 60.0,
        "higher_is_better": True,
        "unit": "%",
        "low_action": {
            "category": "Study Strategy",
            "title": "Join a peer study group & weekly concept review",
            "description": "Practice short weekly self-quizzes to strengthen foundational concepts ahead of mid-term assessments.",
            "priority": "MEDIUM",
        },
    },
    "previous_gpa": {
        "label": "Previous Semester GPA",
        "benchmark": 2.5,
        "higher_is_better": True,
        "unit": "GPA",
        "low_action": {
            "category": "Academic Planning",
            "title": "Review semester study load & learning plan",
            "description": "Meet with a lecturer or advisor to prioritize core modules and build a structured weekly study timetable.",
            "priority": "MEDIUM",
        },
    },
    "missed_submissions": {
        "label": "Missed / Late Submissions",
        "benchmark": 2.0,
        "higher_is_better": False,
        "unit": "tasks",
        "low_action": {
            "category": "Time Management",
            "title": "Set milestone reminders & deadline recovery plan",
            "description": "Break upcoming coursework into smaller milestones and coordinate with lecturers regarding any overdue tasks.",
            "priority": "HIGH",
        },
    },
    "lms_activity_score": {
        "label": "LMS Engagement",
        "benchmark": 55.0,
        "higher_is_better": True,
        "unit": "/100",
        "low_action": {
            "category": "Digital Engagement",
            "title": "Increase regular weekly LMS material review",
            "description": "Set two dedicated sessions per week to review lecture slides, recorded sessions, and discussion boards.",
            "priority": "LOW",
        },
    },
}


def build_explanations_and_actions(
    payload: PredictionRequest,
    feature_importances: Dict[str, float],
    risk_level: str,
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]], str]:
    values = payload.model_dump()
    indicators = []
    suggested_actions = []

    for feature in FEATURE_COLUMNS:
        cfg = INDICATOR_CONFIG[feature]
        val = float(values[feature])
        benchmark = cfg["benchmark"]
        weight = float(feature_importances.get(feature, 1.0 / len(FEATURE_COLUMNS)))

        if cfg["higher_is_better"]:
            # Deficit relative to benchmark (positive means below benchmark -> risk-associated)
            deficit = max(0.0, (benchmark - val) / max(benchmark, 1e-6))
            status = "CONCERN" if val < benchmark else "HEALTHY"
            direction = "RISK_INCREASING" if val < benchmark else "PROTECTIVE"
            comparison_text = (
                f"Below benchmark ({benchmark}{cfg['unit']})"
                if val < benchmark
                else f"At or above benchmark ({benchmark}{cfg['unit']})"
            )
        else:
            deficit = max(0.0, (val - benchmark) / max(benchmark, 1.0))
            status = "CONCERN" if val > benchmark else "HEALTHY"
            direction = "RISK_INCREASING" if val > benchmark else "PROTECTIVE"
            comparison_text = (
                f"Above threshold ({int(benchmark)} {cfg['unit']})"
                if val > benchmark
                else f"Within expected threshold (<= {int(benchmark)} {cfg['unit']})"
            )

        association_score = round(min(1.0, weight * (0.35 + 1.4 * deficit)), 4)

        indicators.append(
            {
                "feature": feature,
                "label": cfg["label"],
                "value": round(val, 2),
                "unit": cfg["unit"],
                "benchmark": benchmark,
                "model_weight": round(weight, 4),
                "association_score": association_score,
                "direction": direction,
                "status": status,
                "note": comparison_text,
            }
        )

        if status == "CONCERN":
            suggested_actions.append(
                {
                    "indicator": cfg["label"],
                    **cfg["low_action"],
                }
            )

    # Sort indicators so strongest risk-associated signals appear first
    indicators.sort(
        key=lambda item: (item["status"] == "CONCERN", item["association_score"]),
        reverse=True,
    )

    concern_labels = [i["label"] for i in indicators if i["status"] == "CONCERN"][:3]
    if concern_labels:
        joined = ", ".join(concern_labels)
        summary = (
            f"Estimated {risk_level} risk indicator is primarily associated with: {joined}. "
            "These metrics reflect statistical associations in available records and are intended for human review rather than proof of cause."
        )
    else:
        summary = (
            f"Estimated {risk_level} risk indicator: all tracked academic indicators currently meet or exceed reference benchmarks. "
            "Continue routine monitoring and encourage consistent study habits."
        )

    if not suggested_actions:
        suggested_actions.append(
            {
                "indicator": "Overall Progress",
                "category": "Positive Reinforcement",
                "title": "Maintain current study routine",
                "description": "Academic indicators are currently on track. Encourage continued participation and optional enrichment opportunities.",
                "priority": "LOW",
            }
        )

    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    suggested_actions.sort(key=lambda a: priority_order.get(a["priority"], 2))

    return indicators, suggested_actions, summary


@app.get("/health")
def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "EduRisk ML Service",
        "model_loaded": model_bundle is not None,
        "selected_model": model_bundle["model_name"] if model_bundle else None,
        "is_demo": model_bundle["is_demo"] if model_bundle else True,
    }


@app.get("/model-info")
def get_model_info() -> Dict[str, Any]:
    if evaluation_report is None:
        raise HTTPException(status_code=503, detail="Model evaluation report unavailable")
    return evaluation_report


@app.post("/predict")
def predict_risk(payload: PredictionRequest) -> Dict[str, Any]:
    if model_bundle is None:
        raise HTTPException(status_code=503, detail="ML model is not loaded")

    model = model_bundle["model"]
    features_df = pd.DataFrame(
        [[getattr(payload, col) for col in FEATURE_COLUMNS]],
        columns=FEATURE_COLUMNS,
    )

    probs = model.predict_proba(features_df)[0]
    pred_idx = int(probs.argmax())
    risk_level = RISK_LABELS[pred_idx]

    class_probabilities = {
        label: round(float(probs[idx]), 4) for idx, label in enumerate(RISK_LABELS)
    }
    # Combined probability of elevated risk (HIGH + 0.5 * MEDIUM) or top-class confidence
    elevated_risk_prob = round(
        float(min(1.0, probs[2] + 0.5 * probs[1])),
        4,
    )

    indicators, suggested_actions, summary = build_explanations_and_actions(
        payload=payload,
        feature_importances=model_bundle["feature_importances"],
        risk_level=risk_level,
    )

    return {
        "risk_level": risk_level,
        "probability": elevated_risk_prob,
        "predicted_class_confidence": round(float(probs[pred_idx]), 4),
        "class_probabilities": class_probabilities,
        "contributing_factors": indicators,
        "suggested_actions": suggested_actions,
        "explanation_summary": summary,
        "model_name": model_bundle["model_name"],
        "is_demo": bool(model_bundle["is_demo"]),
        "disclaimer": (
            "Demo prediction trained on synthetic academic data — intended solely as a decision-support indicator for staff review, not a final judgment."
            if model_bundle["is_demo"]
            else "Decision-support estimate for staff review — indicators represent associations, not proof of causation."
        ),
    }
