// MSAL Browser configuration for SPA
const msalConfig = {
  auth: {
    clientId: AAD_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${AAD_TENANT_ID}`,
    redirectUri: window.location.origin
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false
  },
  system: {
    allowNativeBroker: false
  }
};

// Login request scopes (delegated permissions to Power BI Service)
const loginRequest = {
  scopes: POWER_BI_SCOPES
};