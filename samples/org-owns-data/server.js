/* eslint-disable no-console */
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const CLIENT_CONFIG_DEFAULTS = {
  AAD_CLIENT_ID: '00000000-0000-0000-0000-000000000000',
  AAD_TENANT_ID: 'common',
  POWER_BI_WORKSPACE_ID: '00000000-0000-0000-0000-000000000000',
  POWER_BI_REPORT_ID: '00000000-0000-0000-0000-000000000000',
  POWER_BI_USE_DYNAMIC_REPORT_SELECTION: true,
  POWER_BI_APP_URL: 'https://app.powerbi.com',
  POWER_BI_SCOPES: [
    'https://analysis.windows.net/powerbi/api/Report.Read.All',
    'https://analysis.windows.net/powerbi/api/Group.Read.All'
  ]
};

const REQUIRED_CLIENT_SETTINGS = [
  'AAD_CLIENT_ID',
  'AAD_TENANT_ID',
  'POWER_BI_WORKSPACE_ID',
  'POWER_BI_REPORT_ID'
];

const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);

const toBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return TRUTHY_VALUES.has(String(value).trim().toLowerCase());
};

const toScopes = (value, fallback) => {
  if (!value) return fallback;
  const scopes = value
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
  return scopes.length ? scopes : fallback;
};

const sanitizeUrl = (value, fallback) => {
  const url = value && value.trim().length ? value.trim() : fallback;
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const buildClientConfig = () => ({
  ...CLIENT_CONFIG_DEFAULTS,
  AAD_CLIENT_ID: process.env.AAD_CLIENT_ID || CLIENT_CONFIG_DEFAULTS.AAD_CLIENT_ID,
  AAD_TENANT_ID: process.env.AAD_TENANT_ID || CLIENT_CONFIG_DEFAULTS.AAD_TENANT_ID,
  POWER_BI_WORKSPACE_ID: process.env.POWER_BI_WORKSPACE_ID || CLIENT_CONFIG_DEFAULTS.POWER_BI_WORKSPACE_ID,
  POWER_BI_REPORT_ID: process.env.POWER_BI_REPORT_ID || CLIENT_CONFIG_DEFAULTS.POWER_BI_REPORT_ID,
  POWER_BI_USE_DYNAMIC_REPORT_SELECTION: toBoolean(
    process.env.POWER_BI_USE_DYNAMIC_REPORT_SELECTION,
    CLIENT_CONFIG_DEFAULTS.POWER_BI_USE_DYNAMIC_REPORT_SELECTION
  ),
  POWER_BI_APP_URL: sanitizeUrl(process.env.POWER_BI_APP_URL, CLIENT_CONFIG_DEFAULTS.POWER_BI_APP_URL),
  POWER_BI_SCOPES: toScopes(process.env.POWER_BI_SCOPES, CLIENT_CONFIG_DEFAULTS.POWER_BI_SCOPES)
});

const logMissingClientSettings = () => {
  const missing = REQUIRED_CLIENT_SETTINGS.filter((key) => {
    const val = process.env[key];
    return !val || val === CLIENT_CONFIG_DEFAULTS[key];
  });
  if (missing.length) {
    console.warn(
      `Missing recommended environment variables for frontend config: ${missing.join(', ')}. ` +
        'The client will fall back to placeholder IDs.'
    );
  }
};

logMissingClientSettings();

const app = express();
const PORT = process.env.PORT || 3000;

// Frontend config endpoint (exposes non-secret IDs to the SPA)
app.get('/app-config.js', (_req, res) => {
  const clientConfig = buildClientConfig();
  res.type('application/javascript');
  res.set('Cache-Control', 'no-store');
  res.send(`window.__POWER_BI_EMBED_CONFIG = ${JSON.stringify(clientConfig)};`);
});

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