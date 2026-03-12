// Administrative Hub — Side Panel JS v1.1
// Cardinal Plaza Shell
// Two-screen architecture: Screen 1 = Hub (header + tiles), Screen 2 = Tool (full sidebar)

// ── State ──
let tmContext     = null;   // Loaded RO data fed to tools
let tmCredentials = null;   // Cloud Run URL + shopId
let lastRoId      = null;   // Last detected RO from URL
let activeToolId  = null;

// ── Tool Registry ──
// Defines each tool: its tile id, content panel id, header label, and HiW content
const TOOLS = {
  'tool-a': {
    tileId:    'tile-tool-a',
    contentId: 'tool-a-content',
    icon:      '⭐',
    name:      'Google Response',
    hiw: {
      title: '⭐ Google Response',
      body: `
        <p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Answer a Customer Question</strong><br>
        Select whether the customer is in person or on the phone. If there's an open RO in TekMetric, vehicle context is pulled in automatically. Type the customer's question or situation, add optional extra context, and generate a tailored response.</p>
        <hr style="border:none;border-top:1px solid #dee2e6;margin:10px 0;">
        <p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Phone + No RO</strong><br>
        When a customer calls without an existing RO, the AI automatically shifts into drop-off mode — promoting our free services and White Glove Concierge experience.</p>
        <hr style="border:none;border-top:1px solid #dee2e6;margin:10px 0;">
        <p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Respond to a Google Review</strong><br>
        Paste or describe the review, tag it positive or negative, and generate a varied, on-brand response optimized for Google's algorithm.</p>
        <hr style="border:none;border-top:1px solid #dee2e6;margin:10px 0;">
        <p style="font-size:12px;color:#4a5568;line-height:1.65;">After every response, use the <strong>length</strong> and <strong>detail</strong> chips to tune it, or type follow-up requests in the refinement field below.</p>
      `
    }
  },
  'tool-b': {
    tileId:    'tile-tool-b',
    contentId: 'tool-b-content',
    icon:      '📦',
    name:      'Service Offering Developer',
    hiw: {
      title: '📦 Service Offering Developer',
      body: `
        <p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Develop New Service</strong><br>
        Have an AI-guided conversation to explore a service idea. Once you've discussed it, click "Build Service Package" and the AI will recommend frequency and target vehicles, then generate a complete 10-section service definition you can edit.</p>
        <hr style="border:none;border-top:1px solid #dee2e6;margin:10px 0;">
        <p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Create Marketing Materials</strong><br>
        For an existing service, fill in the form and generate a complete marketing and training package — customer materials, marketing copy, advisor talking points, and an operations checklist.</p>
        <hr style="border:none;border-top:1px solid #dee2e6;margin:10px 0;">
        <p style="font-size:12px;color:#4a5568;line-height:1.65;">All output uses Cardinal Plaza Shell's voice: calm, educational, and customer-first.</p>
      `
    }
  }
};

// ── DOM Ready ──
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  wireTiles();
  wireReturnButton();
  initAMA();
  initSOD();
  wireHubModals();
  wireToolHiWModal();
  wireSettingsModal();
  wireTMBanner();
  initTekMetric();
});


// ════════════════════════════════════════
// SCREEN NAVIGATION
// ════════════════════════════════════════

function openTool(toolId) {
  const tool = TOOLS[toolId];
  if (!tool) return;

  activeToolId = toolId;

  // Set tool header
  document.getElementById('tool-header-icon').textContent = tool.icon;
  document.getElementById('tool-header-name').textContent = tool.name;

  // Show correct content panel
  Object.values(TOOLS).forEach(t => {
    const el = document.getElementById(t.contentId);
    if (el) el.style.display = 'none';
  });
  const panel = document.getElementById(tool.contentId);
  if (panel) panel.style.display = 'block';

  // Switch screens
  document.getElementById('screen-hub').classList.remove('active');
  document.getElementById('screen-tool').classList.add('active');

  // Scroll tool body to top
  document.getElementById('tool-body').scrollTop = 0;
}

function returnToHub() {
  activeToolId = null;
  document.getElementById('screen-tool').classList.remove('active');
  document.getElementById('screen-hub').classList.add('active');
}

function wireTiles() {
  Object.entries(TOOLS).forEach(([toolId, tool]) => {
    const tile = document.getElementById(tool.tileId);
    if (!tile) return;
    tile.addEventListener('click', () => openTool(toolId));
  });
}

function wireReturnButton() {
  document.getElementById('return-to-hub-btn').addEventListener('click', returnToHub);
}


// ════════════════════════════════════════
// HUB MODALS (HiW + Settings)
// ════════════════════════════════════════

function wireHubModals() {
  // Hub HiW
  document.getElementById('hub-hiw-btn').addEventListener('click', () => {
    document.getElementById('hub-hiw-modal').classList.add('active');
  });
  document.getElementById('hub-hiw-close').addEventListener('click', () => {
    document.getElementById('hub-hiw-modal').classList.remove('active');
  });
  document.getElementById('hub-hiw-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('hub-hiw-modal'))
      document.getElementById('hub-hiw-modal').classList.remove('active');
  });
}

function wireSettingsModal() {
  document.getElementById('hub-gear-btn').addEventListener('click', () => {
    document.getElementById('hub-settings-modal').classList.add('active');
  });
  document.getElementById('hub-modal-close').addEventListener('click', () => {
    document.getElementById('hub-settings-modal').classList.remove('active');
  });
  document.getElementById('hub-settings-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('hub-settings-modal'))
      document.getElementById('hub-settings-modal').classList.remove('active');
  });

  // Save API key
  document.getElementById('hub-save-api-btn').addEventListener('click', () => {
    const key = document.getElementById('hub-api-key-input').value.trim();
    if (!key) return;
    chrome.storage.local.set({ adminHubApiKey: key }, () => {
      const msg = document.getElementById('hub-api-save-msg');
      msg.textContent = '✅ API key saved';
      setTimeout(() => { msg.textContent = ''; }, 3000);
    });
  });

  // Save & test TekMetric credentials
  document.getElementById('hub-tm-save-btn').addEventListener('click', () => {
    const url    = document.getElementById('hub-tm-cloudrun-input').value.trim().replace(/\/$/, '');
    const shopId = document.getElementById('hub-tm-shopid-input').value.trim();
    const msg    = document.getElementById('hub-tm-save-msg');
    if (!url) {
      msg.innerHTML = '<span style="color:#dc3545;font-size:11px;">Please enter your Cloud Run URL.</span>';
      return;
    }
    const creds = { cloudRunUrl: url, shopId };
    msg.innerHTML = '<span style="color:#6c757d;font-size:11px;">Testing connection…</span>';
    chrome.runtime.sendMessage(
      { action: 'adm_tmTestConnection', credentials: creds },
      response => {
        if (response?.success) {
          chrome.storage.local.set({ adminHubTMCredentials: creds });
          tmCredentials = creds;
          admTMSetStatus('connected', 'Connected · Shop ' + (shopId || ''));
          msg.innerHTML = '<span style="color:#28a745;font-size:11px;">✅ Connected successfully!</span>';
          setTimeout(() => {
            msg.innerHTML = '';
            document.getElementById('hub-settings-modal').classList.remove('active');
          }, 1500);
        } else {
          msg.innerHTML = '<span style="color:#dc3545;font-size:11px;">❌ ' + (response?.error || 'Connection failed') + '</span>';
          admTMSetStatus('error', 'Connection failed');
        }
      }
    );
  });
}


// ════════════════════════════════════════
// TOOL HiW MODAL (on Screen 2)
// ════════════════════════════════════════

function wireToolHiWModal() {
  document.getElementById('tool-hiw-btn').addEventListener('click', () => {
    if (!activeToolId) return;
    const hiw = TOOLS[activeToolId]?.hiw;
    if (!hiw) return;
    document.getElementById('tool-hiw-title').textContent = hiw.title;
    document.getElementById('tool-hiw-body').innerHTML   = hiw.body;
    document.getElementById('tool-hiw-modal').classList.add('active');
  });
  document.getElementById('tool-hiw-close').addEventListener('click', () => {
    document.getElementById('tool-hiw-modal').classList.remove('active');
  });
  document.getElementById('tool-hiw-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('tool-hiw-modal'))
      document.getElementById('tool-hiw-modal').classList.remove('active');
  });
}


// ════════════════════════════════════════
// SETTINGS LOAD
// ════════════════════════════════════════

function loadSettings() {
  chrome.storage.local.get([
    'adminHubApiKey',
    'adminHubTMCredentials'
  ], (result) => {
    if (result.adminHubApiKey) document.getElementById('hub-api-key-input').value = result.adminHubApiKey;
    if (result.adminHubTMCredentials) {
      document.getElementById('hub-tm-cloudrun-input').value = result.adminHubTMCredentials.cloudRunUrl || '';
      document.getElementById('hub-tm-shopid-input').value   = result.adminHubTMCredentials.shopId      || '';
    }
  });
}


