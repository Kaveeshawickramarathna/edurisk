const express = require('express');
const router = express.Router();

const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const userCtrl = require('../controllers/userController');
const courseCtrl = require('../controllers/courseController');
const studentCtrl = require('../controllers/studentController');
const academicCtrl = require('../controllers/academicController');
const predCtrl = require('../controllers/predictionController');
const intCtrl = require('../controllers/interventionController');
const dashCtrl = require('../controllers/dashboardController');

// All routes below require valid JWT
router.use(authenticateToken);

// Users & Lecturers (Admin)
router.get('/users', authorizeRoles('ADMIN'), userCtrl.listUsers);
router.post('/users', authorizeRoles('ADMIN'), userCtrl.createUser);
router.put('/users/:id', authorizeRoles('ADMIN'), userCtrl.updateUser);
router.delete('/users/:id', authorizeRoles('ADMIN'), userCtrl.deleteUser);
router.get('/lecturers', authorizeRoles('ADMIN', 'LECTURER'), userCtrl.listLecturers);

// Courses & Enrollments
router.get('/courses', courseCtrl.listCourses);
router.post('/courses', authorizeRoles('ADMIN'), courseCtrl.createCourse);
router.put('/courses/:id', authorizeRoles('ADMIN'), courseCtrl.updateCourse);
router.delete('/courses/:id', authorizeRoles('ADMIN'), courseCtrl.deleteCourse);
router.get('/courses/:id/students', authorizeRoles('ADMIN', 'LECTURER'), courseCtrl.getCourseStudents);
router.get('/courses/:id/available-students', authorizeRoles('ADMIN', 'LECTURER'), courseCtrl.getAvailableStudentsForCourse);
router.post('/courses/:id/enroll', authorizeRoles('ADMIN', 'LECTURER'), courseCtrl.enrollStudent);
router.delete('/courses/:courseId/enroll/:studentId', authorizeRoles('ADMIN'), courseCtrl.unenrollStudent);

// Students
router.get('/students/me', authorizeRoles('STUDENT'), studentCtrl.getMyStudentProfile);
router.get('/students', authorizeRoles('ADMIN', 'LECTURER'), studentCtrl.listStudents);
router.get('/students/:id', authorizeRoles('ADMIN', 'LECTURER'), studentCtrl.getStudentById);
router.post('/students', authorizeRoles('ADMIN'), studentCtrl.createStudent);
router.put('/students/:id', authorizeRoles('ADMIN'), studentCtrl.updateStudent);
router.delete('/students/:id', authorizeRoles('ADMIN'), studentCtrl.deleteStudent);

// Academic Records
router.get('/academic-records', authorizeRoles('ADMIN', 'LECTURER'), academicCtrl.listAcademicRecords);
router.put('/academic-records/bulk', authorizeRoles('ADMIN', 'LECTURER'), academicCtrl.bulkUpdateAcademicRecords);
router.put('/academic-records/:enrollmentId', authorizeRoles('ADMIN', 'LECTURER'), academicCtrl.updateAcademicRecord);

// ML Predictions
router.get('/predictions/model-info', authorizeRoles('ADMIN', 'LECTURER'), predCtrl.fetchModelInfo);
router.post('/predictions/simulate', predCtrl.simulatePrediction);
router.post('/predictions/student/:studentId', authorizeRoles('ADMIN', 'LECTURER'), predCtrl.predictForStudent);
router.post('/predictions/batch', authorizeRoles('ADMIN', 'LECTURER'), predCtrl.predictBatch);

// Interventions
router.get('/interventions', intCtrl.listInterventions);
router.post('/interventions/request', authorizeRoles('STUDENT'), intCtrl.requestStudentSupport);
router.post('/interventions', authorizeRoles('ADMIN', 'LECTURER'), intCtrl.createIntervention);
router.put('/interventions/:id', authorizeRoles('ADMIN', 'LECTURER'), intCtrl.updateIntervention);
router.delete('/interventions/:id', authorizeRoles('ADMIN', 'LECTURER'), intCtrl.deleteIntervention);

// Dashboard, Reports & Settings
router.get('/dashboard/summary', authorizeRoles('ADMIN', 'LECTURER'), dashCtrl.getDashboardSummary);
router.get('/reports/summary', authorizeRoles('ADMIN', 'LECTURER'), dashCtrl.getReportSummary);
router.get('/reports/export', authorizeRoles('ADMIN', 'LECTURER'), dashCtrl.exportReportCsv);
router.get('/settings', dashCtrl.getSettings);
router.put('/settings', authorizeRoles('ADMIN'), dashCtrl.updateSettings);

module.exports = router;
