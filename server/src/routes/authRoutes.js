const express = require('express');
const router = express.Router();
const { getSetupStatus, register, registerStudentWithOtp, resetPasswordWithOtp, login, me, changePassword } = require('../controllers/authController');
const { sendOtp, verifyOtp } = require('../controllers/otpController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/setup-status', getSetupStatus);
router.post('/register', register);
router.post('/register-student', registerStudentWithOtp);
router.post('/reset-password', resetPasswordWithOtp);
router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);
router.post('/login', login);
router.get('/me', authenticateToken, me);
router.put('/change-password', authenticateToken, changePassword);

module.exports = router;