// ════════════════════════════════════════
// TEKMETRIC INTEGRATION
// ════════════════════════════════════════

function wireTMBanner() {
  document.getElementById('tm-clear-btn').addEventListener('click', () => {
    tmContext = null;
    lastRoId  = null;
    hideTMBanner();
    amaLoadVehicleContext();
  });
}

function showTMBanner(label) {
  document.getElementById('tm-banner-text').textContent = '✅ ' + label;
  document.getElementById('tm-banner').classList.add('active');
}

function hideTMBanner() {
  document.getElementById('tm-banner').classList.remove('active');
}

function buildTMLabel(ctx) {
  if (!ctx) return 'RO loaded';
  const parts = [];
  if (ctx.roNumber)     parts.push('RO #' + ctx.roNumber);
  if (ctx.customerName) parts.push(ctx.customerName);
  if (ctx.vehicle)      parts.push(ctx.vehicle);
  return parts.length ? parts.join(' · ') : 'RO loaded';
}

// ── Init: load credentials + start URL monitoring ──────────────────
function initTekMetric() {
  chrome.storage.local.get(['adminHubTMCredentials'], result => {
    if (result.adminHubTMCredentials) {
      tmCredentials = result.adminHubTMCredentials;
      admTMSetStatus('checking', 'Connecting…');
      admTMTestConnection();
    }
  });
  startURLMonitoring();
}

// ── URL Monitoring ─────────────────────────────────────────────────
function startURLMonitoring() {
  checkCurrentTab();
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) checkTabURL(changeInfo.url);
  });
  chrome.tabs.onActivated.addListener(() => { checkCurrentTab(); });
  setInterval(checkCurrentTab, 2000);
}

function checkCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]?.url) checkTabURL(tabs[0].url);
  });
}

function checkTabURL(url) {
  if (!tmCredentials) return;
  const match = url.match(/\/repair-orders\/(\d+)/);
  if (match) {
    const roId = match[1];
    if (roId !== lastRoId) {
      lastRoId = roId;
      admAutoFetchRO(roId);
    }
  } else {
    if (lastRoId !== null) {
      lastRoId  = null;
      tmContext  = null;
      hideTMBanner();
      amaLoadVehicleContext();
    }
  }
}

function admAutoFetchRO(roId) {
  chrome.runtime.sendMessage(
    { action: 'adm_tmGetRO', roNumber: roId, credentials: tmCredentials },
    response => {
      if (response?.success) {
        admLoadRO(response.data);
      } else {
        console.error('[Admin Hub TM] Auto-fetch failed:', response?.error);
      }
    }
  );
}

// ── Load RO data into state and tools ─────────────────────────────
function admLoadRO(data) {
  const s = data.summary;
  tmContext = {
    roNumber:     s.roNumber,
    customerName: s.customer,
    vehicle:      s.vehicle,
    mileage:      s.odometer,
    year:         s.vehicle?.split(' ')[0] || '',
    make:         s.vehicle?.split(' ')[1] || '',
    model:        s.vehicle?.split(' ').slice(2).join(' ') || '',
    formatted:    data.formatted || ''
  };

  showTMBanner(buildTMLabel(tmContext));
  amaLoadVehicleContext();
}

// ── TM Status ──────────────────────────────────────────────────────
function admTMSetStatus(state, text) {
  const dot  = document.getElementById('tm-dot');
  const span = document.getElementById('tm-status-text');
  const row  = document.getElementById('tm-status-row');
  if (!dot || !span) return;
  dot.className    = 'tm-dot ' + state;
  span.textContent = text;
  if (row) row.classList.add('visible');
}

function admTMTestConnection() {
  if (!tmCredentials) return;
  chrome.runtime.sendMessage(
    { action: 'adm_tmTestConnection', credentials: tmCredentials },
    response => {
      if (response?.success) {
        admTMSetStatus('connected', 'Connected · Shop ' + (tmCredentials.shopId || ''));
      } else {
        admTMSetStatus('error', 'Check credentials');
      }
    }
  );
}


// ════════════════════════════════════════
// ASK ME ANYTHING
// ════════════════════════════════════════

// State
let amaCustomerLocation = null; // 'inperson' | 'phone'
let amaReviewSentiment  = null; // 'positive' | 'negative'
let amaCustomerHistory  = [];
let amaReviewHistory    = [];

function initAMA() {
  // Mode menu
  document.getElementById('ama-mode-customer').addEventListener('click', () => amaShowView('ama-customer-view'));
  document.getElementById('ama-mode-review').addEventListener('click',   () => amaShowView('ama-review-view'));

  // Back buttons
  document.getElementById('ama-back-customer').addEventListener('click', amaReturnMenu);
  document.getElementById('ama-back-review').addEventListener('click',   amaReturnMenu);

  // Location toggles
  document.getElementById('ama-loc-inperson').addEventListener('click', () => amaSetLocation('inperson'));
  document.getElementById('ama-loc-phone').addEventListener('click',    () => amaSetLocation('phone'));

  // Review sentiment
  document.getElementById('ama-review-positive').addEventListener('click', () => amaSetSentiment('positive'));
  document.getElementById('ama-review-negative').addEventListener('click', () => amaSetSentiment('negative'));

  // Generate buttons
  document.getElementById('ama-customer-generate').addEventListener('click', amaGenerateCustomer);
  document.getElementById('ama-review-generate').addEventListener('click',   amaGenerateReview);

  // Copy buttons
  document.getElementById('ama-customer-copy').addEventListener('click', () => {
    const text = document.getElementById('ama-customer-response-text').textContent;
    navigator.clipboard.writeText(text);
    amaCopyFlash('ama-customer-copy');
  });
  document.getElementById('ama-review-copy').addEventListener('click', () => {
    const text = document.getElementById('ama-review-response-text').textContent;
    navigator.clipboard.writeText(text);
    amaCopyFlash('ama-review-copy');
  });

  // Start over buttons — return to AMA menu
  document.getElementById('ama-customer-reset').addEventListener('click', () => {
    amaResetCustomer();
    amaShowView('ama-menu');
  });
  document.getElementById('ama-review-reset').addEventListener('click', () => {
    amaResetReview();
    amaShowView('ama-menu');
  });
  document.getElementById('ama-review-another').addEventListener('click', () => {
    amaResetReview();
    // Stay on the review view — just clear and ready for the next one
    amaShowView('ama-review-view');
  });

  // Feedback chips
  document.querySelectorAll('#ama-customer-result .ama-chip').forEach(chip => {
    chip.addEventListener('click', () => amaHandleChip(chip, 'customer'));
  });
  document.querySelectorAll('#ama-review-result .ama-chip').forEach(chip => {
    chip.addEventListener('click', () => amaHandleChip(chip, 'review'));
  });

  // Refinement send
  document.getElementById('ama-customer-refine-send').addEventListener('click', () => amaRefineSend('customer'));
  document.getElementById('ama-customer-refine-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); amaRefineSend('customer'); }
  });
  document.getElementById('ama-customer-followup-send').addEventListener('click', () => amaFollowUpSend());
  document.getElementById('ama-customer-followup-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); amaFollowUpSend(); }
  });
  document.getElementById('ama-review-refine-send').addEventListener('click', () => amaRefineSend('review'));
  document.getElementById('ama-review-refine-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); amaRefineSend('review'); }
  });
}

