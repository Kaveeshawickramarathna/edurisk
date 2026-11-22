const db = require('../config/db');
const { getModelInfo, predictRisk, runAndStoreStudentPrediction } = require('../services/mlService');
const { lecturerCanAccessStudent } = require('./studentController');

const fetchModelInfo = async (req, res) => {
  try {
    const info = await getModelInfo();
    res.json(info);
  } catch (err) {
    console.error('fetchModelInfo error:', err);
    res.status(500).json({ error: 'Failed to load ML model information' });
  }
};

const predictForStudent = async (req, res) => {
  const studentId = Number(req.params.studentId);
  try {
    if (req.user.role === 'LECTURER') {
      const allowed = await lecturerCanAccessStudent(req.user.lecturerId, studentId);
      if (!allowed) {
        return res.status(403).json({ error: 'Not authorized to run prediction for this student' });
      }
    }

    const result = await runAndStoreStudentPrediction(studentId, req.user.id);
    res.status(201).json({
      message: 'Risk estimate generated successfully',
      ...result,
    });
  } catch (err) {
    console.error('predictForStudent error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Prediction failed' });
  }
};

const predictBatch = async (req, res) => {
  try {
    let studentQuery = `SELECT DISTINCT s.id FROM students s JOIN enrollments e ON e.student_id = s.id`;
    const params = [];

    if (req.user.role === 'LECTURER') {
      params.push(req.user.lecturerId);
      studentQuery += ` JOIN courses c ON c.id = e.course_id WHERE c.lecturer_id = $1`;
    }

    const studentsRes = await db.query(studentQuery, params);
    const updated = [];
    const failed = [];

    for (const row of studentsRes.rows) {
      try {
        const pred = await runAndStoreStudentPrediction(row.id, req.user.id);
        updated.push({ studentId: row.id, risk_level: pred.prediction.risk_level, probability: pred.prediction.probability });
      } catch (e) {
        failed.push({ studentId: row.id, error: e.message });
      }
    }

    res.json({
      message: `Generated risk estimates for ${updated.length} students`,
      count: updated.length,
      updated,
      failed,
    });
  } catch (err) {
    console.error('predictBatch error:', err);
    res.status(500).json({ error: 'Batch prediction failed' });
  }
};

const simulatePrediction = async (req, res) => {
  const {
    attendance_percentage,
    assignment_score,
    quiz_score,
    previous_gpa,
    missed_submissions,
    lms_activity_score,
  } = req.body;

  const features = {
    attendance_percentage: Number(attendance_percentage),
    assignment_score: Number(assignment_score),
    quiz_score: Number(quiz_score),
    previous_gpa: Number(previous_gpa),
    missed_submissions: Math.round(Number(missed_submissions)),
    lms_activity_score: Number(lms_activity_score),
  };

  if (
    Number.isNaN(features.attendance_percentage) || features.attendance_percentage < 0 || features.attendance_percentage > 100 ||
    Number.isNaN(features.assignment_score) || features.assignment_score < 0 || features.assignment_score > 100 ||
    Number.isNaN(features.quiz_score) || features.quiz_score < 0 || features.quiz_score > 100 ||
    Number.isNaN(features.previous_gpa) || features.previous_gpa < 0 || features.previous_gpa > 4 ||
    Number.isNaN(features.missed_submissions) || features.missed_submissions < 0 || features.missed_submissions > 50 ||
    Number.isNaN(features.lms_activity_score) || features.lms_activity_score < 0 || features.lms_activity_score > 100
  ) {
    return res.status(400).json({ error: 'Invalid academic indicator values provided for simulation' });
  }

  try {
    const result = await predictRisk(features);
    res.json({ simulation: true, features, prediction: result });
  } catch (err) {
    console.error('simulatePrediction error:', err);
    res.status(500).json({ error: 'Simulation failed' });
  }
};

module.exports = {
  fetchModelInfo,
  predictForStudent,
  predictBatch,
  simulatePrediction,
};
