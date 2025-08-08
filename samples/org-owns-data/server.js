/* eslint-disable no-console */
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend
const publicDir = path.join(__dirname, 'src', 'public');
app.use(express.static(publicDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Power BI Embedded (Org owns data) demo server is running.' });
});

// Fallback to index.html for root path
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Power BI Embedded (Org owns data) demo listening at http://localhost:${PORT}`);
});