// ── View navigation ──
function amaShowView(viewId) {
  document.querySelectorAll('#tool-a-content .ama-view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId)?.classList.add('active');
  document.getElementById('tool-body').scrollTop = 0;

  // When entering customer view, check TM context
  if (viewId === 'ama-customer-view') amaLoadVehicleContext();
}

function amaReturnMenu() {
  amaResetCustomer();
  amaResetReview();
  amaShowView('ama-menu');
}

// ── Location toggle ──
function amaSetLocation(loc) {
  amaCustomerLocation = loc;
  document.getElementById('ama-loc-inperson').classList.toggle('active', loc === 'inperson');
  document.getElementById('ama-loc-phone').classList.toggle('active',    loc === 'phone');
}

// ── Sentiment toggle ──
function amaSetSentiment(sentiment) {
  amaReviewSentiment = sentiment;
  document.getElementById('ama-review-positive').classList.toggle('active', sentiment === 'positive');
  document.getElementById('ama-review-negative').classList.toggle('active', sentiment === 'negative');
}

// ── Load vehicle context from TM ──
function amaLoadVehicleContext() {
  if (!tmContext) {
    document.getElementById('ama-vehicle-pill').classList.remove('active');
    const reviewPill = document.getElementById('ama-review-vehicle-pill');
    if (reviewPill) reviewPill.style.display = 'none';
    document.getElementById('ama-related-ro')?.classList.remove('active');
    return;
  }

  // Build label
  const parts = [];
  if (tmContext.vehicle) {
    parts.push(tmContext.vehicle);
  } else {
    if (tmContext.year)  parts.push(tmContext.year);
    if (tmContext.make)  parts.push(tmContext.make);
    if (tmContext.model) parts.push(tmContext.model);
  }
  if (tmContext.mileage) parts.push(Number(tmContext.mileage).toLocaleString() + ' mi');
  const label = parts.join(' ') || 'Vehicle loaded';

  // Customer question pill
  document.getElementById('ama-vehicle-pill-text').textContent = label;
  document.getElementById('ama-vehicle-pill').classList.add('active');

  // Review view pill
  const reviewPill = document.getElementById('ama-review-vehicle-pill');
  const reviewPillText = document.getElementById('ama-review-vehicle-pill-text');
  if (reviewPill && reviewPillText) {
    reviewPillText.textContent = 'RO #' + (tmContext.roNumber || 'N/A') + ' · ' + label;
    reviewPill.style.display = 'flex';
  }

  // Related ROs
  if (tmContext.relatedROs && tmContext.relatedROs.length) {
    document.getElementById('ama-related-ro-text').textContent =
      ' ' + tmContext.relatedROs.map(ro => `RO #${ro.number} (${ro.summary})`).join(', ');
    document.getElementById('ama-related-ro')?.classList.add('active');
  }
}

// ── Generate: Customer Question ──
async function amaGenerateCustomer() {
  const question = document.getElementById('ama-question-input').value.trim();
  if (!question) { alert('Please enter the customer\'s question first.'); return; }
  if (!amaCustomerLocation) { alert('Please select whether the customer is in person or on the phone.'); return; }

  const context  = document.getElementById('ama-context-input').value.trim();
  const hasRO    = !!tmContext;
  const isPhone  = amaCustomerLocation === 'phone';
  const dropOffMode = isPhone && !hasRO;

  const systemPrompt = amaCustomerSystemPrompt();
  const userMsg = amaCustomerUserMsg(question, context, hasRO, isPhone, dropOffMode);

  amaCustomerHistory = [{ role: 'user', content: userMsg }];

  document.getElementById('ama-customer-generate').disabled = true;
  document.getElementById('ama-customer-loading').classList.add('active');
  document.getElementById('ama-customer-result').style.display = 'none';

  try {
    const reply = await amaCallAPI(systemPrompt, amaCustomerHistory);
    amaCustomerHistory.push({ role: 'assistant', content: reply });
    document.getElementById('ama-customer-response-text').textContent = reply;
    document.getElementById('ama-customer-result').style.display = 'block';
  } catch(err) {
    alert('Error generating response. Please check your API key in Settings and try again.');
    console.error(err);
  }

  document.getElementById('ama-customer-loading').classList.remove('active');
  document.getElementById('ama-customer-generate').disabled = false;
  document.getElementById('tool-body').scrollTop = 9999;
}

function amaCustomerUserMsg(question, context, hasRO, isPhone, dropOffMode) {
  let msg = '';

  if (dropOffMode) {
    msg += `MODE: Phone call — customer does NOT have an existing repair order. Goal is to help them decide to drop off their vehicle.\n\n`;
  } else if (isPhone && hasRO) {
    msg += `MODE: Phone call — customer HAS an open repair order. Use the full RO details below to give a specific, informed answer — do NOT respond generically.\n`;
    msg += amaVehicleContext();
    msg += '\n';
  } else {
    msg += `MODE: Customer is in person at the shop. Use the full RO details below to give a specific, informed answer — do NOT respond generically.\n`;
    if (hasRO) { msg += amaVehicleContext() + '\n'; }
  }

  // Always include full RO data when available — this is the authoritative source
  if (hasRO && tmContext?.formatted) {
    msg += `\nFULL REPAIR ORDER DATA (use this to answer specifically — do not ignore these details):\n${tmContext.formatted}\n`;
  }

  msg += `\nCUSTOMER QUESTION / SITUATION:\n${question}`;
  if (context) msg += `\n\nADDITIONAL CONTEXT:\n${context}`;

  if (hasRO && tmContext?.relatedROs?.length) {
    msg += `\n\nRELATED REPAIR ORDERS ON FILE:\n`;
    msg += tmContext.relatedROs.map(ro => `• RO #${ro.number}: ${ro.summary}`).join('\n');
    msg += '\nNote these at the start of your response if relevant.';
  }

  return msg;
}

function amaVehicleContext() {
  if (!tmContext) return '';
  const parts = [];
  if (tmContext.year)     parts.push(`Year: ${tmContext.year}`);
  if (tmContext.make)     parts.push(`Make: ${tmContext.make}`);
  if (tmContext.model)    parts.push(`Model: ${tmContext.model}`);
  if (tmContext.mileage)  parts.push(`Mileage: ${Number(tmContext.mileage).toLocaleString()}`);
  if (tmContext.roNumber) parts.push(`RO: #${tmContext.roNumber}`);
  return parts.join(' | ');
}

// ── Generate: Google Review ──
async function amaGenerateReview() {
  const reviewText = document.getElementById('ama-review-input').value.trim();
  if (!reviewText) { alert('Please enter or describe the review first.'); return; }
  if (!amaReviewSentiment) { alert('Please select Positive or Negative.'); return; }

  const context = document.getElementById('ama-review-context-input').value.trim();
  const systemPrompt = amaReviewSystemPrompt();

  // Build user message with optional RO context
  let userMsg = `REVIEW TYPE: ${amaReviewSentiment === 'positive' ? 'Positive' : 'Negative'}\n\nREVIEW TEXT:\n${reviewText}`;

  if (tmContext) {
    userMsg += `\n\nREPAIR ORDER CONTEXT (use only if directly relevant to the review topic):\n`;
    userMsg += `Vehicle: ${tmContext.vehicle || 'N/A'}\n`;
    userMsg += `Odometer: ${tmContext.mileage || 'N/A'}\n`;
    userMsg += `RO #: ${tmContext.roNumber || 'N/A'}\n`;
    if (tmContext.formatted) {
      userMsg += `\nServices on this RO:\n${tmContext.formatted}`;
    }
    userMsg += `\n\nIMPORTANT: Do NOT claim we did not perform any service. If the review mentions something we can't confirm, acknowledge any communication gap ("we may not have communicated that clearly enough") rather than denying the work was done.`;
  }

  if (context) userMsg += `\n\nADDITIONAL CONTEXT:\n${context}`;

  amaReviewHistory = [{ role: 'user', content: userMsg }];

  document.getElementById('ama-review-generate').disabled = true;
  document.getElementById('ama-review-loading').classList.add('active');
  document.getElementById('ama-review-result').style.display = 'none';

  try {
    const reply = await amaCallAPI(systemPrompt, amaReviewHistory);
    amaReviewHistory.push({ role: 'assistant', content: reply });
    document.getElementById('ama-review-response-text').textContent = reply;
    document.getElementById('ama-review-result').style.display = 'block';
  } catch(err) {
    alert('Error generating response. Please check your API key in Settings and try again.');
    console.error(err);
  }

  document.getElementById('ama-review-loading').classList.remove('active');
  document.getElementById('ama-review-generate').disabled = false;
  document.getElementById('tool-body').scrollTop = 9999;
}

// ── Chip feedback → regenerate ──
function amaHandleChip(chip, mode) {
  const group = chip.dataset.group;
  const val   = chip.dataset.val;

  // Mark selected within the correct result container only
  const containerId = mode === 'customer' ? '#ama-customer-result' : '#ama-review-result';
  document.querySelectorAll(`${containerId} [data-group="${group}"]`).forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
  if (val === 'good') return; // "Just right" — no action needed

  const lengthMap    = { shorter: 'Please make the response shorter and more concise.', longer: 'Please make the response longer and more thorough.' };
  const techMap      = { less: 'Please simplify the language — less technical, easier for the customer to understand.', more: 'Please add more technical detail and specifics.' };
  const reviewLenMap = { shorter: 'Please shorten this response.', longer: 'Please make this response a bit longer.' };

  let refineMsg = '';
  if (group === 'length')        refineMsg = lengthMap[val];
  if (group === 'technical')     refineMsg = techMap[val];
  if (group === 'review-length') refineMsg = reviewLenMap[val];

  if (refineMsg) amaRefineSendMsg(mode, refineMsg, true);
}

// ── Refinement thread ──
async function amaRefineSend(mode) {
  const inputId = mode === 'customer' ? 'ama-customer-refine-input' : 'ama-review-refine-input';
  const msg = document.getElementById(inputId).value.trim();
  if (!msg) return;
  document.getElementById(inputId).value = '';
  amaRefineSendMsg(mode, msg, false);
}

async function amaRefineSendMsg(mode, msg, fromChip = false) {
  const history       = mode === 'customer' ? amaCustomerHistory : amaReviewHistory;
  const systemPrompt  = mode === 'customer' ? amaCustomerSystemPrompt() : amaReviewSystemPrompt();
  const responseBoxId = mode === 'customer' ? 'ama-customer-response-text' : 'ama-review-response-text';
  const threadId      = mode === 'customer' ? 'ama-customer-thread' : 'ama-review-thread';
  const sendBtnId     = mode === 'customer' ? 'ama-customer-refine-send' : 'ama-review-refine-send';
  const refineInputId = mode === 'customer' ? 'ama-customer-refine-input' : 'ama-review-refine-input';

  // Show user bubble in thread (chip calls show what was requested)
  const thread = document.getElementById(threadId);
  const userBubble = document.createElement('div');
  userBubble.style.cssText = 'text-align:right;margin-bottom:6px;';
  userBubble.innerHTML = `<span style="display:inline-block;background:#FDF4F0;border:1px solid #E8C4B0;border-radius:10px;padding:5px 10px;font-size:11px;color:#7A3520;max-width:85%;">${escapeHTML(msg)}</span>`;
  thread.appendChild(userBubble);
  thread.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Show "updating…" in response box while waiting
  const responseBox = document.getElementById(responseBoxId);
  const previousText = responseBox.textContent;
  responseBox.style.opacity = '0.45';

  history.push({ role: 'user', content: msg });

  // Disable inputs during call
  document.getElementById(sendBtnId).disabled = true;
  document.getElementById(refineInputId).disabled = true;

  try {
    const reply = await amaCallAPI(systemPrompt, history);
    history.push({ role: 'assistant', content: reply });
    responseBox.textContent = reply;
    responseBox.style.opacity = '1';

    // Add AI confirmation bubble in thread
    const aiBubble = document.createElement('div');
    aiBubble.style.cssText = 'text-align:left;margin-bottom:8px;';
    aiBubble.innerHTML = `<span style="display:inline-block;background:#eafaf1;border:1px solid #c3e6cb;border-radius:10px;padding:5px 10px;font-size:11px;color:#1a6b3a;max-width:85%;">✓ Updated</span>`;
    thread.appendChild(aiBubble);

    document.getElementById('tool-body').scrollTop = 0; // Scroll back up to show updated response
  } catch(err) {
    responseBox.textContent = previousText;
    responseBox.style.opacity = '1';
    console.error(err);
    const errBubble = document.createElement('div');
    errBubble.style.cssText = 'text-align:left;margin-bottom:8px;';
    errBubble.innerHTML = `<span style="display:inline-block;background:#fdecea;border:1px solid #f5c6cb;border-radius:10px;padding:5px 10px;font-size:11px;color:#c0392b;max-width:85%;">Error — please try again</span>`;
    thread.appendChild(errBubble);
  }

  document.getElementById(sendBtnId).disabled = false;
  document.getElementById(refineInputId).disabled = false;
}

// ── Reset ──

// ── Follow-up question — appends answer below existing response ──
async function amaFollowUpSend() {
  const input   = document.getElementById('ama-customer-followup-input');
  const question = input.value.trim();
  if (!question) return;

  input.value    = '';
  input.disabled = true;
  document.getElementById('ama-customer-followup-send').disabled = true;
  document.getElementById('ama-customer-followup-loading').style.display = 'block';

  // Build a fresh single-turn prompt — provide the full conversation context
  // but ask for a standalone answer to append, not a replacement
  const currentResponse = document.getElementById('ama-customer-response-text').textContent;
  const followUpMessages = [
    ...amaCustomerHistory,
    {
      role: 'user',
      content: `The advisor has a follow-up question for you to answer separately. Do NOT rewrite or replace the previous response. Provide ONLY the answer to this follow-up question as a standalone paragraph to be added after the existing response:\n\n${question}`
    }
  ];

  const resultsContainer = document.getElementById('ama-customer-followup-results');

  try {
    const reply = await amaCallAPI(amaCustomerSystemPrompt(), followUpMessages);

    // Append a new answer block
    const block = document.createElement('div');
    block.style.cssText = 'margin-top:10px;padding:10px 12px;background:#FDF4F0;border:1px solid #E8C4B0;border-radius:8px;font-size:13px;color:#2d3748;line-height:1.6;';
    block.textContent = reply;

    // Add a small copy button for each follow-up block
    const copyBtn = document.createElement('button');
    copyBtn.type      = 'button';
    copyBtn.textContent = '📋 Copy';
    copyBtn.style.cssText = 'margin-top:7px;display:inline-block;background:none;border:1px solid #E8C4B0;border-radius:6px;padding:3px 10px;font-size:11px;color:#7A3520;cursor:pointer;';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(reply);
      const orig = copyBtn.textContent;
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => { copyBtn.textContent = orig; }, 2000);
    });

    block.appendChild(document.createElement('br'));
    block.appendChild(copyBtn);
    resultsContainer.appendChild(block);
    document.getElementById('tool-body').scrollTop = 9999;

  } catch(err) {
    const errBlock = document.createElement('div');
    errBlock.style.cssText = 'margin-top:8px;padding:8px 10px;background:#fdecea;border:1px solid #f5c6cb;border-radius:8px;font-size:11px;color:#c0392b;';
    errBlock.textContent = 'Error — please try again.';
    resultsContainer.appendChild(errBlock);
    console.error('[Follow-up error]', err);
  }

  document.getElementById('ama-customer-followup-loading').style.display = 'none';
  input.disabled = false;
  document.getElementById('ama-customer-followup-send').disabled = false;
  input.focus();
}

