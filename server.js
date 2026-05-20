require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { getPool, pool } = require('./db');
const routes  = require('./routes/index');

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.use('/api', routes);

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Route not found' });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await getPool();
    app.set('db', pool);
    app.listen(PORT, () => {
      console.log(`🚀 TMS Support Desk running on http://localhost:${PORT}`);
      console.log(`   Env: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
