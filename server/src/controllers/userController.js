const bcrypt = require('bcrypt');
const db = require('../config/db');
const { validateStrongPassword } = require('../utils/passwordValidator');

const listUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    const conditions = [];
    const params = [];

    if (role && ['ADMIN', 'LECTURER', 'STUDENT'].includes(role)) {
      params.push(role);
      conditions.push(`u.role = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      const idx = params.length;
      conditions.push(`(
        LOWER(u.email) LIKE $${idx}
        OR LOWER(COALESCE(s.first_name, l.first_name, '')) LIKE $${idx}
        OR LOWER(COALESCE(s.last_name, l.last_name, '')) LIKE $${idx}
        OR LOWER(COALESCE(s.student_identifier, l.employee_id, '')) LIKE $${idx}
      )`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT
         u.id, u.email, u.role, u.is_active, u.created_at,
         s.id AS student_id, s.student_identifier, s.major, s.year_of_study,
         l.id AS lecturer_id, l.employee_id, l.department,
         COALESCE(s.first_name, l.first_name, 'System') AS first_name,
         COALESCE(s.last_name, l.last_name, 'Administrator') AS last_name
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       LEFT JOIN lecturers l ON l.user_id = u.id
       ${whereClause}
       ORDER BY u.created_at DESC, u.id DESC`,
      params
    );

    res.json({ users: result.rows });
  } catch (err) {
    console.error('listUsers error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
};

const listLecturers = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true' && req.user?.role === 'ADMIN';
    const whereClause = includeInactive ? '' : 'WHERE u.is_active = TRUE';

    const result = await db.query(
      `SELECT
         l.id, l.user_id, l.employee_id, l.first_name, l.last_name, l.department, l.created_at,
         u.email, u.is_active,
         COALESCE(
           json_agg(DISTINCT jsonb_build_object('id', c.id, 'code', c.code, 'name', c.name))
           FILTER (WHERE c.id IS NOT NULL),
           '[]'::json
         ) AS courses,
         COUNT(DISTINCT c.id)::int AS course_count,
         COUNT(DISTINCT e.student_id)::int AS student_count,
         (SELECT COUNT(*)::int FROM interventions i WHERE i.lecturer_id = l.id) AS intervention_count
       FROM lecturers l
       JOIN users u ON u.id = l.user_id
       LEFT JOIN courses c ON c.lecturer_id = l.id
       LEFT JOIN enrollments e ON e.course_id = c.id
       ${whereClause}
       GROUP BY l.id, u.email, u.is_active
       ORDER BY l.first_name ASC, l.last_name ASC`
    );
    res.json({ lecturers: result.rows });
  } catch (err) {
    console.error('listLecturers error:', err);
    res.status(500).json({ error: 'Failed to load lecturers' });
  }
};

const createUser = async (req, res) => {
  const {
    email,
    password,
    role,
    firstName,
    lastName,
    identifier,
    major,
    yearOfStudy,
    department,
  } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }
  if (!['ADMIN', 'LECTURER', 'STUDENT'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role specified' });
  }
  const pwCheck = validateStrongPassword(password);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.error });
  }
  if (role !== 'ADMIN' && (!firstName || !lastName)) {
    return res.status(400).json({ error: 'First name and last name are required for Students and Lecturers' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const exists = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await db.withTransaction(async (tx) => {
      const uRes = await tx.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, is_active, created_at',
        [normalizedEmail, passwordHash, role]
      );
      const user = uRes.rows[0];

      if (role === 'STUDENT') {
        const stuCode = (identifier && identifier.trim()) || `STU${1000 + user.id}`;
        await tx.query(
          `INSERT INTO students (user_id, student_identifier, first_name, last_name, major, year_of_study)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [user.id, stuCode, firstName.trim(), lastName.trim(), major || 'Computer Science', Number(yearOfStudy) || 1]
        );
      } else if (role === 'LECTURER') {
        const empCode = (identifier && identifier.trim()) || `LEC${100 + user.id}`;
        await tx.query(
          `INSERT INTO lecturers (user_id, employee_id, first_name, last_name, department)
           VALUES ($1, $2, $3, $4, $5)`,
          [user.id, empCode, firstName.trim(), lastName.trim(), department || 'Computer Science']
        );
      }
      return user;
    });

    res.status(201).json({ message: 'User created successfully', user: created });
  } catch (err) {
    console.error('createUser error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email or identifier already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
};

const updateUser = async (req, res) => {
  const userId = Number(req.params.id);
  const { email, isActive, password, firstName, lastName, major, yearOfStudy, department } = req.body;

  try {
    const existing = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const target = existing.rows[0];

    if (userId === req.user.id && isActive === false) {
      return res.status(400).json({ error: 'You cannot deactivate your own admin account' });
    }

    await db.withTransaction(async (tx) => {
      if (email) {
        await tx.query('UPDATE users SET email = $1 WHERE id = $2', [email.trim().toLowerCase(), userId]);
      }
      if (typeof isActive === 'boolean') {
        await tx.query('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, userId]);
      }
      if (password && password.trim()) {
        const pwCheck = validateStrongPassword(password.trim());
        if (!pwCheck.valid) {
          const err = new Error(pwCheck.error);
          err.statusCode = 400;
          throw err;
        }
        const hash = await bcrypt.hash(password.trim(), 10);
        await tx.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
      }

      if (target.role === 'STUDENT' && (firstName || lastName || major || yearOfStudy)) {
        await tx.query(
          `UPDATE students
           SET first_name = COALESCE($1, first_name),
               last_name = COALESCE($2, last_name),
               major = COALESCE($3, major),
               year_of_study = COALESCE($4, year_of_study)
           WHERE user_id = $5`,
          [firstName || null, lastName || null, major || null, yearOfStudy ? Number(yearOfStudy) : null, userId]
        );
      } else if (target.role === 'LECTURER' && (firstName || lastName || department)) {
        await tx.query(
          `UPDATE lecturers
           SET first_name = COALESCE($1, first_name),
               last_name = COALESCE($2, last_name),
               department = COALESCE($3, department)
           WHERE user_id = $4`,
          [firstName || null, lastName || null, department || null, userId]
        );
      }
    });

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('updateUser error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already in use' });
    }
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to update user' });
  }
};

const deleteUser = async (req, res) => {
  const userId = Number(req.params.id);
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  try {
    const resDel = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    if (resDel.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

module.exports = {
  listUsers,
  listLecturers,
  createUser,
  updateUser,
  deleteUser,
};