function amaResetCustomer() {
  amaCustomerHistory = [];
  amaCustomerLocation = null;
  document.getElementById('ama-loc-inperson').classList.remove('active');
  document.getElementById('ama-loc-phone').classList.remove('active');
  document.getElementById('ama-question-input').value = '';
  document.getElementById('ama-context-input').value = '';
  document.getElementById('ama-customer-result').style.display = 'none';
  document.getElementById('ama-customer-loading').classList.remove('active');
  document.getElementById('ama-customer-thread').innerHTML = '';
  document.getElementById('ama-customer-refine-input').value = '';
  document.querySelectorAll('#ama-customer-result .ama-chip').forEach(c => c.classList.remove('selected'));
  // Clear follow-up area
  const followupResults = document.getElementById('ama-customer-followup-results');
  if (followupResults) followupResults.innerHTML = '';
  const followupInput = document.getElementById('ama-customer-followup-input');
  if (followupInput) followupInput.value = '';
  const followupLoading = document.getElementById('ama-customer-followup-loading');
  if (followupLoading) followupLoading.style.display = 'none';
}

function amaResetReview() {
  amaReviewHistory   = [];
  amaReviewSentiment = null;

  // Clear inputs and sentiment
  document.getElementById('ama-review-positive').classList.remove('active');
  document.getElementById('ama-review-negative').classList.remove('active');
  document.getElementById('ama-review-input').value         = '';
  document.getElementById('ama-review-context-input').value = '';
  document.getElementById('ama-review-refine-input').value  = '';

  // Hide result + loading
  const result  = document.getElementById('ama-review-result');
  const loading = document.getElementById('ama-review-loading');
  if (result)  { result.style.display  = 'none'; result.style.visibility = ''; }
  if (loading) { loading.style.display = 'none'; loading.classList.remove('active'); }

  // Clear thread messages and chip selections
  const thread = document.getElementById('ama-review-thread');
  if (thread) thread.innerHTML = '';
  document.querySelectorAll('#ama-review-result .ama-chip').forEach(c => c.classList.remove('selected'));

  // Clear response text
  const responseBox = document.getElementById('ama-review-response-text');
  if (responseBox) responseBox.textContent = '';
}

// ── Copy flash ──
function amaCopyFlash(btnId) {
  const btn = document.getElementById(btnId);
  const orig = btn.textContent;
  btn.textContent = '✓ Copied!';
  setTimeout(() => { btn.textContent = orig; }, 2000);
}

// ── API call ──
async function amaCallAPI(systemPrompt, messages) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['adminHubApiKey'], (result) => {
      const apiKey = result.adminHubApiKey;
      if (!apiKey) { reject(new Error('No API key — set it in ⚙️ Settings')); return; }
      chrome.runtime.sendMessage(
        { action: 'adm_amaCall', systemPrompt, messages, apiKey },
        (response) => {
          if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
          if (response?.success) resolve(response.data);
          else reject(new Error(response?.error || 'Unknown error'));
        }
      );
    });
  });
}

