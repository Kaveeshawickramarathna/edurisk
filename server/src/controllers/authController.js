const bcrypt = require('bcrypt');
const db = require('../config/db');
const { generateToken } = require('../utils/jwtUtils');
const { validateStrongPassword } = require('../utils/passwordValidator');
const { validateAndConsumeOtpToken } = require('./otpController');

const register = async (req, res) => {
  const { email, password, role = 'STUDENT', firstName, lastName, identifier, major, department, yearOfStudy } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Email, password, firstName, and lastName are required' });
  }
  const pwCheck = validateStrongPassword(password);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.error });
  }
  if (!['STUDENT', 'LECTURER', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const userExists = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await db.withTransaction(async (tx) => {
      const newUser = await tx.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
        [normalizedEmail, passwordHash, role]
      );
      const created = newUser.rows[0];

      if (role === 'STUDENT') {
        const stuIdentifier = identifier || `STU${1000 + created.id}`;
        await tx.query(
          'INSERT INTO students (user_id, student_identifier, first_name, last_name, major, year_of_study) VALUES ($1, $2, $3, $4, $5, $6)',
          [created.id, stuIdentifier, firstName.trim(), lastName.trim(), major || 'Computer Science', Number(yearOfStudy) || 1]
        );
      } else if (role === 'LECTURER') {
        const empId = identifier || `LEC${100 + created.id}`;
        await tx.query(
          'INSERT INTO lecturers (user_id, employee_id, first_name, last_name, department) VALUES ($1, $2, $3, $4, $5)',
          [created.id, empId, firstName.trim(), lastName.trim(), department || 'Computer Science']
        );
      }
      return created;
    });

    const token = generateToken(user);
    res.status(201).json({ message: 'User registered successfully', token, user });
  } catch (error) {
    console.error('Registration Error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Duplicate email or student/employee identifier' });
    }
    res.status(500).json({ error: 'Server error during registration' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account has been deactivated. Contact administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    let profile = null;
    if (user.role === 'STUDENT') {
      const s = await db.query(
        'SELECT id, student_identifier, first_name, last_name, major, year_of_study FROM students WHERE user_id = $1',
        [user.id]
      );
      profile = s.rows[0] || null;
    } else if (user.role === 'LECTURER') {
      const l = await db.query(
        'SELECT id, employee_id, first_name, last_name, department FROM lecturers WHERE user_id = $1',
        [user.id]
      );
      profile = l.rows[0] || null;
    }

    const token = generateToken(user);
    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile,
      },
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

const me = async (req, res) => {
  res.status(200).json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      studentId: req.user.studentId || null,
      lecturerId: req.user.lecturerId || null,
      profile: req.user.profile || null,
    },
  });
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }
  const pwCheck = validateStrongPassword(newPassword);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.error });
  }

  try {
    const userRes = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const isMatch = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
};

const getSetupStatus = async (req, res) => {
  try {
    const countRes = await db.query('SELECT COUNT(*)::int AS total_users FROM users');
    const adminRes = await db.query("SELECT COUNT(*)::int AS admin_count FROM users WHERE role = 'ADMIN'");
    const totalUsers = countRes.rows[0].total_users;
    const hasAdmin = adminRes.rows[0].admin_count > 0;
    res.json({
      totalUsers,
      hasAdmin,
      needsInitialAdmin: !hasAdmin,
    });
  } catch (err) {
    console.error('getSetupStatus error:', err);
    res.status(500).json({ error: 'Failed to check setup status' });
  }
};

