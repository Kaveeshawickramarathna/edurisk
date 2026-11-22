const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userRes = await db.query(
      'SELECT id, email, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      return res.status(401).json({ error: 'Invalid or inactive user session' });
    }

    const user = userRes.rows[0];
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    if (user.role === 'STUDENT') {
      const stuRes = await db.query(
        'SELECT id, student_identifier, first_name, last_name, major, year_of_study FROM students WHERE user_id = $1',
        [user.id]
      );
      if (stuRes.rows[0]) {
        req.user.studentId = stuRes.rows[0].id;
        req.user.profile = stuRes.rows[0];
      }
    } else if (user.role === 'LECTURER') {
      const lecRes = await db.query(
        'SELECT id, employee_id, first_name, last_name, department FROM lecturers WHERE user_id = $1',
        [user.id]
      );
      if (lecRes.rows[0]) {
        req.user.lecturerId = lecRes.rows[0].id;
        req.user.profile = lecRes.rows[0];
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
      });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles,
};