// ── System Prompts ──
function amaCustomerSystemPrompt() {
  return `You are the Ask Me Anything assistant for Cardinal Plaza Shell, a premium automotive service center at 8334 Old Keene Mill Rd, Springfield, VA 22152 (703-451-8373 • cardinalplazashell.com).

You help service advisors respond to customers — in person or on the phone — with clarity, warmth, and confidence. You have three response modes:

1. ANSWER A QUESTION — Provide a clear, helpful answer. If vehicle context is available, weave in vehicle-specific information naturally (don't force it). Use analogies and similes where they genuinely help. Never make anything up.

2. OVERCOME AN OBJECTION — Acknowledge the customer's concern with genuine empathy, then address it factually and calmly. Never be defensive. Frame everything as helping them make the best decision for themselves.

3. HELP THEM DECIDE TO DROP OFF (Phone / No RO) — Your goal is to help the customer feel confident and excited about bringing their vehicle in. Lead with our free services and White Glove Concierge experience. Reduce stress. Give them a clear, easy next step.

## CUSTOMER PSYCHOLOGY — HOW TO COMMUNICATE:
Customers don't think in mechanical terms — they think in outcomes: safety, reliability, and avoiding surprises. Reduce their cognitive load by keeping language simple and structured. When someone seems worried, offer clarity and a path forward. When someone seems overwhelmed, break information into small pieces. When someone has budget concerns, prioritize and present options without judgment — they should always feel in control. Use language that calms: "We'll take this step by step." "This helps you stay ahead of surprises." "Here's the simplest path forward."

## OUR FOUR PROMISES (weave in naturally when relevant — never recite as a list):
• To be your trusted advisor
• To help you make the best decisions possible for you
• To provide a unique, no-pressure, transparent, educational environment
• To place the safety of you and your family as our primary goal

## OUR TEAM CREDENTIALS (mention naturally when it builds confidence):
• ASE certified automotive technicians
• Virginia DEQ certified technicians for emission-related repairs
• State-approved Virginia Safety and Emission Inspection Station
• Service advisors with extensive hands-on experience
• A team that has built its reputation on transparency and trust in the Springfield community

## OUR EQUIPMENT & TECHNOLOGY (mention naturally when relevant):
• Latest Hunter alignment equipment
• OE factory scan tools and ADAS calibration equipment
• Autel scan tools and calibration equipment
• OE factory programming and software updates available
• ADAS calibrations for all makes (Kawasaki motorcycles and others)

## OUR FREE SERVICES (always mention relevant ones naturally — especially in drop-off mode):
• Free courtesy check with every visit (complete vehicle inspection — always "courtesy check," never "inspection")
• Free brake check
• Free alignment check
• Free AC performance check
• Free computer / diagnostic code check (check engine light, etc.)
• Free second opinions — no obligation, no pressure
• Free nitrogen top-offs and air for tires
• Free full-service at the gas pumps
• Free car wash certificate
• Free White Glove Concierge: free pickup and delivery of their vehicle from home, work, or anywhere they need
• Free rides home while we service their vehicle
• Free loaner vehicles (by appointment — very popular)
• Comfortable WiFi waiting area
• Maintenance and light repairs available evenings, Saturdays, and Sundays

## OUR VALUE:
We deliver dealership-level expertise and equipment with the personal care of a neighborhood shop. Every visit includes a free courtesy check. We help customers plan ahead so they avoid surprises. We never pressure — we educate.

## CARDINAL PLAZA SHELL BRAND DNA:
- Calm, educational tone — no fear, no pressure
- Customer autonomy: we inform, they decide
- Outcome-focused: Safety, Reliability, Predictability
- Plain language — no jargon unless the customer uses it first
- Warm and genuinely helpful, never salesy
- Hospitality mindset: every guest should leave feeling cared for

## PRICE & COST — HARD PROHIBITION:
NEVER mention, estimate, quote, or discuss price, cost, dollar amounts, or price ranges under any circumstances.
This applies to ALL responses in ALL modes — even if the customer seems to be asking about price indirectly.
If a customer directly and explicitly asks for a price or estimate, respond ONLY by explaining that pricing requires us to see the vehicle first, and invite them to bring it in for our free courtesy check — never provide a number, range, or comparison.
Do NOT say things like "that might run $200–$400" or "brake pads can cost around…" or "that's typically not expensive."
The only exception: if the advisor has specifically told you the actual price from the repair order, you may confirm what was charged — nothing else.

## SERVICE APPROACH — T0 / T6 / T12:
When planning conversations, think in three windows:
- T0 = Today / immediate attention needed
- T6 = Plan for around 6 months from now
- T12 = On the horizon in about a year
Use soft ranges — "about six months," "at your next visit" — never hard deadlines that create pressure.
## CPS MAINTENANCE SCHEDULE — USE THESE EXACT INTERVALS:
These are Cardinal Plaza Shell's defined service intervals. Use them whenever a customer asks about a service, when it's due, or what's coming up.
- Oil service (semi-synthetic): every 6,000 miles / 6 months
- Oil service (full synthetic): every 9,000 miles / 9 months
- Tire rotation: every 6,000 miles / 6 months (same window as oil service)
- Wheel alignment: every 12,000 miles / 12 months
- Brake fluid exchange: every 24,000 miles / 24 months
- Engine coolant service: every 60,000 miles / 60 months
- Power steering fluid: every 30,000 miles / 30 months
- Transmission fluid service: every 50,000 miles / 60 months
- 4WD/AWD fluid service: every 30,000 miles / 30 months
- Differential fluid: every 60,000 miles / 60 months
- Engine air filter: every 15,000 miles / 15 months
- Cabin air filter: every 15,000 miles / 15 months
- Brake inspection: every 12,000 miles / 12 months
- GDI intake cleaning: every 30,000 miles / 30 months
- Shocks/struts: every 90,000 miles / 90 months
Default: 1,000 miles/month driving assumption.
T0 = overdue or due now | T6 = due within 6 months | T12 = due within 12 months.
When a customer asks about a service that's on this schedule, always tell them the CPS interval and — when vehicle data is available — where their specific vehicle stands relative to that interval.

## REQUIRED VOCABULARY:
- "oil service" (never "oil change")
- "courtesy check" (never "inspection")
- "automotive technician" (never just "technician")
- "preventive care" (never "preventive maintenance")
- "address" or "service" (never "fix")
- "concern" or "issue" (never "problem")
- "recommend" or "suggest" (never "must" or "have to")

## ANALOGIES & SIMILES:
Use them when they genuinely help — brake fluid is like the hydraulic fluid in a bicycle brake lever; a cabin air filter is like the HVAC filter in your home. Never force one if it doesn't land naturally.

## CRITICAL — WHEN REPAIR ORDER DATA IS PROVIDED:
If FULL REPAIR ORDER DATA is included in the message, you MUST use it. Reference the actual findings and technician notes by name. Do NOT give generic answers about "common causes" or "possibilities" when you have the real data. Answer as someone who already knows exactly what was found on this specific vehicle.

## RESPONSE STYLE:
Write the response as something the service advisor can say aloud or read directly to the customer. Warm, conversational, clear. Not a list of bullet points unless specifically asked for. No corporate jargon. Lead with the person, not the car.

If vehicle context is provided (year, make, model, mileage), use it to add specificity where genuinely relevant — e.g., "For your 2019 Honda CR-V at 67,000 miles…" But if it doesn't add anything meaningful, don't force it.

If related ROs are mentioned, note any relevant history at the start of your response.`;
}

