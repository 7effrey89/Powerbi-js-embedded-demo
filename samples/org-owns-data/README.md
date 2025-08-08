# Power BI Embedded JavaScript Demo — Organization Owns Data (User Owns Data)

This demo embeds a Power BI report for signed-in users in your organization using:

- Client: [`powerbi-client` JavaScript SDK](https://github.com/microsoft/PowerBI-JavaScript)
- Auth: MSAL Browser (Azure AD/Entra ID) to get a user token
- Server: Tiny Express server to serve static files only

This is the "Embed for your organization" scenario (also known as "User owns data"). Each viewer must sign in and have access to the report in Power BI.

## Prerequisites

1. Power BI account with access to the target workspace and report.
2. Azure AD (Entra ID) App Registration configured as a SPA:
   - Platform: Single-page application
   - Redirect URI: `http://localhost:3000`
   - Supported account types: your choice (Single tenant recommended for demos)
3. API permissions (Delegated) on the Power BI Service:
   - `Report.Read.All` (required to embed reports)
   - Optionally `Dataset.Read.All` if you will call dataset APIs
   - Grant admin consent for your tenant
4. Ensure the signed-in user has permission to view the report in the workspace.
5. Node.js 18+ recommended.

## Setup

1. Install dependencies:

   ```bash
   cd samples/org-owns-data
   npm install
   ```

2. Create a `.env` (optional):

   ```bash
   cp .env.example .env
   ```

   Optionally set `PORT` (defaults to `3000`).

3. Configure the client:

   - Open `src/public/config.js` and fill in:
     - `AAD_CLIENT_ID` with your App Registration's client ID
     - `AAD_TENANT_ID` with your tenant ID (or `common`/`organizations`)
     - `POWER_BI_WORKSPACE_ID` and `POWER_BI_REPORT_ID`
     - Adjust `POWER_BI_APP_URL` if using a national cloud (e.g., GCC `https://app.powerbigov.us`)

4. Start the app:

   ```bash
   npm run start
   # or:
   npm run dev
   ```

5. Open http://localhost:3000

   - Click "Sign in", complete AAD login.
   - Click "Embed" to load the report.

## How it works

- The frontend uses MSAL Browser to obtain an AAD access token for the Power BI Service with delegated scopes.
- The JavaScript SDK embeds the report using:
  - `tokenType: Aad`
  - `accessToken: <user AAD token>`
  - `embedUrl: https://app.powerbi.com/reportEmbed?reportId=...&groupId=...`
- No embed token or service principal is used in this flow.

## Switching from "App owns data"

- This sample uses user sign-in rather than a service principal.
- Ensure users have direct access to the report in Power BI.

## National clouds

Update `POWER_BI_APP_URL` in `src/public/config.js` for your cloud:

- Commercial: `https://app.powerbi.com`
- GCC: `https://app.powerbigov.us`
- Germany: `https://app.powerbi.de`
- China: `https://app.powerbi.cn`

You might also need to adjust the Content Security Policy (CSP) if endpoints differ.

## Troubleshooting

- Stuck on sign-in or token errors:
  - Check App Registration redirect URI matches your origin (e.g., `http://localhost:3000`).
  - Confirm delegated permissions include `Report.Read.All` with admin consent.
  - For single-tenant apps, `AAD_TENANT_ID` should be your tenant ID.

- 401/403 on embed:
  - The signed-in user must have permission to the report/workspace.
  - Confirm the workspace and report IDs are correct.

- Nothing renders:
  - Open the browser console for `powerbi-client` errors.
  - Ensure the CSP in `index.html` allows `login.microsoftonline.com` and `app.powerbi.com`.

## References

- Power BI JavaScript SDK: https://github.com/microsoft/PowerBI-JavaScript
- Embed for your organization: https://learn.microsoft.com/power-bi/developer/embedded/embed-sample-for-your-organization
- MSAL Browser docs: https://learn.microsoft.com/azure/active-directory/develop/msal-overview