(function () {
  const accountLabel = document.getElementById('account-label');
  const signinBtn = document.getElementById('signin-button');
  const signoutBtn = document.getElementById('signout-button');
  const embedBtn = document.getElementById('embed-button');
  const tokenStatus = document.getElementById('token-status');
  const container = document.getElementById('reportContainer');

  const msalInstance = new msal.PublicClientApplication(msalConfig);

  function setActiveAccount() {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      msalInstance.setActiveAccount(accounts[0]);
    }
  }

  async function handleRedirect() {
    try {
      const resp = await msalInstance.handleRedirectPromise();
      if (resp && resp.account) {
        msalInstance.setActiveAccount(resp.account);
      } else {
        setActiveAccount();
      }
      updateUi();
    } catch (e) {
      console.error('MSAL redirect error:', e);
      updateUi();
    }
  }

  function updateUi() {
    const acct = msalInstance.getActiveAccount();
    if (acct) {
      accountLabel.textContent = `Signed in: ${acct.username}`;
      signinBtn.disabled = true;
      signoutBtn.disabled = false;
      embedBtn.disabled = false;
    } else {
      accountLabel.textContent = 'Not signed in';
      signinBtn.disabled = false;
      signoutBtn.disabled = true;
      embedBtn.disabled = true;
      tokenStatus.textContent = 'Token: …';
      try { powerbi.reset(container); } catch {}
    }
  }

  function formatExpiryFromJwt(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expMs = payload.exp * 1000;
      const ms = expMs - Date.now();
      if (ms <= 0) return 'expired';
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      return `${mins}m ${secs}s`;
    } catch {
      return 'unknown';
    }
  }

  async function acquirePbiToken() {
    const account = msalInstance.getActiveAccount();
    if (!account) throw new Error('No active account.');
    try {
      const silent = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account
      });
      return silent.accessToken;
    } catch (silentErr) {
      console.warn('Silent token acquisition failed, using popup:', silentErr);
      const popup = await msalInstance.acquireTokenPopup(loginRequest);
      return popup.accessToken;
    }
  }

  function buildEmbedUrl(workspaceId, reportId) {
    // For "Embed for your organization", use reportEmbed endpoint
    const url = new URL(`${POWER_BI_APP_URL.replace(/\/$/, '')}/reportEmbed`);
    url.searchParams.set('reportId', reportId);
    url.searchParams.set('groupId', workspaceId);
    return url.toString();
  }

  function clearExistingEmbed() {
    try { powerbi.reset(container); } catch {}
  }

  async function embedReport() {
    try {
      const accessToken = await acquirePbiToken();
      tokenStatus.textContent = `Token: expires in ${formatExpiryFromJwt(accessToken)}`;

      const models = window['powerbi-client'].models;

      const config = {
        type: 'report',
        tokenType: models.TokenType.Aad, // AAD token for Organization owns data
        accessToken,
        embedUrl: buildEmbedUrl(POWER_BI_WORKSPACE_ID, POWER_BI_REPORT_ID),
        id: POWER_BI_REPORT_ID,
        settings: {
          panes: {
            filters: { visible: false, expanded: false },
            pageNavigation: { visible: true }
          },
          layoutType: models.LayoutType.Responsive
        }
      };

      clearExistingEmbed();

      const report = powerbi.embed(container, config);

      report.on('loaded', () => console.log('Report loaded'));
      report.on('rendered', () => console.log('Report rendered'));
      report.on('error', (event) => {
        console.error('Power BI report error:', event?.detail || event);
      });

      // Optional: set first page active
      report.on('loaded', async () => {
        try {
          const pages = await report.getPages();
          if (pages?.length) await pages[0].setActive();
        } catch (e) {
          console.warn('Unable to set active page:', e);
        }
      });
    } catch (e) {
      console.error('Embed failed:', e);
      alert('Failed to embed report. Check console for details.');
    }
  }

  async function signIn() {
    try {
      await msalInstance.loginPopup(loginRequest);
      setActiveAccount();
      updateUi();
    } catch (e) {
      console.error('Login failed:', e);
      alert('Login failed. See console for details.');
    }
  }

  async function signOut() {
    const account = msalInstance.getActiveAccount();
    try {
      await msalInstance.logoutPopup({
        account
      });
    } catch (e) {
      console.error('Logout failed:', e);
    } finally {
      updateUi();
    }
  }

  signinBtn.addEventListener('click', signIn);
  signoutBtn.addEventListener('click', signOut);
  embedBtn.addEventListener('click', embedReport);

  // Initialize on load
  handleRedirect();
})();