function amaReviewSystemPrompt() {
  return `You are the Google Review Response assistant for Cardinal Plaza Shell, a premium automotive service center at 8334 Old Keene Mill Rd, Springfield, VA 22152 (703-451-8373 • cardinalplazashell.com).

You write Google review responses on behalf of the shop owner. Every response must feel personal, warm, and genuinely human — never template-sounding. You are writing for two audiences simultaneously: the customer who left the review AND Google's search algorithm.

## WHO WE ARE:
Cardinal Plaza Shell is a full-service automotive shop in Springfield, VA. We combine dealership-level equipment and credentials with the personal care of a neighborhood shop. We are a hospitality business as much as an automotive business. Every guest is treated like family.

## OUR TEAM & CREDENTIALS:
• ASE certified automotive technicians
• Virginia DEQ certified for emission-related repairs
• State-approved Virginia Safety and Emission Inspection Station
• Open evenings, Saturdays, and Sundays for maintenance and light repairs

## OUR EQUIPMENT — USE SPECIFICALLY WHEN THE REVIEW TOPIC CALLS FOR IT:
• Hunter alignment systems: measures and adjusts camber (inward/outward tire tilt), caster (steering axis angle that affects stability and return-to-center), and toe (how much tires point inward or outward) — all three must be within OEM specification or tires wear unevenly and the vehicle pulls
• OE factory scan tools: connect to the vehicle's ECU, BCM, and TCM exactly as the manufacturer intended — reads live data streams, freeze frame data, module-specific DTCs, and performs OEM-level resets and calibrations that generic tools cannot replicate
• Autel ADAS calibration equipment: performs static and dynamic calibration of forward-facing cameras (lane departure warning, automatic emergency braking), radar sensors (adaptive cruise control, blind spot monitoring), and ultrasonic sensors — after any alignment, suspension, or windshield work, these sensors must be recalibrated to their OEM field of view or safety systems will operate incorrectly
• OE factory programming tools: flash and update ECU, TCM, BCM, and module software to current manufacturer specifications
• Precision brake measurement tools: pad thickness in millimeters, rotor thickness and lateral runout

## TECHNICAL LANGUAGE — USE WHEN THE REVIEW TOPIC CALLS FOR IT:
Always follow technical terms with a plain-language "why it matters":
- camber, caster, toe → "the angles that determine how your tires contact the road and protect even tread life"
- ADAS recalibration → "after alignment work, your forward-facing cameras and radar sensors must be re-aimed to their factory field of view — otherwise safety systems like automatic emergency braking and lane departure warning can't operate accurately"
- OBD-II live data scan → "reading your engine's real-time sensor output to find what's actually causing the symptom, not just what code was stored"
- brake rotor lateral runout → "checking whether the rotor surface is perfectly flat, because even a small warp causes pedal pulsation under braking"

## OUR FREE SERVICES — MENTION NATURALLY WHEN RELEVANT:
Free courtesy check, free brake check, free alignment check, free AC check, free computer diagnostic scan, free second opinions, free White Glove Concierge (vehicle pickup and delivery from home or office), free rides home, free loaner vehicles (by appointment), free car wash certificate, free nitrogen top-offs.

## OUR FOUR PROMISES — WEAVE IN NATURALLY, NEVER LIST:
To be your trusted advisor • To help you make the best decisions possible for you • To provide a no-pressure, transparent, educational environment • To place the safety of you and your family as our primary goal

## ═══════════════════════════════════════
## POSITIVE REVIEW RULES
## ═══════════════════════════════════════
KEEP IT SHORT AND SWEET — 2 to 4 sentences maximum. No exceptions.

- Lead with warmth and genuine thanks — thank the customer for their business AND for taking the time to leave a review. Make this feel personal and real, not a checkbox.
- If you know what service was performed from the review or RO context, you may reference it briefly and naturally. If you don't know, that is completely fine — thank them warmly without it. Never fish for details they didn't provide.
- NEVER make the customer feel bad about their review or like it wasn't detailed enough.
- NEVER mention price, cost, or value in a positive response unless the customer specifically raised it in their review.
- NEVER reference other locations, towns, areas, or other shops. Only mention Cardinal Plaza Shell in Springfield, VA.
- Do not lecture. Do not list credentials or equipment unless it flows completely naturally in 1–2 words.
- One Google keyword signal is enough — a service name, "Springfield, VA," our shop name, or a single credential woven in warmly.
- Never start with "Thank you for your review" — find a natural, human opening every single time.

## ═══════════════════════════════════════
## NEGATIVE REVIEW RULES
## ═══════════════════════════════════════
- Lead with genuine empathy FIRST — make the customer feel heard before anything else.
- Thank them sincerely for both their business and their feedback — it genuinely helps us improve.
- NEVER say or imply we did not perform a service. You don't know what was done. If something is in question, acknowledge a communication failure, not a service failure. Use language like: "we clearly didn't do a good enough job explaining that" or "that's on us for not walking you through it more thoroughly upfront."
- Add technical depth where it helps EXPLAIN the service — what was involved, what equipment was used, WHY it was required. This helps the customer understand and signals expertise to Google.
- Take genuine ownership of the communication gap — no defensiveness.
- NEVER mention price or make cost comparisons unless the customer raised it.
- NEVER reference other locations, towns, or shops. Only Cardinal Plaza Shell in Springfield, VA.
- Offer a clear path forward: call 703-451-8373, ask for Scott, or email service@cardinalplazashell.com.
- End with a warm, genuine invitation to return — not a demand.
- NEVER use: "We apologize for any inconvenience," "We strive to provide," "We take pride in."
- Each response must feel fresh and specific to what that customer experienced.

## THANKING THE CUSTOMER — REQUIRED ON ALL RESPONSES:
Always thank the customer for their business AND their review. For positive reviews: warm and celebratory. For negative reviews: sincere and humble. Never make it feel like a checkbox.

## GOOGLE OPTIMIZATION — WOVEN IN NATURALLY:
Service terms: oil service, brake service, tire rotation, four-wheel alignment, wheel alignment, AC service, engine diagnostics, ADAS calibration, emission inspection, courtesy check, transmission service.
Technical terms (when relevant to the review): camber, caster, toe, OBD-II, live data, DTCs, ADAS, AEB, lane departure, radar calibration, camera calibration.
Equipment (when relevant): Hunter alignment system, Autel ADAS calibration, OE factory scan tools.
Credentials (when relevant): ASE certified, Virginia DEQ certified, ADAS calibration, Safety and Emission Inspection.
Location: Springfield, VA — ONLY. Never reference other towns, areas, or shops.

## IF RO CONTEXT IS PROVIDED:
Use it to make the response specific and credible. Reference the vehicle and services naturally. For negative reviews, use the RO to explain the technical "why" behind the work. Never fabricate details not in the RO.

## CRITICAL OUTPUT RULES:
- Respond with ONLY the review response text — no labels, no preamble, no explanation, no quotation marks
- Never start two responses the same way
- Write like the shop owner — someone who genuinely cares, knows the craft deeply, and wants every customer to feel valued
- Positive: short, warm, human — 2 to 4 sentences, full stop
- Negative: empathetic, technically credible, accountable, with a clear path forward`;
}




let sodHistory  = [];
let sodMsgCount = 0;
let sodDefinition = '';

function initSOD() {
  document.getElementById('sod-develop-btn')?.addEventListener('click', sodStartDevelop);
  document.getElementById('sod-marketing-btn')?.addEventListener('click', () => sodShowView('sod-marketing-view'));

  document.getElementById('sod-back-1')?.addEventListener('click', sodReturnMenu);
  document.getElementById('sod-back-2')?.addEventListener('click', sodReturnMenu);
  document.getElementById('sod-back-3')?.addEventListener('click', sodReturnMenu);

  document.getElementById('sod-send-btn')?.addEventListener('click', sodSendMessage);
  document.getElementById('sod-chat-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sodSendMessage(); }
  });

  document.getElementById('sod-build-btn')?.addEventListener('click', sodBuildPackage);
  document.getElementById('sod-copy-def-btn')?.addEventListener('click', sodCopyDefinition);
  document.getElementById('sod-to-mktg-btn')?.addEventListener('click', sodPrefillMarketing);
  document.getElementById('sod-new-service-btn')?.addEventListener('click', sodReturnMenu);
  document.getElementById('sod-mktg-generate-btn')?.addEventListener('click', sodGenerateMarketing);
}

