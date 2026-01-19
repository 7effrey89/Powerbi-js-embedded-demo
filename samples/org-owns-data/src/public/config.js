// Frontend config is populated by the server at runtime (see /app-config.js).
// These defaults are kept as a safety net for static hosting scenarios only.

const FALLBACK_EMBED_CONFIG = {
  AAD_CLIENT_ID: '00000000-0000-0000-0000-000000000000',
  AAD_TENANT_ID: 'common',
  POWER_BI_WORKSPACE_ID: '00000000-0000-0000-0000-000000000000',
  POWER_BI_REPORT_ID: '00000000-0000-0000-0000-000000000000',
  POWER_BI_USE_DYNAMIC_REPORT_SELECTION: true,
  POWER_BI_APP_URL: 'https://app.powerbi.com',
  POWER_BI_SCOPES: [
    'https://analysis.windows.net/powerbi/api/Report.Read.All',
    'https://analysis.windows.net/powerbi/api/Group.Read.All'
    // Add "https://analysis.windows.net/powerbi/api/Dataset.Read.All" if you call dataset APIs
  ]
};

const runtimeConfig = (function resolveRuntimeConfig() {
  if (typeof window !== 'undefined' && window.__POWER_BI_EMBED_CONFIG) {
    return window.__POWER_BI_EMBED_CONFIG;
  }
  console.warn('Falling back to static Power BI config defaults.');
  return FALLBACK_EMBED_CONFIG;
})();

const pick = (key, fallback) => runtimeConfig[key] ?? fallback;

const AAD_CLIENT_ID = pick('AAD_CLIENT_ID', FALLBACK_EMBED_CONFIG.AAD_CLIENT_ID);
const AAD_TENANT_ID = pick('AAD_TENANT_ID', FALLBACK_EMBED_CONFIG.AAD_TENANT_ID);
const POWER_BI_WORKSPACE_ID = pick('POWER_BI_WORKSPACE_ID', FALLBACK_EMBED_CONFIG.POWER_BI_WORKSPACE_ID);
const POWER_BI_REPORT_ID = pick('POWER_BI_REPORT_ID', FALLBACK_EMBED_CONFIG.POWER_BI_REPORT_ID);
const POWER_BI_USE_DYNAMIC_REPORT_SELECTION = typeof pick('POWER_BI_USE_DYNAMIC_REPORT_SELECTION', undefined) === 'boolean'
  ? pick('POWER_BI_USE_DYNAMIC_REPORT_SELECTION', FALLBACK_EMBED_CONFIG.POWER_BI_USE_DYNAMIC_REPORT_SELECTION)
  : FALLBACK_EMBED_CONFIG.POWER_BI_USE_DYNAMIC_REPORT_SELECTION;
const POWER_BI_APP_URL = pick('POWER_BI_APP_URL', FALLBACK_EMBED_CONFIG.POWER_BI_APP_URL);
const POWER_BI_SCOPES = Array.isArray(runtimeConfig.POWER_BI_SCOPES) && runtimeConfig.POWER_BI_SCOPES.length
  ? runtimeConfig.POWER_BI_SCOPES
  : FALLBACK_EMBED_CONFIG.POWER_BI_SCOPES;

// Expose the resolved config for debugging or other scripts that prefer object form.
if (typeof window !== 'undefined') {
  window.__POWER_BI_EMBED_CONFIG = runtimeConfig;
}