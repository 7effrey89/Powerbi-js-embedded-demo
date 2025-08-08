// Fill in these values for your environment.

// Azure AD (Entra ID) SPA registration
const AAD_CLIENT_ID = "00000000-0000-0000-0000-000000000000"; // Your App Registration (client) ID
const AAD_TENANT_ID = "common"; // Use your tenant ID or 'common'/'organizations' as needed

// Power BI workspace and report to embed
const POWER_BI_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000"; // Group (workspace) ID
const POWER_BI_REPORT_ID = "00000000-0000-0000-0000-000000000000"; // Report ID

// Power BI endpoint for commercial cloud; change for national clouds if needed
// e.g. GCC: https://app.powerbigov.us, Germany: https://app.powerbi.de, China: https://app.powerbi.cn
const POWER_BI_APP_URL = "https://app.powerbi.com";

// Optional: scopes to request (delegated)
const POWER_BI_SCOPES = [
  "https://analysis.windows.net/powerbi/api/Report.Read.All"
  // Add "https://analysis.windows.net/powerbi/api/Dataset.Read.All" if you call dataset APIs
];