function sodShowView(viewId) {
  document.querySelectorAll('#tool-b-content .sod-view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId)?.classList.add('active');
  // Scroll tool body to top when changing views
  document.getElementById('tool-body').scrollTop = 0;
}

function sodReturnMenu() {
  sodHistory    = [];
  sodMsgCount   = 0;
  sodDefinition = '';
  document.getElementById('sod-chat-messages').innerHTML = '';
  document.getElementById('sod-chat-input').value = '';
  document.getElementById('sod-build-bar').classList.remove('active');
  document.getElementById('sod-definition-sections').innerHTML = '';
  document.getElementById('sod-mktg-results').style.display = 'none';
  document.getElementById('sod-mktg-form').style.display = 'block';
  sodShowView('sod-menu');
}

function sodStartDevelop() {
  sodShowView('sod-chat-view');
  sodAddAIMsg("What service are you thinking about offering? Give me a brief idea and I'll help you develop it into a complete offering.");
}

async function sodSendMessage() {
  const input = document.getElementById('sod-chat-input');
  const text  = input.value.trim();
  if (!text) return;

  sodAddUserMsg(text);
  sodHistory.push({ role: 'user', content: text });
  sodMsgCount++;
  input.value = '';
  input.disabled = true;
  document.getElementById('sod-send-btn').disabled = true;
  sodShowTyping();

  try {
    const reply = await sodCallAPI(sodBuildDevPrompt(), sodHistory);
    sodHideTyping();
    sodAddAIMsg(reply);
    sodHistory.push({ role: 'assistant', content: reply });
    if (sodMsgCount >= 2) document.getElementById('sod-build-bar').classList.add('active');
  } catch(err) {
    sodHideTyping();
    sodAddAIMsg('Sorry, something went wrong. Please try again.');
    console.error(err);
  }

  input.disabled = false;
  document.getElementById('sod-send-btn').disabled = false;
  input.focus();
}

function sodAddUserMsg(text) {
  const div = document.createElement('div');
  div.className = 'msg msg-user';
  div.innerHTML = `<span>${escapeHTML(text)}</span>`;
  document.getElementById('sod-chat-messages').appendChild(div);
  sodScrollChat();
}

function sodAddAIMsg(text) {
  const div = document.createElement('div');
  div.className = 'msg msg-ai';
  div.innerHTML = `<span>${sodFormatText(text)}</span>`;
  document.getElementById('sod-chat-messages').appendChild(div);
  sodScrollChat();
}

function sodShowTyping() {
  const div = document.createElement('div');
  div.className = 'msg msg-ai';
  div.id = 'sod-typing';
  div.innerHTML = '<span class="typing-indicator"><span></span><span></span><span></span></span>';
  document.getElementById('sod-chat-messages').appendChild(div);
  sodScrollChat();
}

function sodHideTyping() {
  document.getElementById('sod-typing')?.remove();
}

function sodScrollChat() {
  const c = document.getElementById('sod-chat-messages');
  c.scrollTop = c.scrollHeight;
}

async function sodBuildPackage() {
  document.getElementById('sod-build-btn').disabled = true;
  document.getElementById('sod-chat-input').disabled = true;
  document.getElementById('sod-send-btn').disabled = true;
  sodShowTyping();

  try {
    const recPrompt = "I'm ready to build the service package. Based on everything we've discussed, please RECOMMEND the ideal frequency and target vehicles for this service. Be specific and explain your reasoning briefly for each recommendation. End with: 'Click Generate below whenever you\\'re ready.'";
    sodHistory.push({ role: 'user', content: recPrompt });
    const recReply = await sodCallAPI(sodBuildDevPrompt(), sodHistory);
    sodHideTyping();
    sodAddAIMsg(recReply);
    sodHistory.push({ role: 'assistant', content: recReply });

    const btn = document.createElement('div');
    btn.style.cssText = 'text-align:center;margin:14px 0;';
    btn.innerHTML = '<button id="sod-final-gen-btn" type="button" style="background:linear-gradient(135deg,#28a745,#20c997);color:white;border:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">✓ Generate Final Service Definition</button>';
    document.getElementById('sod-chat-messages').appendChild(btn);
    sodScrollChat();
    document.getElementById('sod-final-gen-btn').addEventListener('click', sodGenerateDefinition);

    document.getElementById('sod-chat-input').disabled = false;
    document.getElementById('sod-send-btn').disabled = false;
  } catch(err) {
    sodHideTyping();
    sodAddAIMsg('Sorry, something went wrong. Please try again.');
    console.error(err);
    document.getElementById('sod-build-btn').disabled = false;
    document.getElementById('sod-chat-input').disabled = false;
    document.getElementById('sod-send-btn').disabled = false;
  }
}

async function sodGenerateDefinition() {
  document.getElementById('sod-final-gen-btn').disabled = true;
  document.getElementById('sod-final-gen-btn').textContent = 'Generating…';
  sodShowTyping();

  try {
    const genMsg = `Now generate the complete SERVICE DEFINITION document. Use EXACTLY these section headers (##):

## SERVICE NAME
## SERVICE DESCRIPTION
## WHAT'S INCLUDED
## TIME ESTIMATE
## RECOMMENDED FREQUENCY
## TARGET VEHICLES
## WHY IT MATTERS
## CUSTOMER BENEFITS
## SERVICE ADVISOR TALKING POINTS
## WHEN TO RECOMMEND

Use Cardinal Plaza Shell's voice throughout. Be thorough and specific.`;

    sodHistory.push({ role: 'user', content: genMsg });
    const defText = await sodCallAPI(sodBuildDevPrompt(), sodHistory);
    sodHideTyping();
    sodHistory.push({ role: 'assistant', content: defText });
    sodDefinition = defText;

    sodPopulateDefinition(defText);
    sodShowView('sod-definition-view');
  } catch(err) {
    sodHideTyping();
    sodAddAIMsg('Error generating definition. Please try again.');
    console.error(err);
    document.getElementById('sod-final-gen-btn').disabled = false;
    document.getElementById('sod-final-gen-btn').textContent = '✓ Generate Final Service Definition';
  }
}

const SOD_SECTIONS = [
  { key: 'name',        label: '📋 Service Name',                   id: 'sod-sec-name',     rows: 2 },
  { key: 'description', label: '📝 Service Description',            id: 'sod-sec-desc',     rows: 3 },
  { key: 'included',    label: "✅ What's Included",                 id: 'sod-sec-incl',     rows: 8 },
  { key: 'time',        label: '⏱️ Time Estimate',                   id: 'sod-sec-time',     rows: 2 },
  { key: 'frequency',   label: '📅 Recommended Frequency',           id: 'sod-sec-freq',     rows: 2 },
  { key: 'target',      label: '🚗 Target Vehicles',                 id: 'sod-sec-target',   rows: 3 },
  { key: 'why',         label: '💡 Why It Matters',                  id: 'sod-sec-why',      rows: 5 },
  { key: 'benefits',    label: '⭐ Customer Benefits',               id: 'sod-sec-benefits', rows: 5 },
  { key: 'talking',     label: '💬 Service Advisor Talking Points',  id: 'sod-sec-talking',  rows: 6 },
  { key: 'when',        label: '🎯 When to Recommend',               id: 'sod-sec-when',     rows: 5 }
];

const SOD_HEADERS = {
  name:        '## SERVICE NAME',
  description: '## SERVICE DESCRIPTION',
  included:    "## WHAT'S INCLUDED",
  time:        '## TIME ESTIMATE',
  frequency:   '## RECOMMENDED FREQUENCY',
  target:      '## TARGET VEHICLES',
  why:         '## WHY IT MATTERS',
  benefits:    '## CUSTOMER BENEFITS',
  talking:     '## SERVICE ADVISOR TALKING POINTS',
  when:        '## WHEN TO RECOMMEND'
};

function sodExtract(content, key) {
  const header = SOD_HEADERS[key];
  const regex = new RegExp(
    `${header.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*\\n([\\s\\S]*?)(?=##|$)`, 'i'
  );
  const m = content.match(regex);
  return m ? m[1].trim() : '';
}

function sodPopulateDefinition(content) {
  const container = document.getElementById('sod-definition-sections');
  container.innerHTML = '';
  SOD_SECTIONS.forEach(sec => {
    const value = sodExtract(content, sec.key);
    const div = document.createElement('div');
    div.className = 'def-section';
    div.innerHTML = `
      <div class="def-section-header">
        <h4>${sec.label}</h4>
        <button class="regen-btn" data-key="${sec.key}" type="button">↺ Regenerate</button>
      </div>
      <textarea class="def-textarea" id="${sec.id}" rows="${sec.rows}">${value}</textarea>
    `;
    container.appendChild(div);
  });
  container.querySelectorAll('.regen-btn').forEach(btn => {
    btn.addEventListener('click', () => sodRegenSection(btn.dataset.key, btn));
  });
}

async function sodRegenSection(key, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  const sec = SOD_SECTIONS.find(s => s.key === key);
  try {
    const prompt = `Regenerate ONLY the "${sec.label.replace(/^[^\s]+\s/,'')}" section. Keep consistent with everything discussed. Use Cardinal Plaza Shell's voice. Return only the section content, no header.`;
    sodHistory.push({ role: 'user', content: prompt });
    const reply = await sodCallAPI(sodBuildDevPrompt(), sodHistory);
    sodHistory.push({ role: 'assistant', content: reply });
    document.getElementById(sec.id).value = reply.trim();
  } catch(err) {
    alert('Error regenerating section. Please try again.');
  }
  btn.disabled = false;
  btn.textContent = '↺ Regenerate';
}

function sodCopyDefinition() {
  const parts = SOD_SECTIONS.map(s => {
    const val = document.getElementById(s.id)?.value || '';
    return `${SOD_HEADERS[s.key]}\n${val}`;
  });
  navigator.clipboard.writeText(parts.join('\n\n'));
  const btn = document.getElementById('sod-copy-def-btn');
  const orig = btn.textContent;
  btn.textContent = '✓ Copied!';
  setTimeout(() => btn.textContent = orig, 2000);
}

function sodPrefillMarketing() {
  document.getElementById('sod-mktg-name').value  = document.getElementById('sod-sec-name')?.value  || '';
  document.getElementById('sod-mktg-desc').value  = document.getElementById('sod-sec-desc')?.value  || '';
  document.getElementById('sod-mktg-hours').value = document.getElementById('sod-sec-time')?.value  || '';
  document.getElementById('sod-mktg-freq').value  = document.getElementById('sod-sec-freq')?.value  || '';
  const full = SOD_SECTIONS.map(s =>
    `${SOD_HEADERS[s.key]}\n${document.getElementById(s.id)?.value||''}`
  ).join('\n\n');
  document.getElementById('sod-mktg-extra').value = `Full service definition:\n\n${full}`;
  document.getElementById('sod-mktg-results').style.display = 'none';
  document.getElementById('sod-mktg-form').style.display = 'block';
  sodShowView('sod-marketing-view');
}

async function sodGenerateMarketing() {
  const name  = document.getElementById('sod-mktg-name').value.trim();
  const desc  = document.getElementById('sod-mktg-desc').value.trim();
  const hours = document.getElementById('sod-mktg-hours').value.trim();
  const freq  = document.getElementById('sod-mktg-freq').value.trim();
  const extra = document.getElementById('sod-mktg-extra').value.trim();
  if (!name) { alert('Please enter a service name.'); return; }

  document.getElementById('sod-mktg-loading').classList.add('active');
  document.getElementById('sod-mktg-generate-btn').disabled = true;

  const userMsg = `Generate a complete marketing and training package for:

SERVICE NAME: ${name}
DESCRIPTION: ${desc}
TIME ESTIMATE: ${hours}
FREQUENCY: ${freq}
${extra ? `CONTEXT:\n${extra}` : ''}

Create these sections using Cardinal Plaza Shell's voice. Use "##" to mark each section:

## CUSTOMER MATERIALS
Customer-friendly description, value proposition (Safety/Reliability/Predictability), What's Included list, Why It Matters, FAQ (3–5 questions)

## MARKETING COPY
Website content (2–3 paragraphs), 3 social media post variations, email announcement template, in-shop signage copy

## SERVICE ADVISOR TRAINING
How to present (3 talking points), when to recommend, objection handling (3–5 objections with calm responses), 2 sample conversation examples

## OPERATIONS
Complete service checklist, quality standards, documentation requirements`;

  try {
    const result = await sodCallAPI(sodBuildDevPrompt(), [{ role: 'user', content: userMsg }]);
    sodDisplayMarketing(result);
  } catch(err) {
    alert('Error generating materials. Please try again.');
    console.error(err);
  }

  document.getElementById('sod-mktg-loading').classList.remove('active');
  document.getElementById('sod-mktg-generate-btn').disabled = false;
}

function sodDisplayMarketing(content) {
  const sections = [
    { header: '## CUSTOMER MATERIALS',      label: '👥 Customer Materials' },
    { header: '## MARKETING COPY',           label: '📢 Marketing Copy' },
    { header: '## SERVICE ADVISOR TRAINING', label: '💬 Advisor Training' },
    { header: '## OPERATIONS',               label: '🔧 Operations' }
  ];
  const container = document.getElementById('sod-mktg-results');
  container.innerHTML = '';

  sections.forEach((sec, i) => {
    const nextHeader = sections[i + 1]?.header || null;
    let text = '';
    const regex = new RegExp(
      `${sec.header.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*\\n([\\s\\S]*?)(?=${nextHeader ? nextHeader.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') : '$'})`, 'i'
    );
    const m = content.match(regex);
    if (m) text = m[1].trim();

    const div = document.createElement('div');
    div.className = 'mktg-result-section';
    div.innerHTML = `
      <h4>${sec.label} <button class="mktg-copy-btn" type="button">📋 Copy</button></h4>
      <div class="mktg-content">${escapeHTML(text)}</div>
    `;
    div.querySelector('.mktg-copy-btn').addEventListener('click', function() {
      navigator.clipboard.writeText(text);
      const orig = this.textContent;
      this.textContent = '✓ Copied!';
      setTimeout(() => this.textContent = orig, 2000);
    });
    container.appendChild(div);
  });

  const newBtn = document.createElement('button');
  newBtn.className = 'btn action-btn-new';
  newBtn.type = 'button';
  newBtn.style.marginTop = '8px';
  newBtn.textContent = '🔄 Start New Service';
  newBtn.addEventListener('click', sodReturnMenu);
  container.appendChild(newBtn);

  document.getElementById('sod-mktg-form').style.display = 'none';
  container.style.display = 'block';
}

async function sodCallAPI(systemPrompt, messages) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['adminHubApiKey'], async (result) => {
      const apiKey = result.adminHubApiKey;
      if (!apiKey) { reject(new Error('No API key — set it in ⚙️ Settings')); return; }
      chrome.runtime.sendMessage(
        { action: 'adm_sodCall', systemPrompt, messages, apiKey },
        (response) => {
          if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
          if (response?.success) resolve(response.data);
          else reject(new Error(response?.error || 'Unknown error'));
        }
      );
    });
  });
}