const registerStudentWithOtp = async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    password,
    verificationToken,
    role = 'STUDENT',
    major = 'Computer Science',
    yearOfStudy = 1,
    studentIdentifier = '',
    department = 'Computer Science',
    employeeId = '',
  } = req.body;

  if (!firstName || !lastName || !email || !password || !verificationToken) {
    return res.status(400).json({
      error: 'First name, last name, verified email OTP, and password are required',
    });
  }
  const requestedRole = String(role || 'STUDENT').toUpperCase();
  if (!['STUDENT', 'LECTURER'].includes(requestedRole)) {
    return res.status(400).json({ error: 'Role must be STUDENT or LECTURER' });
  }
  const pwCheck = validateStrongPassword(password);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.error });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const userExists = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { user, profile, assignedRole } = await db.withTransaction(async (tx) => {
      const verifiedEmail = await validateAndConsumeOtpToken(tx, normalizedEmail, verificationToken);
      if (!verifiedEmail) {
        const err = new Error('Email OTP verification is invalid or expired. Please verify your email again.');
        err.statusCode = 400;
        throw err;
      }

      // If no Admin exists yet, the very first verified user becomes System Administrator
      const adminCheck = await tx.query("SELECT COUNT(*)::int AS admin_count FROM users WHERE role = 'ADMIN'");
      const roleToAssign = adminCheck.rows[0].admin_count === 0 ? 'ADMIN' : requestedRole;

      const newUser = await tx.query(
        `INSERT INTO users (email, password_hash, role, email_verified)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, email, role, email_verified`,
        [verifiedEmail, passwordHash, roleToAssign]
      );
      const createdUser = newUser.rows[0];

      let createdProfile = null;
      if (roleToAssign === 'STUDENT') {
        const stuCode = (studentIdentifier && studentIdentifier.trim()) || `STU${1000 + createdUser.id}`;
        const stuRes = await tx.query(
          `INSERT INTO students (
             user_id, student_identifier, first_name, last_name, major, year_of_study
           ) VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, student_identifier, first_name, last_name, major, year_of_study`,
          [
            createdUser.id,
            stuCode,
            firstName.trim(),
            lastName.trim(),
            major || 'Computer Science',
            Number(yearOfStudy) || 1,
          ]
        );
        createdProfile = stuRes.rows[0];
      } else if (roleToAssign === 'LECTURER') {
        const empCode = (employeeId && employeeId.trim()) || `LEC${100 + createdUser.id}`;
        const lecRes = await tx.query(
          `INSERT INTO lecturers (
             user_id, employee_id, first_name, last_name, department
           ) VALUES ($1, $2, $3, $4, $5)
           RETURNING id, employee_id, first_name, last_name, department`,
          [
            createdUser.id,
            empCode,
            firstName.trim(),
            lastName.trim(),
            department || 'Computer Science',
          ]
        );
        createdProfile = lecRes.rows[0];
      } else {
        createdProfile = {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        };
      }

      return { user: createdUser, profile: createdProfile, assignedRole: roleToAssign };
    });

    const token = generateToken(user);
    res.status(201).json({
      message:
        assignedRole === 'ADMIN'
          ? 'Initial Administrator account created and verified successfully!'
          : assignedRole === 'LECTURER'
          ? 'Lecturer account registered and verified successfully!'
          : 'Student registered and email verified successfully!',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: true,
        studentId: assignedRole === 'STUDENT' ? profile.id : null,
        lecturerId: assignedRole === 'LECTURER' ? profile.id : null,
        profile,
      },
    });
  } catch (err) {
    console.error('registerStudentWithOtp error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email or student/employee ID already exists' });
    }
    res.status(err.statusCode || 500).json({ error: err.message || 'Registration failed' });
  }
};

const resetPasswordWithOtp = async (req, res) => {
  const { email, verificationToken, newPassword } = req.body;
  if (!email || !verificationToken || !newPassword) {
    return res.status(400).json({ error: 'Email, verified OTP token, and new password are required' });
  }

  const pwCheck = validateStrongPassword(newPassword);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.error });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const newHash = await bcrypt.hash(newPassword, 10);

    await db.withTransaction(async (tx) => {
      const verifiedEmail = await validateAndConsumeOtpToken(tx, normalizedEmail, verificationToken);
      if (!verifiedEmail) {
        const err = new Error('OTP verification is invalid or expired. Please request a new reset OTP.');
        err.statusCode = 400;
        throw err;
      }

      const upd = await tx.query(
        'UPDATE users SET password_hash = $1, email_verified = TRUE WHERE email = $2 RETURNING id',
        [newHash, verifiedEmail]
      );
      if (upd.rows.length === 0) {
        const err = new Error('Account not found');
        err.statusCode = 404;
        throw err;
      }
    });

    res.json({ message: 'Password reset successfully! You can now sign in with your new password.' });
  } catch (err) {
    console.error('resetPasswordWithOtp error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Password reset failed' });
  }
};

module.exports = {
  getSetupStatus,
  register,
  registerStudentWithOtp,
  resetPasswordWithOtp,
  login,
  me,
  changePassword,
};
