(function () {
  const accountLabel = document.getElementById('account-label');
  const signinBtn = document.getElementById('signin-button');
  const signoutBtn = document.getElementById('signout-button');
  const embedBtn = document.getElementById('embed-button');
  const exportBtn = document.getElementById('export-pdf-button');
  const exportStatus = document.getElementById('export-status');
  const reportSelector = document.getElementById('report-selector');
  const tokenStatus = document.getElementById('token-status');
  const container = document.getElementById('reportContainer');

  const msalInstance = new msal.PublicClientApplication(msalConfig);
  const EXPORT_POLL_INTERVAL_MS = 2000;
  const EXPORT_POLL_TIMEOUT_MS = 180000;

  // Cache for fetched reports
  let loadedReports = [];
  let currentReportContext = null;

  function setExportStatus(message = '', state = 'neutral') {
    if (!exportStatus) return;
    exportStatus.textContent = message;
    exportStatus.dataset.state = state;
  }

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
      
      if (typeof POWER_BI_USE_DYNAMIC_REPORT_SELECTION !== 'undefined' && POWER_BI_USE_DYNAMIC_REPORT_SELECTION) {
        reportSelector.style.display = 'inline-block';
        embedBtn.disabled = loadedReports.length === 0; // Disable until reports loaded
        if (loadedReports.length === 0) {
            // Trigger load
            loadAvailableReports(); 
        }
      } else {
        reportSelector.style.display = 'none';
        embedBtn.disabled = false;
        loadedReports = [];
      }

      if (exportBtn) exportBtn.disabled = false;
      if (!currentReportContext) setExportStatus('', 'neutral');

    } else {
      accountLabel.textContent = 'Not signed in';
      signinBtn.disabled = false;
      signoutBtn.disabled = true;
      embedBtn.disabled = true;
      reportSelector.style.display = 'none';
      tokenStatus.textContent = 'Token: …';
      if (exportBtn) exportBtn.disabled = true;
      setExportStatus('', 'neutral');

      // Clear report list on signout
      loadedReports = [];
      reportSelector.innerHTML = '';
      currentReportContext = null;

      try { powerbi.reset(container); } catch {}
    }
  }

  async function loadAvailableReports() {
     try {
         const accessToken = await acquirePbiToken();
         const headers = { 'Authorization': `Bearer ${accessToken}` };
         
         loadedReports = [];
         embedBtn.disabled = true;
         reportSelector.innerHTML = '<option>Loading reports...</option>';
         
         // 1. Get reports from "My Workspace"
         const myReportsRes = await fetch('https://api.powerbi.com/v1.0/myorg/reports', { headers });
         if (myReportsRes.ok) {
            const myData = await myReportsRes.json();
            (myData.value || []).forEach(r => {
                r.workspaceName = "My Workspace";
                loadedReports.push(r);
            });
         }

         // 2. Get other workspaces
         // Note: Requires Group.Read.All permission
         const groupsRes = await fetch('https://api.powerbi.com/v1.0/myorg/groups', { headers });
         if (groupsRes.ok) {
             const groupsData = await groupsRes.json();
             const groups = groupsData.value || [];
             
             // 3. Fetch reports for each group in parallel
             const groupPromises = groups.map(async g => {
                 try {
                     const rRes = await fetch(`https://api.powerbi.com/v1.0/myorg/groups/${g.id}/reports`, { headers });
                     if (rRes.ok) {
                         const rData = await rRes.json();
                         (rData.value || []).forEach(r => {
                             r.workspaceName = g.name;
                             // Store groupId if needed, though embedUrl usually handles it
                             r.groupId = g.id; 
                             loadedReports.push(r);
                         });
                     }
                 } catch (e) {
                     console.warn(`Failed to fetch reports for group ${g.name}`, e);
                 }
             });
             
             await Promise.all(groupPromises);
         }

         // Populate UI
         reportSelector.innerHTML = '';
         if (loadedReports.length === 0) {
             const opt = document.createElement('option');
             opt.text = "No reports found";
             reportSelector.add(opt);
             embedBtn.disabled = true;
         } else {
             // Sort by workspace name then report name
             loadedReports.sort((a, b) => {
                 if (a.workspaceName < b.workspaceName) return -1;
                 if (a.workspaceName > b.workspaceName) return 1;
                 if (a.name < b.name) return -1;
                 if (a.name > b.name) return 1;
                 return 0;
             });

             const defaultOpt = document.createElement('option');
             defaultOpt.text = "Select a report...";
             defaultOpt.value = "";
             reportSelector.add(defaultOpt);

             loadedReports.forEach(r => {
                 const opt = document.createElement('option');
                 opt.value = r.id;
                 opt.text = `${r.workspaceName} - ${r.name}`;
                 reportSelector.add(opt);
             });
             
             // Enable only if selection changes
             embedBtn.disabled = true;
             reportSelector.onchange = () => {
                 embedBtn.disabled = !reportSelector.value;
             };
         }

     } catch (err) {
         console.error(err);
         reportSelector.innerHTML = '';
         const opt = document.createElement('option');
         opt.text = "Error loading reports";
         reportSelector.add(opt);
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

  function buildReportApiBase(workspaceId, reportId) {
    const safeReportId = encodeURIComponent(reportId);
    if (workspaceId) {
      const safeGroupId = encodeURIComponent(workspaceId);
      return `https://api.powerbi.com/v1.0/myorg/groups/${safeGroupId}/reports/${safeReportId}`;
    }
    return `https://api.powerbi.com/v1.0/myorg/reports/${safeReportId}`;
  }

  function clearExistingEmbed() {
    try { powerbi.reset(container); } catch {}
  }

  async function embedReport() {
    try {
      currentReportContext = null;
      if (exportBtn) exportBtn.disabled = true;
      setExportStatus('Export: preparing embed', 'info');

      const accessToken = await acquirePbiToken();
      tokenStatus.textContent = `Token: expires in ${formatExpiryFromJwt(accessToken)}`;

      const models = window['powerbi-client'].models;

      // Determine report ID and embed URL
      let reportId, embedUrl, workspaceId = null;

      if (typeof POWER_BI_USE_DYNAMIC_REPORT_SELECTION !== 'undefined' && POWER_BI_USE_DYNAMIC_REPORT_SELECTION && reportSelector.value) {
          const selectedId = reportSelector.value;
          const report = loadedReports.find(r => r.id === selectedId);
          if (report) {
              reportId = report.id;
              embedUrl = report.embedUrl;
              workspaceId = report.groupId || null;
          }
      } 
      
      // Fallback or static config
      if (!reportId) {
        reportId = POWER_BI_REPORT_ID;
        embedUrl = buildEmbedUrl(POWER_BI_WORKSPACE_ID, POWER_BI_REPORT_ID);
        workspaceId = POWER_BI_WORKSPACE_ID;
      }

      const config = {
        type: 'report',
        tokenType: models.TokenType.Aad, // AAD token for Organization owns data
        accessToken,
        embedUrl: embedUrl,
        id: reportId,
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
      currentReportContext = { reportId, workspaceId: workspaceId || null };
      if (exportBtn) exportBtn.disabled = false;
      setExportStatus('', 'neutral');

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
      currentReportContext = null;
      if (exportBtn) exportBtn.disabled = false;
      setExportStatus('Export: failed to embed', 'error');
    }
  }

  async function exportReportToPdf() {
    if (!currentReportContext) {
      setExportStatus('Export: embed a report first', 'error');
      alert('Embed a report before exporting.');
      return;
    }

    try {
      if (exportBtn) exportBtn.disabled = true;
      setExportStatus('Export: starting…', 'info');

      const accessToken = await acquirePbiToken();
      const { reportId, workspaceId } = currentReportContext;
      const apiBase = buildReportApiBase(workspaceId, reportId);

      const startResponse = await fetch(`${apiBase}/ExportTo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ format: 'PDF' })
      });

      const startPayloadText = await startResponse.text();
      if (!startResponse.ok) {
        throw new Error(`Export start failed (${startResponse.status}): ${startPayloadText || 'No details'}`);
      }

      let exportId;
      if (startPayloadText) {
        try {
          exportId = JSON.parse(startPayloadText)?.id;
        } catch (parseErr) {
          console.warn('Unable to parse export start payload', parseErr);
        }
      }
      if (!exportId) {
        const locationHeader = startResponse.headers.get('location');
        if (locationHeader) {
          exportId = locationHeader.split('/').filter(Boolean).pop();
        }
      }
      if (!exportId) {
        throw new Error('Export job ID missing from response.');
      }

      const exportInfo = await pollExportStatus(accessToken, apiBase, exportId);
      await downloadExportFile(accessToken, apiBase, exportId, exportInfo?.reportName);

      setExportStatus('Export: completed', 'success');
    } catch (err) {
      console.error('Export to PDF failed:', err);
      setExportStatus('Export: failed', 'error');
      alert('Export failed. See console for details.');
    } finally {
      if (exportBtn) exportBtn.disabled = false;
    }
  }

  async function pollExportStatus(accessToken, apiBase, exportId) {
    const headers = { 'Authorization': `Bearer ${accessToken}` };
    const statusUrl = `${apiBase}/exports/${exportId}`;
    const start = Date.now();

    while (true) {
      if (Date.now() - start > EXPORT_POLL_TIMEOUT_MS) {
        throw new Error('Export timed out.');
      }

      const res = await fetch(statusUrl, { headers });
      const payloadText = await res.text();
      if (!res.ok) {
        throw new Error(`Export status failed (${res.status}): ${payloadText || 'No details'}`);
      }

      let payload = {};
      if (payloadText) {
        try {
          payload = JSON.parse(payloadText);
        } catch {
          payload = {};
        }
      }

      const state = payload.status;
      if (state === 'Succeeded') {
        return payload;
      }
      if (state === 'Failed') {
        throw new Error(payload?.error?.message || 'Export job failed.');
      }

      const percent = typeof payload.percentComplete === 'number' ? payload.percentComplete : 0;
      setExportStatus(`Export: running (${percent}%)`, 'info');
      await delay(EXPORT_POLL_INTERVAL_MS);
    }
  }

  async function downloadExportFile(accessToken, apiBase, exportId, reportName) {
    const res = await fetch(`${apiBase}/exports/${exportId}/file`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      const details = await res.text();
      throw new Error(`Export download failed (${res.status}): ${details || 'No details'}`);
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${sanitizeFileName(reportName || 'powerbi-report')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }

  function sanitizeFileName(name) {
    const cleaned = name.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return cleaned || 'powerbi-report';
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
  if (exportBtn) {
    exportBtn.addEventListener('click', exportReportToPdf);
  }

  // Initialize on load
  handleRedirect();
})();