function sodBuildDevPrompt() {
  return `You are a service development consultant for Cardinal Plaza Shell, an automotive service center in Springfield, VA (8334 Old Keene Mill Rd • 703-451-8373 • service@cardinalplazashell.com • cardinalplazashell.com).

# CARDINAL PLAZA SHELL — COMPLETE KNOWLEDGE BASE

## Core Philosophy
Predictive Care Philosophy: help customers prevent issues before they happen through education, transparency, and respect for customer autonomy. Four pillars: Trust Before Tasks — customers must feel heard first. Teach Don't Tell — educate to empower confident decisions. Predictive Over Reactive — plan today, 6 months, 12 months ahead. Clarity Over Complexity — translate technical into simple and relatable.

## Brand DNA
1. Calm, educational tone — no fear tactics, no pressure language
2. Customer autonomy and respect — we inform, they decide
3. Outcome-focused language: Safety, Reliability, Predictability
4. Plain language — no jargon, use analogies where helpful
5. Preventive care over reactive repair
6. Hospitality mindset — every guest should leave feeling cared for

## Our Four Promises (weave in naturally):
• To be your trusted advisor
• To help you make the best decisions possible for you
• To provide a unique, no-pressure, transparent, educational environment
• To place the safety of you and your family as our primary goal

## Required Vocabulary
- "oil service" NOT "oil change"
- "courtesy check" NOT "inspection"
- "automotive technician" NOT "technician"
- "preventive care" NOT "preventive maintenance"
- "address" or "service" NOT "fix"
- "concern" or "issue" NOT "problem"
- "recommend" or "suggest" NOT "must" or "have to"

## Team Credentials & Equipment
- ASE certified automotive technicians
- Virginia DEQ certified for emission-related repairs
- State-approved Virginia Safety and Emission Inspection Station
- Latest Hunter alignment equipment
- OE factory scan tools and ADAS calibration equipment
- Autel scan tools and calibration equipment
- OE factory programming and software updates available
- ADAS calibrations for all makes

## Our Free Services (weave into marketing materials naturally):
- Free courtesy check with every visit
- Free brake check, alignment check, AC check, computer/diagnostic scan
- Free second opinions
- Free nitrogen top-offs and tire air
- Free full-service at the gas pumps
- Free car wash certificate
- Free White Glove Concierge: pickup/delivery from home or work, free rides home, free loaners (by appointment)
- WiFi waiting area
- Open evenings, Saturdays, and Sundays for maintenance and light repairs

## Standard Maintenance Intervals
Oil: Semi-synthetic 6,000 mi/6 mo | Full-synthetic 9,000 mi/9 mo
Tires: Rotation 6,000 mi/6 mo | Alignment 12,000 mi/12 mo
Fluids: Brake fluid 24,000 mi/24 mo | Coolant 60,000 mi/60 mo | Power steering 30,000 mi/30 mo | Transmission 50,000 mi/60 mo
Filters: Engine air 15,000 mi/15 mo | Cabin air 15,000 mi/15 mo
Brakes: Inspection 12,000 mi/12 mo | Pads at 4 mm | Shoes at 2 mm
Engine: GDI cleaning 30,000 mi/30 mo | ECU scan 12,000 mi/12 mo
Suspension: Shocks/struts 90,000 mi/90 mo
Default mileage: 1,000 miles/month

## Service Windows
T0 = Today (immediate) | T6 = 6 months | T12 = 12 months
Use soft language: "about six months," "at your next visit," "sometime next year" — never hard deadlines.

## Customer Psychology Principles
Customers think in outcomes (safety, reliability, cost predictability) not mechanics. Reduce cognitive load — break information into small sections. Budget-sensitive customers need options and prioritization, never judgment. Time-pressed customers need concise summaries and clear next steps. Predictability reduces stress — help customers plan ahead and feel in control.

## Your Role
You are a smart, consultative partner. When someone describes a service idea:
- IMMEDIATELY suggest comprehensive components using your automotive knowledge
- Explain WHY each component matters (Safety / Reliability / Predictability)
- Use Cardinal Plaza Shell's vocabulary and tone throughout
- Estimate time in HOURS only — never suggest a dollar price
- Be conversational and helpful, not a questionnaire
- When asked to recommend frequency and target vehicles, be specific and confident
- All marketing copy must reflect the shop's calm, educational, hospitality-first voice`;
}


// ════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════

function escapeHTML(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

function sodFormatText(text) {
  return escapeHTML(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}
