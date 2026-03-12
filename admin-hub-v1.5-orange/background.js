// Background service worker — Administrative Hub
// Cardinal Plaza Shell

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Listen for messages from side panel and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Content script floating button → open side panel
  if (request.action === 'adm_openSidePanel') {
    const tabId    = sender.tab?.id;
    const windowId = sender.tab?.windowId;
    console.log('[Admin Hub] openSidePanel received, tabId:', tabId, 'windowId:', windowId);
    if (tabId) {
      chrome.sidePanel.open({ tabId }, () => {
        if (chrome.runtime.lastError) {
          console.error('[Admin Hub] sidePanel.open error:', chrome.runtime.lastError.message);
          if (windowId) chrome.sidePanel.open({ windowId });
        } else {
          console.log('[Admin Hub] Side panel opened successfully');
        }
      });
    }
    sendResponse({ success: true });
    return true;
  }

  // Ask Me Anything API call
  if (request.action === 'adm_amaCall') {
    performSODCall(request.systemPrompt, request.messages, request.apiKey)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Service Offering Developer API call
  if (request.action === 'adm_sodCall') {
    performSODCall(request.systemPrompt, request.messages, request.apiKey)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // TekMetric — Test connection
  if (request.action === 'adm_tmTestConnection') {
    admTMTestConnection(request.credentials)
      .then(r  => sendResponse({ success: true,  data:  r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  // TekMetric — Fetch RO by ID
  if (request.action === 'adm_tmGetRO') {
    admTMGetRepairOrder(request.roNumber, request.credentials)
      .then(r  => sendResponse({ success: true,  data:  r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

});

async function performSODCall(systemPrompt, messages, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: messages
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'API request failed');
  }

  const data = await response.json();
  return data.content[0].text;
}

// ════════════════════════════════════════
// TEKMETRIC BACKEND FUNCTIONS
// ════════════════════════════════════════

async function admTMTestConnection(creds) {
  const baseUrl = creds.cloudRunUrl;
  const testUrls = [
    `${baseUrl}/health`,
    `${baseUrl}/`,
    `${baseUrl}/repair-order/528446`,
  ];
  for (const url of testUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) return { shopName: 'Cloud Run Service', shopId: creds.shopId || '', endpoint: baseUrl };
    } catch (e) {
      console.log('[Admin Hub TM] Connection attempt failed:', e.message);
    }
  }
  throw new Error('Could not connect to Cloud Run service. Check URL.');
}

async function admTMGetRepairOrder(roNumber, creds) {
  const baseUrl = creds.cloudRunUrl;
  const patterns = [
    `${baseUrl}/repair-order/${roNumber}`,
    `${baseUrl}/ro/${roNumber}`,
    `${baseUrl}/api/repair-order/${roNumber}`,
    `${baseUrl}/repair-orders/${roNumber}`,
  ];
  for (const url of patterns) {
    try {
      const res = await fetch(url);
      if (res.status === 404) continue;
      if (!res.ok) continue;
      const data = await res.json();
      return admFormatROData(data);
    } catch (e) {
      console.log('[Admin Hub TM] Endpoint failed:', e.message);
    }
  }
  throw new Error(`RO #${roNumber} not found.`);
}

function admFormatROData(data) {
  const ro       = data.repairOrder || data.data || data;
  const customer = ro.customer || {};
  const vehicle  = ro.vehicle  || {};
  const jobs     = ro.jobs     || [];

  const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown';
  const vehicleDesc  = `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim();
  const odometer     = ro.odometerIn || ro.mileage || vehicle.mileage || 'N/A';
  const roNum        = ro.repairOrderNumber || ro.id || 'N/A';

  const jobLines = jobs.map((job, i) => {
    const name   = job.name || job.laborName || `Service ${i + 1}`;
    const status = job.approved ? 'APPROVED' : (job.declined ? 'DECLINED' : (job.status || ''));
    const noteFields = [
      job.technicianNote, job.laborNote, job.note, job.notes, job.techNote,
      job.concern, job.causeNote, job.correctionNote, job.complaint, job.cause, job.correction
    ].filter(Boolean).join(' | ');
    const findings = (job.findings || job.laborFindings || [])
      .map(f => `     Finding: ${f.name || f.description || f.text || JSON.stringify(f)} — ${f.status || f.result || f.severity || ''}`)
      .join('\n');
    const parts = (job.parts || [])
      .map(p => `     Part: ${p.name || p.partName} (qty: ${p.quantity || 1})`)
      .join('\n');
    return [
      `  ${i + 1}. ${name}${status ? ' [' + status + ']' : ''}`,
      noteFields ? `     Notes: ${noteFields}` : '',
      findings,
      parts
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const dvi = (ro.inspectionItems || ro.dviItems || ro.inspections || []);
  const dviLines = dvi.length
    ? '\nDVI / INSPECTION FINDINGS:\n' + dvi.map(item => {
        const name   = item.name || item.description || item.label || 'Item';
        const status = item.status || item.result || item.rating || item.severity || 'Inspected';
        const note   = item.note || item.technicianNote || item.notes || '';
        return `  • [${status.toUpperCase()}] ${name}${note ? ': ' + note : ''}`;
      }).join('\n')
    : '';

  const concerns = (ro.customerConcerns || [])
    .map(c => `  • ${c.concern || c.description || c}`)
    .join('\n') || '  • See services performed';

  const formatted = [
    `REPAIR ORDER: #${roNum}`,
    `CUSTOMER: ${customerName}`,
    `VEHICLE: ${vehicleDesc}`,
    `ODOMETER: ${odometer}`,
    `CUSTOMER CONCERNS:\n${concerns}`,
    jobLines ? `SERVICES/FINDINGS:\n${jobLines}` : '',
    dviLines,
    `INTERNAL NOTES: ${ro.technicianNotes || ro.internalNotes || 'None'}`,
    `RAW JOB DATA (AI reference — use structured data above first):\n${jobs.map((job,i) => `Job ${i+1}: ${JSON.stringify(job)}`).join('\n')}`
  ].filter(Boolean).join('\n');

  return {
    summary: {
      roNumber:  roNum,
      customer:  customerName,
      vehicle:   vehicleDesc,
      odometer:  odometer
    },
    formatted
  };
}
