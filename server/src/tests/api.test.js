/**
 * EduRisk Backend API, Database & RBAC Verification Suite
 * Tests:
 * 1. Health endpoint & DB connectivity
 * 2. Authentication (Admin, Lecturer, Student logins + invalid credentials)
 * 3. RBAC enforcement (Student blocked from Admin/Lecturer endpoints, Lecturer blocked from Admin/unassigned students)
 * 4. Student management & filtering
 * 5. Academic record validation & updating + prediction persistence
 * 6. Intervention creation & status workflow
 * 7. Dashboard analytics & CSV report export
 * 8. Admin user/course/settings management
 */

process.env.DB_MODE = 'pglite';
process.env.PGLITE_DATA_DIR = 'memory://';
process.env.EMAIL_PROVIDER = 'demo';

const assert = require('assert');
const http = require('http');
const { app, bootstrap } = require('../index');
const db = require('../config/db');

async function request(baseUrl, path, { method = 'GET', token = null, body = null } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, data, headers: res.headers };
}

async function run() {
  await bootstrap({ seedDemo: true });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Health
    const health = await request(baseUrl, '/api/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.data.status, 'success');

    // 2. Auth tests
    const badLogin = await request(baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'admin@edurisk.com', password: 'wrongpassword' },
    });
    assert.strictEqual(badLogin.status, 401);

    const adminLogin = await request(baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'admin@edurisk.com', password: 'password123' },
    });
    assert.strictEqual(adminLogin.status, 200);
    const adminToken = adminLogin.data.token;

    const lecturerLogin = await request(baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'lecturer@edurisk.com', password: 'password123' },
    });
    assert.strictEqual(lecturerLogin.status, 200);
    const lecturerToken = lecturerLogin.data.token;

    const studentLogin = await request(baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'student@edurisk.com', password: 'password123' },
    });
    assert.strictEqual(studentLogin.status, 200);
    const studentToken = studentLogin.data.token;

    // /auth/me check
    const meRes = await request(baseUrl, '/api/v1/auth/me', { token: studentToken });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.user.role, 'STUDENT');
    assert.strictEqual(meRes.data.user.profile.student_identifier, 'STU1001');

    // 3. RBAC enforcement
    const unauth = await request(baseUrl, '/api/v1/students');
    assert.strictEqual(unauth.status, 401);

    const stuBlockedUsers = await request(baseUrl, '/api/v1/users', { token: studentToken });
    assert.strictEqual(stuBlockedUsers.status, 403);

    const stuBlockedList = await request(baseUrl, '/api/v1/students', { token: studentToken });
    assert.strictEqual(stuBlockedList.status, 403);

    const lecBlockedUsers = await request(baseUrl, '/api/v1/users', { token: lecturerToken });
    assert.strictEqual(lecBlockedUsers.status, 403);

    // 4. Student listing & scoping
    const adminStudents = await request(baseUrl, '/api/v1/students', { token: adminToken });
    assert.strictEqual(adminStudents.status, 200);
    assert.strictEqual(adminStudents.data.students.length, 18);

    const lecStudents = await request(baseUrl, '/api/v1/students', { token: lecturerToken });
    assert.strictEqual(lecStudents.status, 200);
    assert(lecStudents.data.students.length > 0 && lecStudents.data.students.length < 18, 'Lecturer should only see enrolled students');

    const highRiskFiltered = await request(baseUrl, '/api/v1/students?riskLevel=HIGH', { token: adminToken });
    assert.strictEqual(highRiskFiltered.status, 200);
    assert(highRiskFiltered.data.students.every((s) => s.risk_level === 'HIGH'));

    // 5. Student self view
    const studentMe = await request(baseUrl, '/api/v1/students/me', { token: studentToken });
    assert.strictEqual(studentMe.status, 200);
    assert(studentMe.data.academicRecords.length >= 1);
    assert(studentMe.data.latestPrediction !== null);

    // 6. Academic record validation & update
    const enrollmentId = studentMe.data.academicRecords[0].enrollment_id;
    const badRecord = await request(baseUrl, `/api/v1/academic-records/${enrollmentId}`, {
      method: 'PUT',
      token: lecturerToken,
      body: {
        attendance_percentage: 150,
        assignment_score: 70,
        quiz_score: 70,
        previous_gpa: 3.0,
        missed_submissions: 0,
        lms_activity_score: 70,
      },
    });
    assert.strictEqual(badRecord.status, 400);

    const goodRecord = await request(baseUrl, `/api/v1/academic-records/${enrollmentId}`, {
      method: 'PUT',
      token: lecturerToken,
      body: {
        attendance_percentage: 82,
        assignment_score: 79,
        quiz_score: 74,
        previous_gpa: 3.1,
        missed_submissions: 1,
        lms_activity_score: 76,
        notes: 'Improved after advising',
        autoPredict: true,
      },
    });
    assert.strictEqual(goodRecord.status, 200);
    assert(goodRecord.data.prediction !== null);

    // 7. Intervention workflow
    const studentId = studentMe.data.student.id;
    const newInt = await request(baseUrl, '/api/v1/interventions', {
      method: 'POST',
      token: lecturerToken,
      body: {
        studentId,
        actionType: 'Tutoring Clinic',
        notes: 'Scheduled weekly algorithm practice',
        status: 'PENDING',
        followUpDate: '2026-12-10',
      },
    });
    assert.strictEqual(newInt.status, 201);

    const updInt = await request(baseUrl, `/api/v1/interventions/${newInt.data.intervention.id}`, {
      method: 'PUT',
      token: lecturerToken,
      body: { status: 'COMPLETED' },
    });
    assert.strictEqual(updInt.status, 200);
    assert.strictEqual(updInt.data.intervention.status, 'COMPLETED');

    // 8. Dashboard & CSV Report export
    const dashRes = await request(baseUrl, '/api/v1/dashboard/summary', { token: adminToken });
    assert.strictEqual(dashRes.status, 200);
    assert.strictEqual(dashRes.data.totalStudents, 18);
    assert(dashRes.data.systemCounts.totalUsers >= 21);

    const csvRes = await request(baseUrl, '/api/v1/reports/export', { token: lecturerToken });
    assert.strictEqual(csvRes.status, 200);
    assert(csvRes.data.includes('Student ID,First Name,Last Name'));

    // 9. Admin settings update
    const setRes = await request(baseUrl, '/api/v1/settings', {
      method: 'PUT',
      token: adminToken,
      body: { current_semester: '2026-S2', attendance_warning_threshold: 78 },
    });
    assert.strictEqual(setRes.status, 200);
    assert.strictEqual(Number(setRes.data.settings.attendance_warning_threshold), 78);

    // 10. Student What-If Simulator, Support Request & Password Update
    const simRes = await request(baseUrl, '/api/v1/predictions/simulate', {
      method: 'POST',
      token: studentToken,
      body: {
        attendance_percentage: 92,
        assignment_score: 88,
        quiz_score: 85,
        previous_gpa: 3.6,
        missed_submissions: 0,
        lms_activity_score: 85,
      },
    });
    assert.strictEqual(simRes.status, 200);
    assert.strictEqual(simRes.data.simulation, true);
    assert.strictEqual(simRes.data.prediction.risk_level, 'LOW');

    const reqSupp = await request(baseUrl, '/api/v1/interventions/request', {
      method: 'POST',
      token: studentToken,
      body: {
        topic: 'Exam Prep',
        notes: 'Need guidance on dynamic programming problems',
      },
    });
    assert.strictEqual(reqSupp.status, 201);
    assert(reqSupp.data.intervention.action_type.includes('Exam Prep'));

    const weakPwRes = await request(baseUrl, '/api/v1/auth/change-password', {
      method: 'PUT',
      token: studentToken,
      body: { currentPassword: 'password123', newPassword: 'weak' },
    });
    assert.strictEqual(weakPwRes.status, 400);

    const pwRes = await request(baseUrl, '/api/v1/auth/change-password', {
      method: 'PUT',
      token: studentToken,
      body: { currentPassword: 'password123', newPassword: 'StrongPass@2026' },
    });
    assert.strictEqual(pwRes.status, 200);

    // 11. Lecturer Course Gradebook Bulk Update & Available Students
    const lecCourses = await request(baseUrl, '/api/v1/courses', { token: lecturerToken });
    assert.strictEqual(lecCourses.status, 200);
    assert(lecCourses.data.courses.length >= 1);
    const firstCourseId = lecCourses.data.courses[0].id;

    const availRes = await request(baseUrl, `/api/v1/courses/${firstCourseId}/available-students`, {
      token: lecturerToken,
    });
    assert.strictEqual(availRes.status, 200);
    assert(Array.isArray(availRes.data.students));

    const bulkRes = await request(baseUrl, '/api/v1/academic-records/bulk', {
      method: 'PUT',
      token: lecturerToken,
      body: {
        autoPredict: true,
        records: [
          {
            enrollment_id: enrollmentId,
            attendance_percentage: 86,
            assignment_score: 84,
            quiz_score: 80,
            previous_gpa: 3.2,
            missed_submissions: 0,
            lms_activity_score: 82,
            notes: 'Bulk gradebook update test',
          },
        ],
      },
    });
    assert.strictEqual(bulkRes.status, 200);
    assert.strictEqual(bulkRes.data.updatedCount, 1);

    // 12. Admin Course Roster, User Edit & Student Profile Update
    const rosterRes = await request(baseUrl, `/api/v1/courses/${firstCourseId}/students`, {
      token: adminToken,
    });
    assert.strictEqual(rosterRes.status, 200);
    assert(rosterRes.data.students.length >= 1);

    const updStuRes = await request(baseUrl, `/api/v1/students/${studentId}`, {
      method: 'PUT',
      token: adminToken,
      body: { major: 'Software Engineering', yearOfStudy: 3 },
    });
    assert.strictEqual(updStuRes.status, 200);
    assert.strictEqual(updStuRes.data.student.major, 'Software Engineering');

    // 13. Email OTP Send -> Verify -> Student Self-Registration
    const sendOtpRes = await request(baseUrl, '/api/v1/auth/otp/send', {
      method: 'POST',
      body: { email: 'kavindu.real@gmail.com', studentName: 'Kavindu Perera' },
    });
    assert.strictEqual(sendOtpRes.status, 200);
    assert.strictEqual(sendOtpRes.data.email, 'kavindu.real@gmail.com');
    assert(sendOtpRes.data.demoOtp && sendOtpRes.data.demoOtp.length === 6);

    const badVerify = await request(baseUrl, '/api/v1/auth/otp/verify', {
      method: 'POST',
      body: { email: 'kavindu.real@gmail.com', otpCode: '000000' },
    });
    assert.strictEqual(badVerify.status, 400);

    const goodVerify = await request(baseUrl, '/api/v1/auth/otp/verify', {
      method: 'POST',
      body: { email: 'kavindu.real@gmail.com', otpCode: sendOtpRes.data.demoOtp },
    });
    assert.strictEqual(goodVerify.status, 200);
    assert.strictEqual(goodVerify.data.verified, true);
    assert(goodVerify.data.verificationToken);

    const regStuRes = await request(baseUrl, '/api/v1/auth/register-student', {
      method: 'POST',
      body: {
        firstName: 'Kavindu',
        lastName: 'Perera',
        email: 'kavindu.real@gmail.com',
        password: 'StrongUser@2026',
        verificationToken: goodVerify.data.verificationToken,
        major: 'Computer Science',
        yearOfStudy: 1,
      },
    });
    assert.strictEqual(regStuRes.status, 201);
    assert.strictEqual(regStuRes.data.user.emailVerified, true);
    assert.strictEqual(regStuRes.data.user.email, 'kavindu.real@gmail.com');

    // 14. Forgot Password via Email OTP -> Reset -> Login with New Password
    const resetOtp = await request(baseUrl, '/api/v1/auth/otp/send', {
      method: 'POST',
      body: { email: 'admin@edurisk.com', purpose: 'PASSWORD_RESET' },
    });
    assert.strictEqual(resetOtp.status, 200);

    const resetVerify = await request(baseUrl, '/api/v1/auth/otp/verify', {
      method: 'POST',
      body: { email: 'admin@edurisk.com', otpCode: resetOtp.data.demoOtp },
    });
    assert.strictEqual(resetVerify.status, 200);

    const resetDone = await request(baseUrl, '/api/v1/auth/reset-password', {
      method: 'POST',
      body: {
        email: 'admin@edurisk.com',
        verificationToken: resetVerify.data.verificationToken,
        newPassword: 'ResetAdmin@2026!',
      },
    });
    assert.strictEqual(resetDone.status, 200);

    const relogin = await request(baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'admin@edurisk.com', password: 'ResetAdmin@2026!' },
    });
    assert.strictEqual(relogin.status, 200);

    console.log('ALL BACKEND API, DB & RBAC TESTS PASSED! (14/14 suites)');
  } finally {
    server.close();
    await db.close();
  }
}

run().catch((err) => {
  console.error('TEST FAILURE:', err);
  process.exit(1);
});
