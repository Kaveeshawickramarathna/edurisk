"""Verification tests for the EduRisk ML training pipeline and FastAPI endpoint handlers."""

from pydantic import ValidationError

from main import PredictionRequest, get_model_info, health_check, predict_risk
from train import train_and_evaluate


def run_tests() -> None:
    report = train_and_evaluate()
    assert report["total_samples"] == 1200
    assert len(report["candidate_models"]) == 3
    assert report["selected_model"] in {"Logistic Regression", "Decision Tree", "Random Forest"}
    assert report["selected_model_metrics"]["test_accuracy"] > 0.70
    assert report["selected_model_metrics"]["high_risk_recall"] > 0.70
    assert report["is_demo"] is True

    health = health_check()
    assert health["status"] == "ok"
    assert health["model_loaded"] is True

    info = get_model_info()
    assert len(info["candidate_models"]) == 3
    assert "confusion_matrix" in info["selected_model_metrics"]

    high_body = predict_risk(
        PredictionRequest(
            attendance_percentage=45.0,
            assignment_score=42.0,
            quiz_score=38.0,
            previous_gpa=1.8,
            missed_submissions=6,
            lms_activity_score=25.0,
        )
    )
    assert high_body["risk_level"] == "HIGH"
    assert high_body["is_demo"] is True
    assert len(high_body["contributing_factors"]) == 6
    assert len(high_body["suggested_actions"]) >= 1

    low_body = predict_risk(
        PredictionRequest(
            attendance_percentage=94.0,
            assignment_score=89.0,
            quiz_score=86.0,
            previous_gpa=3.7,
            missed_submissions=0,
            lms_activity_score=88.0,
        )
    )
    assert low_body["risk_level"] == "LOW"

    # Validation check: attendance > 100 must fail
    try:
        PredictionRequest(
            attendance_percentage=150.0,
            assignment_score=80.0,
            quiz_score=80.0,
            previous_gpa=3.0,
            missed_submissions=0,
            lms_activity_score=70.0,
        )
        raise AssertionError("Expected ValidationError for attendance > 100")
    except ValidationError:
        pass

    print("ALL ML TESTS PASSED!")
    print(f"Selected Model: {report['selected_model']}")
    print(f"High-Risk Prediction: {high_body['risk_level']} (prob={high_body['probability']})")
    print(f"Low-Risk Prediction:  {low_body['risk_level']} (prob={low_body['probability']})")


if __name__ == "__main__":
    run_tests()
