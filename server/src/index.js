const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');
const { initDb } = require('./utils/initDb');
const { seedDatabase } = require('./utils/seed');
const { checkMlHealth } = require('./services/mlService');
const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    const ml = await checkMlHealth();
    res.status(200).json({
      status: 'success',
      message: 'EduRisk API is running!',
      database: db.getDbMode(),
      mlService: ml.available ? 'online' : 'offline',
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', apiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled API error:', err);
  res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
});

async function bootstrap({ seedDemo = false } = {}) {
  await db.initConnection();
  await initDb();
  if (seedDemo) {
    await seedDatabase({ forceIfEmpty: true });
  }
}

if (require.main === module) {
  bootstrap()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT} [DB: ${db.getDbMode()}]`);
      });
    })
    .catch((err) => {
      console.error('Failed to bootstrap EduRisk server:', err);
      process.exit(1);
    });
}

module.exports = { app, bootstrap };
