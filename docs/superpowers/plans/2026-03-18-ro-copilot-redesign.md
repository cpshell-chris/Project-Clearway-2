# RO Copilot Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing 5-phase RO Copilot with a 4-step Intake → Compression → Combustion → Exhaust workflow that auto-detects ROs, surfaces AI intelligence at each step, and supports write-back to TekMetric for missing contact info, tech assignments, and RO services.

**Architecture:** Three layers change: (1) Cloud Run adds 7 new endpoints — 4 AI endpoints (interpret-dvi, part-lookup, objection-help, exhaust-assist) and 3 TekMetric write-back proxies — plus updated prompt builders and culture profile; (2) `content.js` gains a "DVI Ready" button injected into the TekMetric inspection page; (3) `sidepanel.html` and `sidepanel.js` get a complete ROC section replacement with a custom step-rail header, per-RO session state in `chrome.storage.session`, and 4 distinct step screens. When the ROC tool is active, the outer `#tool-header` is hidden and replaced by the ROC's own header (back arrow + step rail + X close).

**Tech Stack:** Chrome Extension MV3 (vanilla JS, no build step), Cloud Run Node.js/Express, Anthropic `claude-sonnet-4-6` + `claude-haiku-4-5-20251001` fallback, TekMetric OAuth 2.0 API

**Spec:** `docs/superpowers/specs/2026-03-18-ro-copilot-redesign.md`

---

## File Map

| File | Action | Scope |
|------|--------|-------|
| `cloud-run-service/prompts/cultureProfiles.js` | Modify | Add `dviChecklist` array to Cardinal Plaza Shell profile |
| `cloud-run-service/prompts/roCopilot.js` | Modify | Add 4 new prompt builder exports |
| `cloud-run-service/index.js` | Modify | Add 7 new routes + `safeAnthropicTextCall` helper |
| `auto-shop-copilot/content.js` | Modify | Add "DVI Ready" button on inspection pages; send `ASC_RO_DETECTED` on RO URL match |
| `auto-shop-copilot/background.js` | Modify | Add 11 new message handlers for write-back, AI calls, and DVI scrape trigger |
| `auto-shop-copilot/sidepanel.html` | Modify | Replace `tool-roc-content` block (lines 931–1156) + add ROC CSS |
| `auto-shop-copilot/sidepanel.js` | Modify | Replace ROC functions (lines 3042–3510); update `openTool()` + `goBackToHub()` |

---

## Task 1: Culture Profile — Add DVI Checklist

**Files:**
- Modify: `cloud-run-service/prompts/cultureProfiles.js`

- [ ] **Step 1: Read the current file**

  Open `cloud-run-service/prompts/cultureProfiles.js`. It exports `getDefaultCultureProfile()` returning an object with `name`, `location`, `phone`, `email`, `voice`. You will add `dviChecklist` after `voice`.

- [ ] **Step 2: Add `dviChecklist` array**

  In the return object of `getDefaultCultureProfile()`, add after the `voice` property:

  ```js
  dviChecklist: [
    { name: 'Brakes & Rotors',      photoRequired: true,       note: 'Measure pad thickness and rotor condition front and rear' },
    { name: 'Tires (all 4 corners)', photoRequired: true,       note: 'Measure tread depth at each corner; note any uneven wear' },
    { name: 'Fluids',                photoRequired: false,      note: 'Check color and level: engine oil, coolant, brake fluid, power steering, transmission' },
    { name: 'Engine Air Filter',     photoRequired: 'if-dirty', note: 'Compare to new filter if possible' },
    { name: 'Cabin Air Filter',      photoRequired: 'if-dirty', note: 'Note condition and mileage since last replacement' },
    { name: 'Battery',               photoRequired: false,      note: 'Test CCA and record result' },
    { name: 'Wiper Blades',          photoRequired: false,      note: 'Check condition; note streaking or fraying' },
    { name: 'Belts & Hoses',         photoRequired: false,      note: 'Check for cracking, fraying, or softness' },
  ]
  ```

- [ ] **Step 3: Verify**

  Run from `cloud-run-service/`:
  ```bash
  node -e "import('./prompts/cultureProfiles.js').then(m => console.log(m.getDefaultCultureProfile().dviChecklist.length))"
  ```
  Expected: `8`

- [ ] **Step 4: Commit**

  ```bash
  git add cloud-run-service/prompts/cultureProfiles.js
  git commit -m "feat: add dviChecklist to Cardinal Plaza Shell culture profile"
  ```

---

## Task 2: Cloud Run — New Prompt Builders

**Files:**
- Modify: `cloud-run-service/prompts/roCopilot.js`

- [ ] **Step 1: Add 4 new exported functions**

  Append the following to the end of `cloud-run-service/prompts/roCopilot.js`. The 4 existing exports remain — do not modify them.

  ```js
  export function buildInterpretDviPrompts({ dviItems, roContext, cultureProfile }) {
    const shopName = cultureProfile?.name || 'Cardinal Plaza Shell';
    const voice    = cultureProfile?.voice || 'Calm, educational, and warm.';
    const system = `You are a service advisor coach at ${shopName}. The technician has submitted the Digital Vehicle Inspection. Analyze all findings and return a structured JSON object — no prose, no markdown wrapper.
  Voice: ${voice}
  Return ONLY valid JSON matching this exact shape:
  {
    "summary": "2-3 sentence factual overview of all findings. Facts only — no sales language.",
    "technicalDetail": [{ "item": "string", "detail": "string" }],
    "callScript": "string — a warm, educational opening for the customer call based on these specific findings.",
    "serviceChecklist": [{ "name": "string", "status": "on-ro | missing" }]
  }
  For serviceChecklist: list EVERY service implied by DVI findings. Cross-reference roContext jobs to set status "on-ro" if already a job on the RO, "missing" if it needs to be added.`;

    const dviText = Array.isArray(dviItems)
      ? dviItems.map(i => `[${(i.status || 'unknown').toUpperCase()}] ${i.name || i.item || 'Item'}${i.note ? ' — ' + i.note : ''}`).join('\n')
      : String(dviItems || '');

    const user = `DVI Findings:\n${dviText}\n\nRepair Order Context:\n${roContext || 'No RO context provided.'}`;
    return { system, user };
  }

  export function buildPartLookupPrompts({ itemName, roContext, cultureProfile }) {
    const shopName = cultureProfile?.name || 'Cardinal Plaza Shell';
    const system = `You are a service advisor coach at ${shopName}. When a service advisor asks about a part or system, explain it in plain customer-friendly language: what it does, why it fails, and what happens if it is not addressed. Keep it to 3–5 sentences. No jargon the customer would not understand.`;
    const user = `Part or system: "${itemName}"\n\nVehicle context:\n${roContext || 'No context provided.'}`;
    return { system, user };
  }

  export function buildObjectionHelpPrompts({ objection, roContext, cultureProfile }) {
    const shopName = cultureProfile?.name || 'Cardinal Plaza Shell';
    const voice    = cultureProfile?.voice || 'Calm, educational, and warm.';
    const system = `You are a service advisor coach at ${shopName}. When a customer raises an objection, provide a calm, specific response the advisor can use. Voice: ${voice}. Do not be pushy. Respect the customer's decision-making autonomy.`;
    const user = `Customer objection: "${objection}"\n\nRepair order context:\n${roContext || 'No context provided.'}`;
    return { system, user };
  }

  export function buildExhaustAssistPrompts({ situationType, detail, roContext, history, cultureProfile }) {
    const shopName = cultureProfile?.name || 'Cardinal Plaza Shell';
    const voice    = cultureProfile?.voice || 'Calm, educational, and warm.';
    const situations = {
      supplement: 'The advisor needs to present an unexpected additional item to a customer who has already approved work.',
      delay:      'The vehicle will not be ready on time and the advisor needs to notify the customer.',
      objection:  'The customer has raised an objection after approving the sale.',
      pickup:     'The vehicle is ready and the advisor needs to generate a pickup notification.',
    };
    const context = situations[situationType] || 'The advisor needs post-sale coaching.';
    const system = `You are a service advisor coach at ${shopName}. Situation: ${context} Voice: ${voice}. Provide a ready-to-use script or coaching the advisor can apply immediately.`;
    const prior = (history || []).map(m => ({ role: m.role, content: String(m.content) }));
    const messages = [
      ...prior,
      { role: 'user', content: `${detail || 'Please help with this situation.'}\n\nRO context:\n${roContext || 'No context provided.'}` }
    ];
    return { system, messages };
  }
  ```

- [ ] **Step 2: Verify all 8 exports are present**

  Run from `cloud-run-service/`:
  ```bash
  node -e "import('./prompts/roCopilot.js').then(m => console.log(Object.keys(m).join(', ')))"
  ```
  Expected: includes `buildInterpretDviPrompts`, `buildPartLookupPrompts`, `buildObjectionHelpPrompts`, `buildExhaustAssistPrompts`

- [ ] **Step 3: Commit**

  ```bash
  git add cloud-run-service/prompts/roCopilot.js
  git commit -m "feat: add interpret-dvi, part-lookup, objection-help, exhaust-assist prompt builders"
  ```

---

## Task 3: Cloud Run — 7 New Endpoints

**Files:**
- Modify: `cloud-run-service/index.js`

- [ ] **Step 1: Update import from roCopilot.js**

  Find the existing import block at the top of `index.js` (lines 3–8):
  ```js
  import {
    buildRoCopilotSummaryPrompt,
    buildRoCopilotSummarySystemPrompt,
    buildRoCopilotQuestionPrompt,
    buildRoCopilotQuestionSystemPrompt
  } from "./prompts/roCopilot.js";
  ```
  Replace with:
  ```js
  import {
    buildRoCopilotSummaryPrompt,
    buildRoCopilotSummarySystemPrompt,
    buildRoCopilotQuestionPrompt,
    buildRoCopilotQuestionSystemPrompt,
    buildInterpretDviPrompts,
    buildPartLookupPrompts,
    buildObjectionHelpPrompts,
    buildExhaustAssistPrompts
  } from "./prompts/roCopilot.js";
  ```

- [ ] **Step 2: Add `safeAnthropicTextCall` helper**

  Find the `safeAnthropicJsonCall` function (around line 1265). Add this new helper immediately after `safeAnthropicJsonCall` (before `logRoCopilotDecision`):

  ```js
  async function safeAnthropicTextCall({ systemPrompt, messages, maxTokens = 600 }) {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
    const fetch = getFetch();
    // NOTE: modelFallbacks tries each model in order. We continue to the next model
    // ONLY on 404 (model not found). All other errors (5xx, 429, etc.) stop immediately.
    const modelFallbacks = [process.env.ANTHROPIC_MODEL?.trim(), 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'].filter(Boolean);
    let lastError = null;
    for (const model of modelFallbacks) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system: systemPrompt, messages })
      });
      if (response.ok) {
        const data = await response.json();
        return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      }
      const err = await response.text();
      lastError = `AI error (${response.status})`;
      console.error(`safeAnthropicTextCall error for ${model}:`, response.status, err);
      // Only continue to next model on 404 (model not found); stop on all other errors
      if (response.status !== 404) break;
    }
    throw new Error(lastError || 'AI service unavailable');
  }
  ```

- [ ] **Step 3: Add the 4 AI endpoints**

  Find the `app.post("/ro-copilot/summary", ...)` block. Add these 4 routes immediately after the existing `/ro-copilot/question` route (before `/ai/chat`):

  ```js
  // ── RO Copilot: Interpret DVI ──────────────────────────────────────────────
  app.post('/ro-copilot/interpret-dvi', async (req, res) => {
    try {
      const { dviItems, roContext } = req.body;
      if (!dviItems) return res.status(400).json({ error: 'dviItems required' });
      const cultureProfile = getDefaultCultureProfile();
      const { system, user } = buildInterpretDviPrompts({ dviItems, roContext, cultureProfile });
      const result = await safeAnthropicJsonCall({ systemPrompt: system, userPrompt: user, maxTokens: 1500 });
      if (!result.ok) return res.status(500).json({ error: result.reason });
      res.json(result.data);
    } catch (err) {
      console.error('/ro-copilot/interpret-dvi error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── RO Copilot: Part Lookup ────────────────────────────────────────────────
  app.post('/ro-copilot/part-lookup', async (req, res) => {
    try {
      const { itemName, roContext } = req.body;
      if (!itemName) return res.status(400).json({ error: 'itemName required' });
      const cultureProfile = getDefaultCultureProfile();
      const { system, user } = buildPartLookupPrompts({ itemName, roContext, cultureProfile });
      const text = await safeAnthropicTextCall({ systemPrompt: system, messages: [{ role: 'user', content: user }], maxTokens: 400 });
      res.json({ explanation: text });
    } catch (err) {
      console.error('/ro-copilot/part-lookup error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── RO Copilot: Objection Help ─────────────────────────────────────────────
  app.post('/ro-copilot/objection-help', async (req, res) => {
    try {
      const { objection, roContext } = req.body;
      if (!objection) return res.status(400).json({ error: 'objection required' });
      const cultureProfile = getDefaultCultureProfile();
      const { system, user } = buildObjectionHelpPrompts({ objection, roContext, cultureProfile });
      const text = await safeAnthropicTextCall({ systemPrompt: system, messages: [{ role: 'user', content: user }], maxTokens: 400 });
      res.json({ response: text });
    } catch (err) {
      console.error('/ro-copilot/objection-help error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── RO Copilot: Exhaust Assist ─────────────────────────────────────────────
  app.post('/ro-copilot/exhaust-assist', async (req, res) => {
    try {
      const { situationType, detail, roContext, history } = req.body;
      if (!situationType) return res.status(400).json({ error: 'situationType required' });
      const cultureProfile = getDefaultCultureProfile();
      const { system, messages } = buildExhaustAssistPrompts({ situationType, detail, roContext, history, cultureProfile });
      const text = await safeAnthropicTextCall({ systemPrompt: system, messages, maxTokens: 600 });
      res.json({ script: text });
    } catch (err) {
      console.error('/ro-copilot/exhaust-assist error:', err);
      res.status(500).json({ error: err.message });
    }
  });
  ```

- [ ] **Step 4: Add the 3 TekMetric write-back endpoints**

  Add these 3 routes immediately after the exhaust-assist route:

  ```js
  // ── RO Copilot: Update Customer ────────────────────────────────────────────
  app.patch('/ro-copilot/update-customer', async (req, res) => {
    try {
      const { customerId, fields } = req.body;
      if (!customerId || !fields) return res.status(400).json({ error: 'customerId and fields required' });
      const token = await getAccessToken();
      const result = await tekmetricRequest(token, 'PATCH', `/api/v1/customers/${customerId}`, fields);
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('/ro-copilot/update-customer error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── RO Copilot: Update Job ─────────────────────────────────────────────────
  app.patch('/ro-copilot/update-job', async (req, res) => {
    try {
      const { jobId, fields } = req.body;
      if (!jobId || !fields) return res.status(400).json({ error: 'jobId and fields required' });
      const token = await getAccessToken();
      const result = await tekmetricRequest(token, 'PATCH', `/api/v1/jobs/${jobId}`, fields);
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('/ro-copilot/update-job error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── RO Copilot: Add Canned Job to RO ──────────────────────────────────────
  app.post('/ro-copilot/add-canned-job', async (req, res) => {
    try {
      const { roId, shopId, serviceName } = req.body;
      if (!roId || !shopId || !serviceName) return res.status(400).json({ error: 'roId, shopId, and serviceName required' });
      const token = await getAccessToken();
      const searchResult = await tekmetricRequest(token, 'GET', `/api/v1/canned-jobs?shopId=${shopId}&search=${encodeURIComponent(serviceName)}&size=5`);
      const jobs = searchResult?.content || (Array.isArray(searchResult) ? searchResult : []);
      if (jobs.length === 0) return res.json({ success: false, reason: 'no-canned-job-found' });
      const cannedJobId = jobs[0].id;
      await tekmetricRequest(token, 'POST', `/api/v1/repair-orders/${roId}/canned-jobs`, { cannedJobIds: [cannedJobId] });
      res.json({ success: true, cannedJobId, cannedJobName: jobs[0].name });
    } catch (err) {
      console.error('/ro-copilot/add-canned-job error:', err);
      res.status(500).json({ error: err.message });
    }
  });
  ```

- [ ] **Step 5: Verify the service starts**

  Run from `cloud-run-service/` (press Ctrl-C after you see "Listening on port"):
  ```bash
  node index.js
  ```
  Expected: output includes "Listening on port…" with no import or syntax errors. Once confirmed, press Ctrl-C.

- [ ] **Step 6: Smoke-test the DVI endpoint with curl**

  ```bash
  curl -s -X POST http://localhost:8080/ro-copilot/interpret-dvi \
    -H "Content-Type: application/json" \
    -d '{"dviItems":[{"name":"Brakes","status":"red","note":"2mm pad depth"},{"name":"Tires","status":"yellow","note":"4/32 tread"}],"roContext":"RO 12345, 2019 Honda Accord, customer concern: noise when braking"}' \
    | python3 -m json.tool
  ```
  Expected: JSON with `summary`, `technicalDetail`, `callScript`, `serviceChecklist` keys.

- [ ] **Step 7: Commit**

  ```bash
  git add cloud-run-service/index.js
  git commit -m "feat: add 7 new ro-copilot Cloud Run endpoints (interpret-dvi, part-lookup, objection-help, exhaust-assist, write-back proxies)"
  ```

---

## Task 4: content.js — DVI Ready Button

**Files:**
- Modify: `auto-shop-copilot/content.js`

**Context:** `content.js` already has `PAYMENT_RE` and `INSPECTIONS_RE` constants and an `injectApptBtn()` function that injects a button next to "View & Share Invoice" on payment pages. The new "DVI Ready" button follows the same injection pattern on inspection pages. It should tell the sidebar that the advisor has confirmed DVI is complete.

- [ ] **Step 1: Add the DVI Ready button styles**

  Find the `<style>` block near the top of `content.js` (the `style.textContent = ` assignment). Add these styles alongside the existing `#asc-appt-btn` rules:

  ```js
  #asc-dvi-ready-btn {
    position: fixed;
    bottom: 80px;
    right: 24px;
    z-index: 999998;
    padding: 10px 18px;
    background: linear-gradient(135deg, #9A3412 0%, #EA580C 60%, #F97316 100%);
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
    cursor: pointer;
    letter-spacing: 0.02em;
    box-shadow: 0 3px 12px rgba(249,115,22,0.45);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    animation: asc-appt-glow 2s ease-out infinite;
  }
  #asc-dvi-ready-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 5px 16px rgba(249,115,22,0.55);
  }
  ```

- [ ] **Step 2: Add `injectDviReadyBtn` and `removeDviReadyBtn` functions**

  Add these two functions after `removeApptBtn()`:

  ```js
  function injectDviReadyBtn() {
    if (document.getElementById('asc-dvi-ready-btn')) return;
    if (!INSPECTIONS_RE.test(window.location.href)) return;
    const btn = document.createElement('button');
    btn.id = 'asc-dvi-ready-btn';
    btn.textContent = 'DVI Ready';
    btn.addEventListener('click', () => {
      try {
        chrome.runtime.sendMessage({ action: 'asc_dviReadyTriggered' });
      } catch (e) {
        btn.remove();
      }
    });
    document.body.appendChild(btn);
  }

  function removeDviReadyBtn() {
    document.getElementById('asc-dvi-ready-btn')?.remove();
  }
  ```

- [ ] **Step 3: Wire up the DVI Ready button in the URL monitor loop**

  Find the `setInterval(() => {` block (around line 148). It currently handles `PAYMENT_RE` for the appt button. Add DVI Ready button management alongside it:

  ```js
  setInterval(() => {
    const url = window.location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      if (!PAYMENT_RE.test(url)) removeApptBtn();
      if (!INSPECTIONS_RE.test(url)) removeDviReadyBtn();  // ADD THIS LINE
      if (INSPECTIONS_RE.test(url)) scheduleInspectionsScrape(url);
    }
    if (PAYMENT_RE.test(url)) injectApptBtn();
    if (INSPECTIONS_RE.test(url)) injectDviReadyBtn();  // ADD THIS LINE
  }, 400);
  ```

  Also add an initial injection call after the existing initial calls:
  ```js
  if (INSPECTIONS_RE.test(window.location.href)) injectDviReadyBtn();  // ADD THIS
  ```

- [ ] **Step 4: Add `ASC_RO_DETECTED` message to the URL monitor**

  The sidebar's `startURLMonitoring()` already auto-fetches the RO when detected. The content.js message is used for auto-launching the ROC tool when the sidebar is open. Add this inside the URL change block in the `setInterval`:

  ```js
  // Detect generic RO URL and notify sidebar (add after existing INSPECTIONS_RE check)
  const ROC_RE = /\/repair-orders\/(\d+)/;
  const rocMatch = url.match(ROC_RE);
  if (rocMatch && !PAYMENT_RE.test(url)) {
    try {
      chrome.runtime.sendMessage({ action: 'asc_roDetected', roNumber: rocMatch[1] });
    } catch (_) {}
  }
  ```

  **Note:** Place the `const ROC_RE` declaration outside the setInterval (at the top of the IIFE alongside `PAYMENT_RE` and `INSPECTIONS_RE`):
  ```js
  const ROC_RE = /\/repair-orders\/(\d+)/;
  ```
  And update the setInterval to only send on URL change (already inside the `if (url !== lastUrl)` block).

- [ ] **Step 5: Verify**

  Load the extension, navigate to a TekMetric inspection page (URL matching `/repair-orders/123/inspections`). Expected: an orange "DVI Ready" button appears fixed bottom-right above the Copilot launcher. Tapping it sends `asc_dviReadyTriggered` (check background.js console, which doesn't exist yet — this will be wired in Task 6).

- [ ] **Step 6: Commit**

  ```bash
  git add auto-shop-copilot/content.js
  git commit -m "feat: inject DVI Ready button on TekMetric inspection pages; send asc_roDetected on RO URL"
  ```

---

## Task 5: background.js — New Message Handlers

**Files:**
- Modify: `auto-shop-copilot/background.js`

**Context:** `background.js` handles all `chrome.runtime.onMessage` events. The existing `asc_rocAssist` handler calls `rocGenerateAssist()`. The new handlers call Cloud Run endpoints. The existing `ASC_CLOUD_RUN_URL` constant is already defined.

- [ ] **Step 1: Add handler for `asc_dviReadyTriggered`**

  Find the existing `if (request.action === 'asc_dviCapture')` block. Add a new handler immediately before it:

  ```js
  // DVI Ready button tapped on TekMetric page — forward to sidebar
  if (request.action === 'asc_dviReadyTriggered') {
    chrome.runtime.sendMessage({ action: 'asc_dviReadyForImport' }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }
  ```

- [ ] **Step 2: Add handler for `asc_roDetected`**

  Add after the `asc_dviReadyTriggered` handler:

  ```js
  // RO URL detected by content script — forward to sidebar to auto-launch ROC Intake
  if (request.action === 'asc_roDetected') {
    chrome.runtime.sendMessage({ action: 'asc_roAutoDetected', roNumber: request.roNumber }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }
  ```

- [ ] **Step 3: Add handler for `asc_rocInterpretDvi` (new DVI interpret via Cloud Run)**

  Add after the existing `asc_interpretDvi` handler:

  ```js
  // New ROC: interpret DVI via Cloud Run /ro-copilot/interpret-dvi endpoint (returns structured JSON)
  if (request.action === 'asc_rocInterpretDvi') {
    (async () => {
      try {
        const response = await fetch(`${ASC_CLOUD_RUN_URL}/ro-copilot/interpret-dvi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dviItems: request.dviItems, roContext: request.roContext })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
  ```

- [ ] **Step 4: Add handler for `asc_rocPartLookup`**

  ```js
  if (request.action === 'asc_rocPartLookup') {
    (async () => {
      try {
        const response = await fetch(`${ASC_CLOUD_RUN_URL}/ro-copilot/part-lookup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemName: request.itemName, roContext: request.roContext })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        sendResponse({ success: true, data: data.explanation });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
  ```

- [ ] **Step 5: Add handler for `asc_rocObjectionHelp`**

  ```js
  if (request.action === 'asc_rocObjectionHelp') {
    (async () => {
      try {
        const response = await fetch(`${ASC_CLOUD_RUN_URL}/ro-copilot/objection-help`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ objection: request.objection, roContext: request.roContext })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        sendResponse({ success: true, data: data.response });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
  ```

- [ ] **Step 6: Add handler for `asc_rocExhaustAssist`**

  ```js
  if (request.action === 'asc_rocExhaustAssist') {
    (async () => {
      try {
        const response = await fetch(`${ASC_CLOUD_RUN_URL}/ro-copilot/exhaust-assist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ situationType: request.situationType, detail: request.detail, roContext: request.roContext, history: request.history })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        sendResponse({ success: true, data: data.script });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
  ```

- [ ] **Step 7: Add handler for `asc_rocUpdateCustomer`**

  ```js
  if (request.action === 'asc_rocUpdateCustomer') {
    (async () => {
      try {
        const response = await fetch(`${ASC_CLOUD_RUN_URL}/ro-copilot/update-customer`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId: request.customerId, fields: request.fields })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
  ```

- [ ] **Step 8: Add handler for `asc_rocUpdateJob`**

  ```js
  if (request.action === 'asc_rocUpdateJob') {
    (async () => {
      try {
        const response = await fetch(`${ASC_CLOUD_RUN_URL}/ro-copilot/update-job`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: request.jobId, fields: request.fields })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
  ```

- [ ] **Step 9: Add handler for `asc_rocAddCannedJob`**

  ```js
  if (request.action === 'asc_rocAddCannedJob') {
    (async () => {
      try {
        const response = await fetch(`${ASC_CLOUD_RUN_URL}/ro-copilot/add-canned-job`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roId: request.roId, shopId: request.shopId, serviceName: request.serviceName })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
  ```

- [ ] **Step 10: Verify that the existing `asc_requestDviScrape` handler is present**

  The existing `background.js` already handles `asc_requestDviScrape` — it forwards the request to the content script for a DOM scrape. Confirm it exists:
  ```bash
  grep -n "asc_requestDviScrape" auto-shop-copilot/background.js
  ```
  Expected: at least 1 match. If it is missing, add:
  ```js
  if (request.action === 'asc_requestDviScrape') {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      if (!tab?.id) { sendResponse({ success: false, error: 'No active tab' }); return; }
      chrome.tabs.sendMessage(tab.id, { action: 'asc_doScrapeInspections' }, res => {
        sendResponse(res || { success: false, error: 'Content script did not respond' });
      });
    });
    return true;
  }
  ```

- [ ] **Step 11: Verify handlers are registered**

  Reload the extension. Open the Chrome DevTools console for the background service worker (chrome://extensions → inspect service worker). Run:
  ```js
  chrome.runtime.sendMessage({ action: 'asc_rocPartLookup', itemName: 'brake pad', roContext: '' }, console.log)
  ```
  Expected: `{ success: true, data: "..." }` — a plain-language explanation from Claude. If you get `{ success: false, error: "..." }`, check that Cloud Run is deployed and `ASC_CLOUD_RUN_URL` points to the correct URL.

- [ ] **Step 12: Commit**

  ```bash
  git add auto-shop-copilot/background.js
  git commit -m "feat: add background.js handlers for ROC write-back, DVI interpret, and AI assist messages"
  ```

---

## Task 6: sidepanel.html — New ROC HTML + CSS

**Files:**
- Modify: `auto-shop-copilot/sidepanel.html`

**Context:** The existing ROC block is lines 931–1156 (the `<div id="tool-roc-content">` through its closing `</div>`). Replace it entirely. The outer `#tool-header` (lines 651–658) is hidden when ROC is active — the ROC provides its own header containing the step rail.

- [ ] **Step 1: Add ROC CSS to the `<style>` block**

  Find the end of the `<style>` block (before `</style>`). Add the following CSS:

  ```css
  /* ═══ RO COPILOT REDESIGN ═══════════════════════════════════════════════ */
  .roc-header { background: linear-gradient(135deg, #9A3412 0%, #EA580C 60%, #F97316 100%); display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; flex-shrink: 0; gap: 6px; }
  .roc-nav-btn { background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.35); color: white; width: 28px; height: 28px; border-radius: 7px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s; padding: 0; line-height: 1; }
  .roc-nav-btn:hover { background: rgba(255,255,255,0.30); }
  .roc-step-rail { display: flex; align-items: center; gap: 0; flex: 1; justify-content: center; overflow: hidden; }
  .roc-step-pill { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.28); color: rgba(255,255,255,0.7); border-radius: 20px; padding: 3px 9px; font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; letter-spacing: 0.01em; }
  .roc-step-pill:hover { background: rgba(255,255,255,0.25); color: white; }
  .roc-step-pill.active { background: rgba(255,255,255,0.32); border-color: rgba(255,255,255,0.65); color: white; font-weight: 700; }
  .roc-step-pill.done { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.45); }
  .roc-step-connector { color: rgba(255,255,255,0.28); font-size: 9px; padding: 0 2px; flex-shrink: 0; }
  .roc-screen { display: none; flex-direction: column; flex: 1; overflow-y: auto; }
  .roc-screen.active { display: flex; }
  .roc-body { padding: 0 12px 80px; flex: 1; }
  .roc-section-label { font-size: 10px; font-weight: 700; color: #9A3412; text-transform: uppercase; letter-spacing: 0.9px; margin: 14px 0 6px; }
  .roc-divider { display: flex; align-items: center; gap: 8px; margin: 10px 0; }
  .roc-divider-line { flex: 1; height: 1px; background: #FED7AA; }
  .roc-divider-dot { width: 5px; height: 5px; border-radius: 50%; background: #FED7AA; flex-shrink: 0; }
  .roc-verify-item { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 8px; margin-bottom: 6px; cursor: default; }
  .roc-verify-item.warning { border-color: #F59E0B; background: #FFFBEB; cursor: pointer; }
  .roc-verify-item.warning:hover { background: #FEF3C7; }
  .roc-verify-label { font-size: 12px; color: #3a3a3a; font-weight: 500; flex: 1; }
  .roc-verify-status { font-size: 11px; font-weight: 700; flex-shrink: 0; margin-left: 8px; }
  .roc-verify-status.ok   { color: #16A34A; }
  .roc-verify-status.warn { color: #D97706; }
  .roc-inline-edit { display: none; padding: 8px 12px 10px; background: #FFFBEB; border: 1px solid #F59E0B; border-top: none; border-radius: 0 0 8px 8px; margin-top: -6px; margin-bottom: 6px; }
  .roc-inline-edit.open { display: block; }
  .roc-inline-edit input { width: 100%; border: 1px solid #FED7AA; border-radius: 6px; padding: 7px 10px; font-size: 12px; font-family: inherit; background: white; outline: none; margin-bottom: 6px; }
  .roc-inline-edit input:focus { border-color: #EA580C; }
  .roc-inline-btn { background: #EA580C; color: white; border: none; border-radius: 6px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
  .roc-inline-btn:hover { background: #C2410C; }
  .roc-contact-pref { display: flex; gap: 6px; margin-top: 8px; }
  .roc-pref-chip { flex: 1; border: 1.5px solid #FED7AA; background: white; border-radius: 20px; padding: 5px 0; font-size: 11px; font-weight: 600; color: #9A3412; cursor: pointer; text-align: center; transition: all 0.15s; }
  .roc-pref-chip.selected { background: #EA580C; border-color: #EA580C; color: white; }
  .roc-dvi-checklist-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; border-bottom: 1px solid #FEF3E8; }
  .roc-dvi-checklist-item:last-child { border-bottom: none; }
  .roc-dvi-item-name { font-size: 12px; font-weight: 600; color: #3a3a3a; }
  .roc-dvi-item-note { font-size: 11px; color: #6c757d; margin-top: 2px; line-height: 1.4; }
  .roc-photo-badge { font-size: 9px; font-weight: 700; border-radius: 4px; padding: 2px 6px; text-transform: uppercase; letter-spacing: 0.5px; flex-shrink: 0; margin-top: 1px; }
  .roc-photo-badge.required   { background: #FED7AA; color: #9A3412; }
  .roc-photo-badge.if-dirty   { background: #FEF3C7; color: #92400E; }
  .roc-gauge-wrap { margin: 4px 0 10px; }
  .roc-gauge-bar-bg { height: 8px; background: #FEF3E8; border-radius: 4px; overflow: hidden; border: 1px solid #FED7AA; }
  .roc-gauge-bar-fill { height: 100%; background: linear-gradient(90deg, #EA580C, #F97316); border-radius: 4px; transition: width 0.5s ease; }
  .roc-gauge-pct { font-size: 22px; font-weight: 700; color: #EA580C; text-align: center; margin-bottom: 4px; }
  .roc-gauge-factors { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
  .roc-gauge-factor { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #4a5568; }
  .roc-factor-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .roc-factor-dot.met     { background: #16A34A; }
  .roc-factor-dot.not-met { background: #D97706; }
  .roc-collapsible-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; cursor: pointer; border-bottom: 1px solid #FEF3E8; user-select: none; }
  .roc-collapsible-header:hover { background: #FFEDD5; margin: 0 -12px; padding: 10px 12px; border-radius: 4px; }
  .roc-collapsible-title { font-size: 12px; font-weight: 700; color: #3a3a3a; }
  .roc-chevron { font-size: 12px; color: #9A3412; transition: transform 0.2s; }
  .roc-collapsible-header.open .roc-chevron { transform: rotate(90deg); }
  .roc-collapsible-body { display: none; padding: 8px 0 4px; }
  .roc-collapsible-body.open { display: block; }
  .roc-service-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #FEF3E8; }
  .roc-service-row:last-child { border-bottom: none; }
  .roc-service-name { font-size: 12px; color: #3a3a3a; flex: 1; }
  .roc-on-ro-badge  { font-size: 10px; font-weight: 700; color: #16A34A; background: #DCFCE7; border-radius: 10px; padding: 2px 8px; flex-shrink: 0; }
  .roc-add-ro-btn   { font-size: 10px; font-weight: 700; color: #EA580C; background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 10px; padding: 2px 8px; cursor: pointer; transition: all 0.15s; flex-shrink: 0; }
  .roc-add-ro-btn:hover { background: #FFEDD5; }
  .roc-add-ro-btn.adding { color: #6c757d; cursor: default; }
  .roc-add-ro-btn.added  { color: #16A34A; background: #DCFCE7; border-color: #16A34A; cursor: default; }
  .roc-chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .roc-chip { border: 1.5px solid #FED7AA; background: #FFF7ED; color: #9A3412; border-radius: 20px; padding: 5px 12px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: inherit; }
  .roc-chip:hover { background: #FFEDD5; border-color: #EA580C; }
  .roc-chip.active { background: #EA580C; border-color: #EA580C; color: white; }
  .roc-quick-action-wrap { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
  .roc-quick-action { border: 1.5px solid #FED7AA; background: #FFF7ED; border-radius: 8px; overflow: hidden; }
  .roc-quick-action-header { display: flex; align-items: center; gap: 8px; padding: 8px 10px; }
  .roc-quick-action input { border: none; background: transparent; font-size: 12px; font-family: inherit; outline: none; flex: 1; color: #3a3a3a; }
  .roc-quick-action input::placeholder { color: #c0a898; }
  .roc-quick-action-btn { background: #EA580C; color: white; border: none; border-radius: 6px; padding: 5px 10px; font-size: 11px; font-weight: 700; cursor: pointer; transition: background 0.15s; white-space: nowrap; font-family: inherit; }
  .roc-quick-action-btn:hover { background: #C2410C; }
  .roc-quick-action-btn:disabled { background: #c0a898; cursor: default; }
  .roc-quick-result { display: none; padding: 8px 10px; background: #fffbf8; border-top: 1px solid #FED7AA; font-size: 12px; color: #3a3a3a; line-height: 1.55; }
  .roc-quick-result.show { display: block; }
  .roc-chat-history { max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
  .roc-chat-bubble { padding: 8px 11px; border-radius: 10px; font-size: 12px; line-height: 1.55; max-width: 88%; }
  .roc-chat-bubble.user { background: #EA580C; color: white; align-self: flex-end; border-bottom-right-radius: 3px; }
  .roc-chat-bubble.assistant { background: #FFF7ED; border: 1px solid #FED7AA; color: #3a3a3a; align-self: flex-start; border-bottom-left-radius: 3px; }
  .roc-chat-input-row { display: flex; gap: 6px; align-items: flex-end; }
  .roc-chat-input { flex: 1; border: 1.5px solid #FED7AA; border-radius: 8px; padding: 8px 10px; font-size: 12px; font-family: inherit; resize: none; outline: none; background: white; }
  .roc-chat-input:focus { border-color: #EA580C; }
  .roc-chat-send-btn { background: #EA580C; color: white; border: none; border-radius: 8px; width: 34px; height: 34px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s; flex-shrink: 0; }
  .roc-chat-send-btn:hover { background: #C2410C; }
  .roc-chat-send-btn:disabled { background: #c0a898; cursor: default; }
  .roc-exhaust-summary { display: flex; gap: 6px; margin-bottom: 4px; }
  .roc-exhaust-mini-card { flex: 1; background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 8px; padding: 8px 10px; text-align: center; }
  .roc-exhaust-mini-label { font-size: 9px; font-weight: 700; color: #9A3412; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 3px; }
  .roc-exhaust-mini-value { font-size: 11px; font-weight: 600; color: #3a3a3a; }
  .roc-advance-btn { width: 100%; padding: 13px 16px; background: linear-gradient(135deg, #9A3412 0%, #EA580C 60%, #F97316 100%); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; text-align: center; transition: opacity 0.15s; letter-spacing: 0.01em; font-family: inherit; margin-top: 12px; }
  .roc-advance-btn:hover { opacity: 0.88; }
  .roc-advance-btn:disabled { opacity: 0.45; cursor: default; }
  .roc-no-ro { text-align: center; padding: 32px 16px; color: #9a8880; font-size: 13px; line-height: 1.6; }
  .roc-loading-state { text-align: center; padding: 24px 16px; color: #9A3412; font-size: 12px; }
  .roc-error-note { font-size: 11px; color: #DC2626; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; padding: 6px 10px; margin-top: 6px; }
  ```

- [ ] **Step 2: Replace the entire `tool-roc-content` block**

  In `sidepanel.html`, find the line:
  ```html
      <div id="tool-roc-content" style="display:none;">
  ```
  and the matching closing `</div><!-- /#tool-roc-content -->` at line 1156. Replace the entire block with:

  ```html
      <div id="tool-roc-content" style="display:none; flex-direction:column; flex:1; overflow:hidden;">

        <!-- ROC header: custom step rail (replaces outer #tool-header when ROC active) -->
        <div class="roc-header" id="roc-header">
          <button class="roc-nav-btn" id="roc-back-btn" type="button" title="Back">&#8592;</button>
          <div class="roc-step-rail" id="roc-step-rail">
            <button class="roc-step-pill active" id="roc-pill-intake"      data-step="intake"      type="button">Intake</button>
            <span class="roc-step-connector">—</span>
            <button class="roc-step-pill"        id="roc-pill-compression" data-step="compression" type="button">Compression</button>
            <span class="roc-step-connector">—</span>
            <button class="roc-step-pill"        id="roc-pill-combustion"  data-step="combustion"  type="button">Combustion</button>
            <span class="roc-step-connector">—</span>
            <button class="roc-step-pill"        id="roc-pill-exhaust"     data-step="exhaust"     type="button">Exhaust</button>
          </div>
          <button class="roc-nav-btn" id="roc-close-btn" type="button" title="Exit RO Copilot">&#x2715;</button>
        </div>

        <!-- ── STEP 1: INTAKE ─────────────────────────────────────── -->
        <div class="roc-screen active" id="roc-screen-intake">
          <div class="roc-body">
            <div class="roc-section-label">Verify Before You Begin</div>

            <!-- Concern -->
            <div class="roc-verify-item" id="roc-verify-concern">
              <span class="roc-verify-label">Customer concern documented</span>
              <span class="roc-verify-status warn" id="roc-concern-status">Checking…</span>
            </div>

            <!-- Phone with inline edit -->
            <div class="roc-verify-item" id="roc-verify-phone">
              <span class="roc-verify-label">Phone number on file</span>
              <span class="roc-verify-status warn" id="roc-phone-status">Checking…</span>
            </div>
            <div class="roc-inline-edit" id="roc-phone-edit">
              <input type="tel" id="roc-phone-input" placeholder="Enter phone number">
              <button class="roc-inline-btn" id="roc-phone-save-btn" type="button">Save to TekMetric</button>
            </div>

            <!-- Contact preference -->
            <div style="padding: 4px 0 8px; display: none;" id="roc-contact-pref-row">
              <div style="font-size:11px; color:#6c757d; margin-bottom:6px;">Contact preference:</div>
              <div class="roc-contact-pref">
                <button class="roc-pref-chip" id="roc-pref-call" type="button">Call</button>
                <button class="roc-pref-chip" id="roc-pref-text" type="button">Text</button>
              </div>
            </div>

            <!-- Address with inline edit -->
            <div class="roc-verify-item" id="roc-verify-address">
              <span class="roc-verify-label">Address on file</span>
              <span class="roc-verify-status warn" id="roc-address-status">Checking…</span>
            </div>
            <div class="roc-inline-edit" id="roc-address-edit">
              <input type="text" id="roc-address-input" placeholder="Street address">
              <input type="text" id="roc-city-input"    placeholder="City">
              <input type="text" id="roc-state-input"   placeholder="State" style="width:60px; display:inline-block;">
              <input type="text" id="roc-zip-input"     placeholder="ZIP" style="width:calc(100% - 66px); display:inline-block; margin-left:6px;">
              <button class="roc-inline-btn" id="roc-address-save-btn" type="button" style="margin-top:6px;">Save to TekMetric</button>
            </div>

            <!-- Technician -->
            <div class="roc-verify-item" id="roc-verify-tech">
              <span class="roc-verify-label">Technician assigned to all jobs</span>
              <span class="roc-verify-status warn" id="roc-tech-status">Checking…</span>
            </div>
            <div class="roc-error-note" id="roc-tech-note" style="display:none;">Assign technicians manually in TekMetric, then return here.</div>

            <div class="roc-error-note" id="roc-no-ro-note" style="display:none;">No RO loaded. Navigate to a Repair Order in TekMetric to begin.</div>

            <button class="roc-advance-btn" id="roc-intake-advance" type="button">Intake Complete — Move to Compression</button>
          </div>
        </div><!-- /roc-screen-intake -->

        <!-- ── STEP 2: COMPRESSION ────────────────────────────────── -->
        <div class="roc-screen" id="roc-screen-compression">
          <div class="roc-body">
            <div class="roc-section-label">DVI Checklist for the Tech</div>
            <div id="roc-dvi-checklist-wrap">
              <!-- Populated from culture profile dviChecklist by JS -->
            </div>

            <div class="roc-divider"><div class="roc-divider-line"></div><div class="roc-divider-dot"></div><div class="roc-divider-line"></div></div>

            <p style="font-size:11px; color:#6c757d; line-height:1.6; margin-bottom:4px;">When the tech submits the DVI, tap below to import all findings and move to Combustion.</p>
            <p style="font-size:11px; color:#9a8880; line-height:1.5; margin-bottom:0;" id="roc-dvi-capture-status">Waiting for DVI data…</p>

            <button class="roc-advance-btn" id="roc-compression-advance" type="button">DVI Complete — Import &amp; Continue</button>
            <div class="roc-loading-state" id="roc-compression-loading" style="display:none;">Interpreting DVI findings…</div>
            <div class="roc-error-note"    id="roc-compression-error"   style="display:none;"></div>
          </div>
        </div><!-- /roc-screen-compression -->

        <!-- ── STEP 3: COMBUSTION ─────────────────────────────────── -->
        <div class="roc-screen" id="roc-screen-combustion">
          <div class="roc-body">
            <div class="roc-section-label">RO Readiness</div>
            <div class="roc-gauge-wrap">
              <div class="roc-gauge-pct" id="roc-gauge-pct">—</div>
              <div class="roc-gauge-bar-bg"><div class="roc-gauge-bar-fill" id="roc-gauge-fill" style="width:0%"></div></div>
              <div class="roc-gauge-factors" id="roc-gauge-factors"></div>
            </div>

            <div class="roc-divider"><div class="roc-divider-line"></div><div class="roc-divider-dot"></div><div class="roc-divider-line"></div></div>

            <div class="roc-section-label">RO Intelligence</div>

            <!-- Collapsible 1: Findings Overview -->
            <div class="roc-collapsible-header" id="roc-coll-hdr-1">
              <span class="roc-collapsible-title">Findings Overview</span>
              <span class="roc-chevron">&#8250;</span>
            </div>
            <div class="roc-collapsible-body" id="roc-coll-body-1">
              <p style="font-size:12px; color:#3a3a3a; line-height:1.6;" id="roc-intel-summary">—</p>
            </div>

            <!-- Collapsible 2: Technical Detail -->
            <div class="roc-collapsible-header" id="roc-coll-hdr-2">
              <span class="roc-collapsible-title">Technical Detail</span>
              <span class="roc-chevron">&#8250;</span>
            </div>
            <div class="roc-collapsible-body" id="roc-coll-body-2">
              <div id="roc-intel-technical"></div>
            </div>

            <!-- Collapsible 3: How to Open the Call -->
            <div class="roc-collapsible-header" id="roc-coll-hdr-3">
              <span class="roc-collapsible-title">How to Open the Call</span>
              <span class="roc-chevron">&#8250;</span>
            </div>
            <div class="roc-collapsible-body" id="roc-coll-body-3">
              <p style="font-size:12px; color:#3a3a3a; line-height:1.6;" id="roc-intel-callscript">—</p>
            </div>

            <!-- Collapsible 4: Services on RO -->
            <div class="roc-collapsible-header" id="roc-coll-hdr-4">
              <span class="roc-collapsible-title">Services on RO</span>
              <span class="roc-chevron">&#8250;</span>
            </div>
            <div class="roc-collapsible-body" id="roc-coll-body-4">
              <div id="roc-intel-services"></div>
            </div>

            <div class="roc-divider"><div class="roc-divider-line"></div><div class="roc-divider-dot"></div><div class="roc-divider-line"></div></div>

            <div class="roc-section-label">Advisor Quick Actions</div>
            <div class="roc-quick-action-wrap">
              <div class="roc-quick-action" id="roc-part-lookup-wrap">
                <div class="roc-quick-action-header">
                  <input type="text" id="roc-part-lookup-input" placeholder="Part or system name…">
                  <button class="roc-quick-action-btn" id="roc-part-lookup-btn" type="button">Look Up</button>
                </div>
                <div class="roc-quick-result" id="roc-part-lookup-result"></div>
              </div>
              <div class="roc-quick-action" id="roc-objection-wrap">
                <div class="roc-quick-action-header">
                  <input type="text" id="roc-objection-input" placeholder="Describe the objection…">
                  <button class="roc-quick-action-btn" id="roc-objection-btn" type="button">Help</button>
                </div>
                <div class="roc-quick-result" id="roc-objection-result"></div>
              </div>
            </div>

            <button class="roc-advance-btn" id="roc-combustion-advance" type="button">Sale Complete — Move to Exhaust</button>
          </div>
        </div><!-- /roc-screen-combustion -->

        <!-- ── STEP 4: EXHAUST ────────────────────────────────────── -->
        <div class="roc-screen" id="roc-screen-exhaust">
          <div class="roc-body">
            <div class="roc-section-label">Step Summary</div>
            <div class="roc-exhaust-summary">
              <div class="roc-exhaust-mini-card">
                <div class="roc-exhaust-mini-label">Intake</div>
                <div class="roc-exhaust-mini-value">Complete</div>
              </div>
              <div class="roc-exhaust-mini-card">
                <div class="roc-exhaust-mini-label">Compression</div>
                <div class="roc-exhaust-mini-value" id="roc-exhaust-comp-val">Complete</div>
              </div>
              <div class="roc-exhaust-mini-card">
                <div class="roc-exhaust-mini-label">Combustion</div>
                <div class="roc-exhaust-mini-value" id="roc-exhaust-comb-val">Sold</div>
              </div>
            </div>

            <div class="roc-divider"><div class="roc-divider-line"></div><div class="roc-divider-dot"></div><div class="roc-divider-line"></div></div>

            <div class="roc-section-label">What Happened After the Sale?</div>
            <div class="roc-chip-row" id="roc-exhaust-chips">
              <button class="roc-chip" type="button" data-situation="supplement">Supplement Item</button>
              <button class="roc-chip" type="button" data-situation="delay">Delay Follow-up</button>
              <button class="roc-chip" type="button" data-situation="objection">Post-sale Objection</button>
              <button class="roc-chip" type="button" data-situation="pickup">Ready for Pickup</button>
            </div>

            <div class="roc-divider"><div class="roc-divider-line"></div><div class="roc-divider-dot"></div><div class="roc-divider-line"></div></div>

            <div class="roc-section-label">Coaching Chat</div>
            <div class="roc-chat-history" id="roc-exhaust-history"></div>
            <div class="roc-chat-input-row">
              <textarea class="roc-chat-input" id="roc-exhaust-input" rows="2" placeholder="Describe the situation…"></textarea>
              <button class="roc-chat-send-btn" id="roc-exhaust-send" type="button">&#8593;</button>
            </div>
          </div>
        </div><!-- /roc-screen-exhaust -->

      </div><!-- /#tool-roc-content -->
  ```

- [ ] **Step 3: Verify HTML is valid**

  Open `sidepanel.html` in a browser (`File > Open`) or use the extension in Chrome. Navigate to `chrome://extensions`, reload the extension, open the sidebar, click RO Copilot tile. Expected: the step rail header appears (it may be non-functional until JS is added).

- [ ] **Step 4: Commit**

  ```bash
  git add auto-shop-copilot/sidepanel.html
  git commit -m "feat: replace ROC HTML with 4-step Intake/Compression/Combustion/Exhaust design"
  ```

---

## Task 7: sidepanel.js — Core Session State + Navigation

**Files:**
- Modify: `auto-shop-copilot/sidepanel.js`

**Context:** Lines 3042–3510 contain the old ROC functions. Replace them entirely with the new ROC implementation. This task covers: session state management, step navigation, and `openTool`/`goBackToHub` integration. Subsequent tasks add per-step logic.

- [ ] **Step 1: Update `openTool()` to hide outer header for ROC**

  Find `function openTool(toolKey)` (line 157). At the top of the function (after `const meta = TOOL_META[toolKey]; if (!meta) return;`), add:

  ```js
  // ROC uses its own step-rail header; hide the outer tool-header for ROC
  document.getElementById('tool-header').style.display = (toolKey === 'roc') ? 'none' : '';
  ```

  Also at the end of `openTool`, add:
  ```js
  // ROC: initialize when opened
  if (toolKey === 'roc') rocOnOpen();
  ```

- [ ] **Step 2: Update `goBackToHub()` to restore outer header**

  Find `function goBackToHub()` (search for `goBackToHub`). Add at the start of the function:
  ```js
  document.getElementById('tool-header').style.display = '';
  ```

- [ ] **Step 3: Replace all ROC functions (lines 3042–3510)**

  Delete everything from `let rocCurrentPhase = 1;` through the end of the `rocInterpretDvi` function (the old code ends around line 3510). Replace with the new ROC implementation. Start with the core state and navigation pieces:

  ```js
  // ═══════════════════════════════════════════════════════════════════
  // RO COPILOT — REDESIGN (Intake → Compression → Combustion → Exhaust)
  // ═══════════════════════════════════════════════════════════════════

  const ROC_STEPS = ['intake', 'compression', 'combustion', 'exhaust'];

  // In-memory state for current RO session
  let rocState = {
    roNumber:       null,
    currentStep:    'intake',
    intakeVerification: { concern: false, phone: false, address: false, techAssigned: false, contactPref: null },
    dviRaw:         null,
    dviIntelligence: null,   // { summary, technicalDetail, callScript, serviceChecklist }
    exhaustHistory: [],
    combustionReachedViaSale: false
  };

  // ── Session storage helpers ─────────────────────────────────────────

  function rocSaveState() {
    if (!rocState.roNumber) return;
    chrome.storage.session.set({ [`asc_roc_${rocState.roNumber}`]: rocState }).catch(() => {});
  }

  async function rocLoadState(roNumber) {
    return new Promise(resolve => {
      chrome.storage.session.get(`asc_roc_${roNumber}`, result => {
        resolve(result[`asc_roc_${roNumber}`] || null);
      });
    });
  }

  // ── Message helpers ─────────────────────────────────────────────────

  // rocSend — resolves with response.data on success, rejects on error.
  // Use for calls where success: false always means an error.
  function rocSend(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(payload, response => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (response?.success) resolve(response.data);
        else reject(new Error(response?.error || 'Request failed'));
      });
    });
  }

  // rocSendRaw — resolves with the full response object regardless of success flag.
  // Use when the caller needs to inspect response.data even when success: false
  // (e.g. add-canned-job returning { success: false, reason: 'no-canned-job-found' }).
  function rocSendRaw(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(payload, response => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(response || {});
      });
    });
  }

  // ── Step navigation ─────────────────────────────────────────────────

  function rocGoToStep(step) {
    if (!ROC_STEPS.includes(step)) return;
    rocState.currentStep = step;
    rocSaveState();

    // Update step rail pills
    ROC_STEPS.forEach((s, i) => {
      const pill   = document.getElementById(`roc-pill-${s}`);
      if (!pill) return;
      pill.classList.remove('active', 'done');
      const curIdx = ROC_STEPS.indexOf(step);
      if (i < curIdx)     pill.classList.add('done');
      else if (i === curIdx) pill.classList.add('active');
    });

    // Show correct screen — rely solely on .active CSS class (`.roc-screen { display:none }`,
    // `.roc-screen.active { display:flex }`). Do NOT set style.display directly; inline styles
    // override CSS classes and would prevent screens from showing when the class is toggled.
    ROC_STEPS.forEach(s => {
      const screen = document.getElementById(`roc-screen-${s}`);
      if (screen) screen.classList.toggle('active', s === step);
    });

    // Populate step-specific content
    if (step === 'intake')      rocPopulateIntake();
    if (step === 'compression') rocPopulateCompression();
    if (step === 'combustion')  rocPopulateCombustion();
    if (step === 'exhaust')     rocPopulateExhaust();
  }

  function rocPrevStep() {
    const idx = ROC_STEPS.indexOf(rocState.currentStep);
    if (idx <= 0) {
      // Back from step 1 returns to hub
      document.getElementById('tool-header').style.display = '';
      goBackToHub();
      return;
    }
    rocGoToStep(ROC_STEPS[idx - 1]);
  }

  // ── Init & wire-up ──────────────────────────────────────────────────

  function initRocWizard() {
    // Navigation buttons
    document.getElementById('roc-back-btn')  ?.addEventListener('click', rocPrevStep);
    document.getElementById('roc-close-btn') ?.addEventListener('click', () => {
      document.getElementById('tool-header').style.display = '';
      goBackToHub();
    });

    // Step rail: each pill jumps to that step
    ROC_STEPS.forEach(step => {
      document.getElementById(`roc-pill-${step}`)?.addEventListener('click', () => rocGoToStep(step));
    });

    // Intake advance
    document.getElementById('roc-intake-advance')?.addEventListener('click', () => rocGoToStep('compression'));

    // Intake write-back triggers
    document.getElementById('roc-verify-phone')  ?.addEventListener('click', () => rocToggleInlineEdit('phone'));
    document.getElementById('roc-verify-address')?.addEventListener('click', () => rocToggleInlineEdit('address'));
    document.getElementById('roc-phone-save-btn')  ?.addEventListener('click', rocSavePhone);
    document.getElementById('roc-address-save-btn')?.addEventListener('click', rocSaveAddress);
    document.getElementById('roc-pref-call')?.addEventListener('click', () => rocSetContactPref('call'));
    document.getElementById('roc-pref-text')?.addEventListener('click', () => rocSetContactPref('text'));

    // Compression advance
    document.getElementById('roc-compression-advance')?.addEventListener('click', rocDviComplete);

    // Combustion collapsibles
    [1,2,3,4].forEach(n => {
      const hdr = document.getElementById(`roc-coll-hdr-${n}`);
      const bdy = document.getElementById(`roc-coll-body-${n}`);
      if (hdr && bdy) {
        hdr.addEventListener('click', () => {
          hdr.classList.toggle('open');
          bdy.classList.toggle('open');
        });
      }
    });

    // Combustion: "Add to RO" buttons — event delegation (MV3 forbids inline onclick attributes)
    document.getElementById('roc-intel-services')?.addEventListener('click', e => {
      const btn = e.target.closest('.roc-add-ro-btn');
      if (btn && !btn.classList.contains('adding') && !btn.classList.contains('added')) {
        const idx  = parseInt(btn.dataset.idx, 10);
        const name = btn.dataset.name || '';
        rocAddServiceToRO(idx, name);
      }
    });

    // Combustion quick actions
    document.getElementById('roc-part-lookup-btn') ?.addEventListener('click', rocPartLookup);
    document.getElementById('roc-objection-btn')   ?.addEventListener('click', rocObjectionHelp);
    document.getElementById('roc-part-lookup-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') rocPartLookup(); });
    document.getElementById('roc-objection-input')  ?.addEventListener('keydown', e => { if (e.key === 'Enter') rocObjectionHelp(); });

    // Combustion advance
    document.getElementById('roc-combustion-advance')?.addEventListener('click', () => {
      rocState.combustionReachedViaSale = true;
      rocSaveState();
      rocGoToStep('exhaust');
    });

    // Exhaust situation chips
    document.getElementById('roc-exhaust-chips')?.addEventListener('click', e => {
      const chip = e.target.closest('[data-situation]');
      if (chip) rocExhaustChip(chip.dataset.situation);
    });

    // Exhaust coaching chat
    document.getElementById('roc-exhaust-send')?.addEventListener('click', rocExhaustSend);
    document.getElementById('roc-exhaust-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); rocExhaustSend(); }
    });

    // Listen for sidebar-pushed messages
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === 'asc_dviReady') {
        rocState.dviRaw = request.payload;
        rocSaveState();
        rocUpdateDviCaptureStatus();
      }
      if (request.action === 'asc_dviReadyForImport') {
        // DVI Ready button tapped on TekMetric page — trigger DVI import
        if (rocState.currentStep === 'compression') rocDviComplete();
      }
      if (request.action === 'asc_roAutoDetected') {
        // Open ROC Intake if not already in the ROC tool
        const activeTool = document.getElementById('screen-tool')?.dataset.currentTool;
        if (activeTool !== 'roc') openTool('roc');
      }
    });

    // Populate DVI checklist from culture profile (static, no API needed)
    rocBuildDviChecklist();
  }

  // Called by openTool('roc') and by tmLoadRO when ROC is active
  // NOTE: `lastRoId` in sidepanel.js is the TekMetric repair order numeric ID extracted
  // from the URL (e.g. "12345"). `rocState.roNumber` stores that same value as a string.
  // They refer to the same thing — the TekMetric RO ID, not the human-readable RO number
  // (e.g. "RO-4567"). The session storage key `asc_roc_${roNumber}` uses the URL-extracted ID.
  async function rocOnOpen() {
    if (!lastRoId) {
      rocShowNoRo();
      return;
    }
    const roKey = String(lastRoId);
    // Restore persisted state for this RO if available
    const saved = await rocLoadState(roKey);
    if (saved && saved.roNumber === roKey) {
      Object.assign(rocState, saved);
    } else {
      rocState = { roNumber: roKey, currentStep: 'intake', intakeVerification: { concern: false, phone: false, address: false, techAssigned: false, contactPref: null }, dviRaw: null, dviIntelligence: null, exhaustHistory: [], combustionReachedViaSale: false };
    }
    rocGoToStep(rocState.currentStep);
  }

  // Backward-compatible hook: called by tmLoadRO() when a new RO is fetched
  function rocUpdateFromTM() {
    // If ROC tool is currently open, re-init for the new RO
    const activeTool = document.getElementById('screen-tool')?.dataset.currentTool;
    if (activeTool === 'roc') rocOnOpen();
    // Else: rocOnOpen() will run when the advisor opens the tool
  }

  function rocShowNoRo() {
    const noRoNote = document.getElementById('roc-no-ro-note');
    if (noRoNote) noRoNote.style.display = 'block';
    rocGoToStep('intake');
  }
  ```

- [ ] **Step 4: Wire up `initRocWizard()` in the existing init block**

  Find the existing `window.addEventListener('load', ...)` or `DOMContentLoaded` block in `sidepanel.js` where other tools are initialized. In the current code (around line 133), there is a comment `// ── Initialize RO Copilot ──` followed by a call to `initRocWizard()`. Confirm it is still there:
  ```bash
  grep -n "initRocWizard" auto-shop-copilot/sidepanel.js
  ```
  Expected: at least 2 matches (definition + call). If the call was lost when removing the old ROC code, re-add it inside the `load` event listener, alongside the other tool `init*` calls:
  ```js
  initRocWizard();
  ```

- [ ] **Step 5: Verify navigation works**

  Reload the extension. Open the RO Copilot tile. Expected:
  - Orange step-rail header appears (outer header hidden)
  - Step 1 (Intake) screen visible with "No RO loaded" note
  - Tapping step pills switches between screens
  - Back arrow from Intake returns to hub; outer header restored
  - X close returns to hub; outer header restored

- [ ] **Step 6: Commit**

  ```bash
  git add auto-shop-copilot/sidepanel.js
  git commit -m "feat: ROC core — session state, step navigation, openTool integration"
  ```

---

## Task 8: sidepanel.js — Step 1 Intake

**Files:**
- Modify: `auto-shop-copilot/sidepanel.js`

Add the Intake step population and write-back functions. Append to the ROC section from Task 7.

- [ ] **Step 1: Add `rocPopulateIntake()`**

  ```js
  // ── STEP 1: INTAKE ──────────────────────────────────────────────────

  function rocPopulateIntake() {
    const noRoNote = document.getElementById('roc-no-ro-note');
    if (!tmLoadedData) {
      if (noRoNote) noRoNote.style.display = 'block';
      return;
    }
    if (noRoNote) noRoNote.style.display = 'none';

    const s = tmLoadedData.summary;
    const v = tmLoadedData;  // full data object

    // Concern
    const hasConcern = (s.concernsList?.length ?? 0) > 0;
    rocState.intakeVerification.concern = hasConcern;
    rocSetVerify('concern', hasConcern, 'OK', 'Missing');

    // Phone
    const hasPhone = !!(s.hasPhone || s.hasEmail);
    rocState.intakeVerification.phone = hasPhone;
    rocSetVerify('phone', hasPhone, 'On file', 'Tap to add', hasPhone ? null : 'phone');

    // Contact pref (show only when phone present)
    const prefRow = document.getElementById('roc-contact-pref-row');
    if (prefRow) prefRow.style.display = hasPhone ? 'block' : 'none';
    if (rocState.intakeVerification.contactPref) {
      rocSetContactPref(rocState.intakeVerification.contactPref, false);
    }

    // Address
    const hasAddress = !!(v.formatted?.includes('Address:') && !v.formatted?.includes('Address: N/A') && !v.formatted?.includes('Address: None'));
    rocState.intakeVerification.address = hasAddress;
    rocSetVerify('address', hasAddress, 'On file', 'Tap to add', hasAddress ? null : 'address');

    // Tech assigned
    const hasTech = !!s.hasTech;
    rocState.intakeVerification.techAssigned = hasTech;
    rocSetVerify('tech', hasTech, 'Assigned', 'Not assigned');
    const techNote = document.getElementById('roc-tech-note');
    if (techNote) techNote.style.display = hasTech ? 'none' : 'block';

    rocSaveState();
  }

  function rocSetVerify(key, isOk, okLabel, warnLabel, editKey) {
    const item   = document.getElementById(`roc-verify-${key}`);
    const status = document.getElementById(`roc-${key}-status`);
    if (!item || !status) return;
    item.classList.toggle('warning', !isOk);
    status.textContent = isOk ? okLabel : warnLabel;
    status.className   = `roc-verify-status ${isOk ? 'ok' : 'warn'}`;
  }

  function rocToggleInlineEdit(key) {
    const item = document.getElementById(`roc-verify-${key}`);
    const edit = document.getElementById(`roc-${key}-edit`);
    if (!item || !edit) return;
    if (!item.classList.contains('warning')) return;
    edit.classList.toggle('open');
  }

  // NOTE: Contact preference (call vs. text) is stored in rocState session only.
  // The TekMetric API does not expose a standalone "contactPreference" PATCH endpoint;
  // the phones array PATCH could encode this via phone type, but it requires knowing
  // the existing phone record ID. For now this is session-state only — intentional.
  function rocSetContactPref(pref, save = true) {
    rocState.intakeVerification.contactPref = pref;
    if (save) rocSaveState();
    ['call', 'text'].forEach(p => {
      document.getElementById(`roc-pref-${p}`)?.classList.toggle('selected', p === pref);
    });
  }

  async function rocSavePhone() {
    const input = document.getElementById('roc-phone-input');
    const phone = input?.value?.trim();
    if (!phone) return;
    const btn = document.getElementById('roc-phone-save-btn');
    btn.disabled = true; btn.textContent = 'Saving…';

    const customerId = tmLoadedData?.summary?.customerId;
    if (!customerId) {
      btn.disabled = false; btn.textContent = 'Save to TekMetric';
      showRocError('Could not find customer ID. Save manually in TekMetric.');
      return;
    }
    try {
      await rocSend({
        action: 'asc_rocUpdateCustomer',
        customerId,
        fields: { phones: [{ number: phone, type: 'MOBILE', primary: true }] }
      });
      rocState.intakeVerification.phone = true;
      rocSaveState();
      document.getElementById('roc-phone-edit')?.classList.remove('open');
      rocSetVerify('phone', true, 'On file', '');
      document.getElementById('roc-contact-pref-row').style.display = 'block';
    } catch (err) {
      showRocError(`Could not save phone: ${err.message}`);
    }
    btn.disabled = false; btn.textContent = 'Save to TekMetric';
  }

  async function rocSaveAddress() {
    const street = document.getElementById('roc-address-input')?.value?.trim();
    const city   = document.getElementById('roc-city-input')?.value?.trim();
    const state  = document.getElementById('roc-state-input')?.value?.trim();
    const zip    = document.getElementById('roc-zip-input')?.value?.trim();
    if (!street || !city || !state || !zip) return;
    const btn = document.getElementById('roc-address-save-btn');
    btn.disabled = true; btn.textContent = 'Saving…';

    const customerId = tmLoadedData?.summary?.customerId;
    if (!customerId) {
      btn.disabled = false; btn.textContent = 'Save to TekMetric';
      showRocError('Could not find customer ID. Save manually in TekMetric.');
      return;
    }
    try {
      await rocSend({
        action: 'asc_rocUpdateCustomer',
        customerId,
        fields: { address: { address1: street, city, state, zip } }
      });
      rocState.intakeVerification.address = true;
      rocSaveState();
      document.getElementById('roc-address-edit')?.classList.remove('open');
      rocSetVerify('address', true, 'On file', '');
    } catch (err) {
      showRocError(`Could not save address: ${err.message}`);
    }
    btn.disabled = false; btn.textContent = 'Save to TekMetric';
  }

  function showRocError(msg) {
    // Show a brief error inline — reuse the roc-error-note element in the active screen
    const note = document.querySelector(`.roc-screen.active .roc-error-note`);
    if (note) { note.textContent = msg; note.style.display = 'block'; setTimeout(() => { note.style.display = 'none'; }, 5000); }
  }
  ```

  **Important note about `customerId`:** The existing `tmLoadedData.summary` may not include `customerId`. Check `tmFormatROData()` in `background.js` to see what fields are in `summary`. If `customerId` is not present in `summary`, you will need to extract it from `tmLoadedData.formatted` via regex, or add it to `tmFormatROData`. Do this check before testing:
  ```bash
  grep -n "customerId\|customer_id\|summary" auto-shop-copilot/background.js | head -20
  ```
  If `customerId` is not in `summary`, add it to `tmFormatROData` in `background.js` as part of this task.

- [ ] **Step 2: Verify Intake step works**

  Load extension, navigate to a TekMetric RO with a missing phone. Open RO Copilot. Expected:
  - Verify checklist shows green/yellow correctly based on RO data
  - Tapping a yellow phone row opens the inline edit
  - Tapping "Intake Complete" advances to Compression step

- [ ] **Step 3: Commit**

  ```bash
  git add auto-shop-copilot/sidepanel.js auto-shop-copilot/background.js
  git commit -m "feat: ROC Intake step — verify checklist with write-back for phone and address"
  ```

---

## Task 9: sidepanel.js — Step 2 Compression

**Files:**
- Modify: `auto-shop-copilot/sidepanel.js`

Add Compression step functions. Append after the Intake functions from Task 8.

- [ ] **Step 1: Add DVI checklist builder**

  ```js
  // ── STEP 2: COMPRESSION ─────────────────────────────────────────────

  function rocBuildDviChecklist() {
    // Culture profile DVI checklist — currently hardcoded to Cardinal Plaza Shell defaults
    // In a multi-shop future this would come from a shop settings fetch
    const checklist = [
      { name: 'Brakes & Rotors',       photoRequired: true,       note: 'Measure pad thickness and rotor condition front and rear' },
      { name: 'Tires (all 4 corners)',  photoRequired: true,       note: 'Measure tread depth at each corner; note any uneven wear' },
      { name: 'Fluids',                 photoRequired: false,      note: 'Check color and level: engine oil, coolant, brake fluid, power steering, transmission' },
      { name: 'Engine Air Filter',      photoRequired: 'if-dirty', note: 'Compare to new filter if possible' },
      { name: 'Cabin Air Filter',       photoRequired: 'if-dirty', note: 'Note condition and mileage since last replacement' },
      { name: 'Battery',                photoRequired: false,      note: 'Test CCA and record result' },
      { name: 'Wiper Blades',           photoRequired: false,      note: 'Check condition; note streaking or fraying' },
      { name: 'Belts & Hoses',          photoRequired: false,      note: 'Check for cracking, fraying, or softness' },
    ];
    const wrap = document.getElementById('roc-dvi-checklist-wrap');
    if (!wrap) return;
    wrap.innerHTML = checklist.map(item => {
      const photoHtml = item.photoRequired === true
        ? `<span class="roc-photo-badge required">Photo req.</span>`
        : item.photoRequired === 'if-dirty'
        ? `<span class="roc-photo-badge if-dirty">Photo if dirty</span>`
        : '';
      return `<div class="roc-dvi-checklist-item">
        <div style="flex:1;">
          <div class="roc-dvi-item-name">${item.name}</div>
          <div class="roc-dvi-item-note">${item.note}</div>
        </div>
        ${photoHtml}
      </div>`;
    }).join('');
  }

  function rocPopulateCompression() {
    rocUpdateDviCaptureStatus();
  }

  function rocUpdateDviCaptureStatus() {
    const el = document.getElementById('roc-dvi-capture-status');
    if (!el) return;
    if (rocState.dviRaw) {
      const count = rocState.dviRaw.inspectionItems?.length || rocState.dviRaw.allJobs?.length || 0;
      el.textContent = count > 0 ? `${count} DVI items captured — ready to import.` : 'DVI data captured — ready to import.';
      el.style.color = '#16A34A';
    } else {
      el.textContent = 'Waiting for DVI data…';
      el.style.color = '#9a8880';
    }
  }
  ```

- [ ] **Step 2: Add `rocDviComplete()` — the main DVI import + interpret flow**

  ```js
  async function rocDviComplete() {
    const advanceBtn  = document.getElementById('roc-compression-advance');
    const loadingEl   = document.getElementById('roc-compression-loading');
    const errorEl     = document.getElementById('roc-compression-error');

    if (advanceBtn)  advanceBtn.style.display  = 'none';
    if (loadingEl)   loadingEl.style.display   = 'block';
    if (errorEl)     errorEl.style.display     = 'none';

    try {
      // Step 1: ensure we have DVI data — try cache if not in state
      if (!rocState.dviRaw && lastRoId) {
        const cached = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: 'asc_getDviCache', roId: lastRoId }, r => {
            resolve(r?.success ? r.payload : null);
          });
        });
        if (cached) rocState.dviRaw = cached;
      }

      if (!rocState.dviRaw) {
        // No DVI data captured — attempt a DOM scrape. The background handler forwards
        // the request to content.js and awaits the content script's response before
        // resolving, so we can safely await here without a fixed timeout.
        const scrapeRes = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: 'asc_requestDviScrape' }, r => resolve(r || {}));
        });
        if (scrapeRes.onPage) {
          // Scrape was triggered; wait for the asc_dviReady message which updates rocState.dviRaw.
          // Give content.js up to 2 seconds to process and report back.
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        // Re-check cache after scrape attempt
        if (!rocState.dviRaw && lastRoId) {
          const cached = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'asc_getDviCache', roId: lastRoId }, r => {
              resolve(r?.success ? r.payload : null);
            });
          });
          if (cached) rocState.dviRaw = cached;
        }
        if (!scrapeRes.onPage) {
          throw new Error('Navigate to the Inspections tab in TekMetric first, then tap DVI Complete again.');
        }
      }

      if (!rocState.dviRaw) throw new Error('No DVI data found. Navigate to the Inspections tab in TekMetric first.');

      // Step 2: build dviItems array for Cloud Run
      const dviItems = rocBuildDviItemsArray(rocState.dviRaw);
      const roContext = tmLoadedData?.formatted || '';

      // Step 3: call /ro-copilot/interpret-dvi
      const intel = await rocSend({ action: 'asc_rocInterpretDvi', dviItems, roContext });
      rocState.dviIntelligence = intel;
      rocSaveState();

      // Step 4: advance to Combustion
      rocGoToStep('combustion');
    } catch (err) {
      if (errorEl)   { errorEl.textContent = err.message; errorEl.style.display = 'block'; }
      if (advanceBtn)  advanceBtn.style.display  = 'block';
    }

    if (loadingEl) loadingEl.style.display = 'none';
  }

  function rocBuildDviItemsArray(dviRaw) {
    if (dviRaw.inspectionItems?.length > 0) {
      return dviRaw.inspectionItems.map(i => ({
        name:   i.name || i.label || i.description || 'Item',
        status: i.status || i.result || i.rating || 'unknown',
        note:   i.note || i.technicianNote || i.notes || i.cause || ''
      }));
    }
    if (dviRaw.allJobs?.length > 0) {
      return dviRaw.allJobs.map(j => ({
        name:   j.name || j.laborName || 'Item',
        status: j.approved ? 'approved' : j.declined ? 'declined' : (j.status || 'pending'),
        note:   [j.concern, j.cause, j.correction].filter(Boolean).join(' | ')
      }));
    }
    if (dviRaw.rawText) return [{ name: 'Full DVI text', status: 'unknown', note: dviRaw.rawText.substring(0, 2000) }];
    return [];
  }
  ```

- [ ] **Step 3: Verify Compression step works**

  Load extension on a TekMetric inspection page. DVI capture status should update to "X DVI items captured" when the page-fetch-interceptor captures data. Tapping "DVI Complete — Import & Continue" should show "Interpreting DVI findings…" then advance to Combustion.

- [ ] **Step 4: Commit**

  ```bash
  git add auto-shop-copilot/sidepanel.js
  git commit -m "feat: ROC Compression step — DVI checklist, capture status, interpret flow"
  ```

---

## Task 10: sidepanel.js — Step 3 Combustion

**Files:**
- Modify: `auto-shop-copilot/sidepanel.js`

Append after the Compression functions from Task 9.

- [ ] **Step 1: Add `rocPopulateCombustion()` and `rocComputeReadiness()`**

  ```js
  // ── STEP 3: COMBUSTION ───────────────────────────────────────────────

  function rocPopulateCombustion() {
    if (!rocState.dviIntelligence) {
      // Edge case: jumped to Combustion via step rail without completing Compression
      document.getElementById('roc-intel-summary').textContent = 'No DVI intelligence loaded. Complete the Compression step first.';
      return;
    }
    const intel = rocState.dviIntelligence;

    // Summary
    const summaryEl = document.getElementById('roc-intel-summary');
    if (summaryEl) summaryEl.textContent = intel.summary || '—';

    // Technical detail
    const techEl = document.getElementById('roc-intel-technical');
    if (techEl && Array.isArray(intel.technicalDetail)) {
      techEl.innerHTML = intel.technicalDetail.map(item =>
        `<div style="margin-bottom:8px;">
          <div style="font-size:11px; font-weight:700; color:#9A3412;">${item.item}</div>
          <div style="font-size:12px; color:#3a3a3a; line-height:1.5;">${item.detail}</div>
        </div>`
      ).join('');
    }

    // Call script
    const scriptEl = document.getElementById('roc-intel-callscript');
    if (scriptEl) scriptEl.textContent = intel.callScript || '—';

    // Service checklist
    rocRenderServiceChecklist(intel.serviceChecklist || []);

    // Readiness gauge
    rocUpdateReadinessGauge();
  }

  function rocRenderServiceChecklist(checklist) {
    const el = document.getElementById('roc-intel-services');
    if (!el) return;
    if (!checklist.length) { el.innerHTML = '<p style="font-size:12px; color:#9a8880;">No services identified.</p>'; return; }
    el.innerHTML = checklist.map((svc, idx) => {
      if (svc.status === 'on-ro') {
        return `<div class="roc-service-row">
          <span class="roc-service-name">${svc.name}</span>
          <span class="roc-on-ro-badge">On RO</span>
        </div>`;
      }
      // NOTE: No inline onclick — MV3 Content Security Policy blocks inline handlers.
      // The click is handled by event delegation on #roc-intel-services in initRocWizard().
      return `<div class="roc-service-row" id="roc-svc-row-${idx}">
        <span class="roc-service-name">${svc.name}</span>
        <button class="roc-add-ro-btn" id="roc-add-ro-${idx}" type="button"
          data-idx="${idx}" data-name="${svc.name.replace(/"/g, '&quot;')}">Add to RO</button>
      </div>`;
    }).join('');
  }

  async function rocAddServiceToRO(idx, serviceName) {
    const btn = document.getElementById(`roc-add-ro-${idx}`);
    if (!btn || btn.classList.contains('adding') || btn.classList.contains('added')) return;
    btn.classList.add('adding'); btn.textContent = 'Adding…';

    const roNumber = rocState.roNumber;
    // ASC_SHOP_ID is defined in background.js, NOT accessible here. Use tmLoadedData if available.
    const shopId   = tmLoadedData?.summary?.shopId || '238';
    try {
      // background.js wraps Cloud Run JSON as { success: true, data: <cloud-run-json> }.
      // rocSend resolves with response.data = the Cloud Run JSON, which may itself be
      // { success: false, reason: 'no-canned-job-found' } — a domain signal not an error,
      // so the background handler still sends success: true and rocSend still resolves.
      const result = await rocSend({ action: 'asc_rocAddCannedJob', roId: roNumber, shopId, serviceName });
      if (result?.success === false && result?.reason === 'no-canned-job-found') {
        // Fallback: copy to clipboard
        navigator.clipboard?.writeText(serviceName).catch(() => {});
        btn.classList.remove('adding');
        btn.textContent = 'Copied — add manually';
        btn.title = 'No canned job found. Service name copied to clipboard.';
      } else {
        btn.classList.remove('adding');
        btn.classList.add('added');
        btn.textContent = 'Added';
        rocUpdateReadinessGauge();
      }
    } catch (err) {
      btn.classList.remove('adding');
      btn.textContent = 'Failed — retry';
    }
  }

  function rocComputeReadiness() {
    const factors = [
      { label: 'DVI interpreted',              met: !!rocState.dviIntelligence },
      { label: 'All DVI services on RO',        met: rocAllServicesOnRO() },
      { label: 'Customer concern documented',   met: rocState.intakeVerification.concern },
      { label: 'Technician assigned to all jobs', met: rocState.intakeVerification.techAssigned },
    ];
    const score = Math.round(factors.filter(f => f.met).length * 25);
    return { score, factors };
  }

  function rocAllServicesOnRO() {
    const checklist = rocState.dviIntelligence?.serviceChecklist || [];
    // rocRenderServiceChecklist uses the flat array index (0-based across full list)
    // for button IDs. Only "missing" entries get an "Add to RO" button.
    // We check each flat index from the full checklist to find missing-item buttons.
    if (!checklist.length) return false;
    const hasMissing = checklist.some(s => s.status === 'missing');
    if (!hasMissing) return true;
    return checklist.every((svc, flatIdx) => {
      if (svc.status === 'on-ro') return true;               // already on RO
      const btn = document.getElementById(`roc-add-ro-${flatIdx}`);
      return btn?.classList.contains('added');               // manually added this session
    });
  }

  function rocUpdateReadinessGauge() {
    const { score, factors } = rocComputeReadiness();
    const pctEl    = document.getElementById('roc-gauge-pct');
    const fillEl   = document.getElementById('roc-gauge-fill');
    const factorEl = document.getElementById('roc-gauge-factors');
    if (pctEl)    pctEl.textContent = `${score}%`;
    if (fillEl)   fillEl.style.width = `${score}%`;
    if (factorEl) {
      factorEl.innerHTML = factors.map(f =>
        `<div class="roc-gauge-factor">
          <span class="roc-factor-dot ${f.met ? 'met' : 'not-met'}"></span>
          <span>${f.label}</span>
        </div>`
      ).join('');
    }
  }
  ```

- [ ] **Step 2: Add `rocPartLookup()` and `rocObjectionHelp()`**

  ```js
  async function rocPartLookup() {
    const input  = document.getElementById('roc-part-lookup-input');
    const result = document.getElementById('roc-part-lookup-result');
    const btn    = document.getElementById('roc-part-lookup-btn');
    const name   = input?.value?.trim();
    if (!name || !btn || !result) return;
    btn.disabled = true; btn.textContent = '…';
    result.classList.add('show'); result.textContent = 'Looking up…';
    try {
      const explanation = await rocSend({ action: 'asc_rocPartLookup', itemName: name, roContext: tmLoadedData?.formatted || '' });
      result.textContent = explanation;
    } catch (err) {
      result.textContent = 'Could not look up part. Please try again.';
    }
    btn.disabled = false; btn.textContent = 'Look Up';
  }

  async function rocObjectionHelp() {
    const input  = document.getElementById('roc-objection-input');
    const result = document.getElementById('roc-objection-result');
    const btn    = document.getElementById('roc-objection-btn');
    const text   = input?.value?.trim();
    if (!text || !btn || !result) return;
    btn.disabled = true; btn.textContent = '…';
    result.classList.add('show'); result.textContent = 'Generating response…';
    try {
      const response = await rocSend({ action: 'asc_rocObjectionHelp', objection: text, roContext: tmLoadedData?.formatted || '' });
      result.textContent = response;
    } catch (err) {
      result.textContent = 'Could not generate response. Please try again.';
    }
    btn.disabled = false; btn.textContent = 'Help';
  }
  ```

- [ ] **Step 3: Verify Combustion step works**

  After completing Compression (DVI interpreted), Combustion should display:
  - RO Readiness gauge (initially 25–75% depending on intake data)
  - Four collapsible sections (all collapsed by default, each opens on tap)
  - Services checklist with "On RO" badges and "Add to RO" buttons
  - Part Lookup and Objection Help inputs that return AI responses

- [ ] **Step 4: Commit**

  ```bash
  git add auto-shop-copilot/sidepanel.js
  git commit -m "feat: ROC Combustion step — readiness gauge, intelligence sections, add-to-RO, quick actions"
  ```

---

## Task 11: sidepanel.js — Step 4 Exhaust

**Files:**
- Modify: `auto-shop-copilot/sidepanel.js`

Append after the Combustion functions from Task 10.

- [ ] **Step 1: Add `rocPopulateExhaust()` and situation chip handler**

  ```js
  // ── STEP 4: EXHAUST ──────────────────────────────────────────────────

  function rocPopulateExhaust() {
    // Prior step summary mini-cards
    const compVal = document.getElementById('roc-exhaust-comp-val');
    const combVal = document.getElementById('roc-exhaust-comb-val');
    if (compVal) {
      const count = rocState.dviRaw?.inspectionItems?.length || rocState.dviRaw?.allJobs?.length || 0;
      compVal.textContent = count > 0 ? `${count} findings` : 'Complete';
    }
    if (combVal) {
      combVal.textContent = rocState.combustionReachedViaSale ? 'Sold' : 'In Progress';
    }

    // Restore chat history
    rocRenderExhaustChat();
  }

  function rocRenderExhaustChat() {
    const el = document.getElementById('roc-exhaust-history');
    if (!el) return;
    el.innerHTML = rocState.exhaustHistory.map(m =>
      `<div class="roc-chat-bubble ${m.role}">${m.content.replace(/\n/g, '<br>')}</div>`
    ).join('');
    el.scrollTo(0, el.scrollHeight);
  }

  let rocExhaustLoading = false;

  async function rocExhaustChip(situationType) {
    // Mark chip as active
    document.querySelectorAll('#roc-exhaust-chips .roc-chip').forEach(c => c.classList.remove('active'));
    const chip = document.querySelector(`#roc-exhaust-chips [data-situation="${situationType}"]`);
    chip?.classList.add('active');

    const labels = { supplement: 'Supplement Item', delay: 'Delay Follow-up', objection: 'Post-sale Objection', pickup: 'Ready for Pickup' };
    const detail = `Situation: ${labels[situationType] || situationType}`;
    await rocExhaustCall(situationType, detail);
  }

  async function rocExhaustSend() {
    const input = document.getElementById('roc-exhaust-input');
    const msg   = input?.value?.trim();
    if (!msg || rocExhaustLoading) return;
    input.value = '';
    await rocExhaustCall('general', msg);
  }

  async function rocExhaustCall(situationType, detail) {
    if (rocExhaustLoading) return;
    rocExhaustLoading = true;
    const sendBtn = document.getElementById('roc-exhaust-send');
    if (sendBtn) sendBtn.disabled = true;

    rocState.exhaustHistory.push({ role: 'user', content: detail });
    rocRenderExhaustChat();

    // Show typing bubble
    const histEl  = document.getElementById('roc-exhaust-history');
    const typing  = document.createElement('div');
    typing.className = 'roc-chat-bubble assistant';
    typing.textContent = '…';
    histEl?.appendChild(typing);
    histEl?.scrollTo(0, histEl.scrollHeight);

    try {
      const script = await rocSend({
        action: 'asc_rocExhaustAssist',
        situationType,
        detail,
        roContext: tmLoadedData?.formatted || '',
        history:  rocState.exhaustHistory.slice(0, -1)
      });
      rocState.exhaustHistory.push({ role: 'assistant', content: script });
      rocSaveState();
    } catch (err) {
      rocState.exhaustHistory.push({ role: 'assistant', content: 'Something went wrong. Please try again.' });
    }

    typing.remove();
    rocRenderExhaustChat();
    rocExhaustLoading = false;
    if (sendBtn) sendBtn.disabled = false;
  }
  ```

- [ ] **Step 2: Verify Exhaust step works**

  After completing Combustion (tapping "Sale Complete"), Exhaust should display:
  - 3 mini-cards: Intake = "Complete", Compression = "N findings", Combustion = "Sold"
  - 4 situation chips (Supplement Item, Delay Follow-up, Post-sale Objection, Ready for Pickup)
  - Tapping a chip generates a script in the coaching chat
  - Free-form input in the chat also generates responses
  - Chat history persists when navigating away and back

- [ ] **Step 3: Commit**

  ```bash
  git add auto-shop-copilot/sidepanel.js
  git commit -m "feat: ROC Exhaust step — step summary, situation chips, coaching chat with history"
  ```

---

## Task 12: Verify `customerId` in tmLoadedData + End-to-End Smoke Test

**Files:**
- Possibly modify: `auto-shop-copilot/background.js` (if customerId not in summary)

- [ ] **Step 1: Verify `customerId` is available in `tmLoadedData.summary`**

  In `background.js`, find `tmFormatROData` (search for the function that builds the summary object returned to the sidebar). Check that it includes `customerId`. If not, add it:

  ```bash
  grep -n "customerId\|summary" auto-shop-copilot/background.js | grep -i "summary\s*="
  ```

  If `summary` object is built like `{ roNumber, customer, vehicle, ... }`, add `customerId: ro.customer?.id || ro.customerId || null` to the summary.

- [ ] **Step 2: Also verify `ASC_SHOP_ID` is accessible in sidepanel.js**

  In `background.js`, `const ASC_SHOP_ID = '238';` is defined. This constant is NOT accessible in `sidepanel.js`. In `rocAddServiceToRO`, we use `tmLoadedData.summary?.shopId` (if available) or fall back to `'238'`. Check what `tmLoadedData` contains for shopId:

  ```bash
  grep -n "shopId\|ASC_SHOP_ID\|shop_id" auto-shop-copilot/background.js | head -10
  ```

  If `shopId` is not in the summary, update `tmFormatROData` in `background.js` to include `shopId: ro.shopId || '238'`, then update the `rocAddServiceToRO` call in `sidepanel.js` to use `tmLoadedData?.summary?.shopId || '238'`.

- [ ] **Step 3: End-to-end smoke test**

  **Setup:**
  - Go to `chrome://extensions`, reload the extension
  - Navigate to any page in TekMetric with a live RO (e.g., `https://shop.tekmetric.com/repair-orders/[id]`)

  **Intake:**
  - [ ] Sidebar auto-fetches RO when URL is detected
  - [ ] Open RO Copilot tile — Intake screen appears with step rail
  - [ ] Verify checklist shows green/yellow for each field correctly
  - [ ] Tap a yellow phone row — inline edit opens
  - [ ] Tap "Intake Complete — Move to Compression" — advances to Compression

  **Compression:**
  - [ ] DVI checklist from culture profile shows all 8 items with photo badges
  - [ ] Navigate to the Inspections tab in TekMetric — DVI capture status updates to "X DVI items captured"
  - [ ] "DVI Ready" button visible on TekMetric inspection page
  - [ ] Tap "DVI Complete — Import & Continue" — shows "Interpreting DVI findings…" then advances to Combustion

  **Combustion:**
  - [ ] RO Readiness gauge shows a percentage
  - [ ] 4 collapsible sections present, all collapsed by default
  - [ ] Tapping each section header opens/closes it with chevron animation
  - [ ] "Findings Overview" shows the AI summary text
  - [ ] "Services on RO" shows on-ro items and "Add to RO" buttons for missing items
  - [ ] Tapping "Add to RO" — either marks "Added" or shows clipboard fallback
  - [ ] Part Lookup returns a plain-language explanation
  - [ ] Objection Help returns a response
  - [ ] Tap "Sale Complete — Move to Exhaust"

  **Exhaust:**
  - [ ] Mini-cards show correct values (Compression = item count, Combustion = "Sold")
  - [ ] Tapping each situation chip generates a script in the chat
  - [ ] Free-form input works
  - [ ] Chat history preserved when navigating away and returning to Exhaust

  **Session persistence:**
  - [ ] Navigate to a different page, come back to the RO Copilot — state is restored from `chrome.storage.session`
  - [ ] X close returns to hub; re-opening ROC resumes from saved step

- [ ] **Step 4: Deploy Cloud Run service**

  ```bash
  git push origin main
  ```
  Monitor Cloud Build for a successful deploy. Once deployed, re-run the smoke test against the live Cloud Run endpoint.

- [ ] **Step 5: Final commit if any fixes were made**

  ```bash
  git add -p  # stage only changed files
  git commit -m "fix: wire customerId and shopId into tmLoadedData summary for ROC write-back"
  ```

---

## Notes for Implementors

1. **No test framework** — this codebase has no unit test setup. All verification is manual in Chrome with a loaded TekMetric tab.

2. **DVI data variability** — TekMetric does not expose inspection data via API. The `page-fetch-interceptor.js` and DOM scraper in `content.js` are already implemented and working. The new ROC simply reads from whatever those capture and stores in session.

3. **`customerId` in summary** — the existing `tmFormatROData` in `background.js` builds the summary object. Task 12 confirms that `customerId` and `shopId` are present; if not, add them. This is a prerequisite for the Intake write-back to work.

4. **Cloud Run deployment** — Tasks 1–3 modify Cloud Run. They deploy automatically on push to `main` via Cloud Build. Do NOT run Tasks 5–11 (extension changes) in production until Cloud Run is deployed and the new endpoints are live.

5. **Old ROC functions removed** — the `asc_rocAssist` handler in `background.js` and `rocGenerateAssist` function in `background.js` are NOT removed in this plan (they are still called by the old `roc` tool handler). Once the new ROC is validated, those can be cleaned up in a follow-on task. For now they are harmless dead code.

6. **DVI checklist duplication** — the `dviChecklist` array is defined in both `cultureProfiles.js` (Task 1) and hardcoded inside `rocBuildDviChecklist()` in `sidepanel.js` (Task 9). This duplication is intentional: the Chrome extension cannot fetch from Cloud Run at init time to read the culture profile, so the sidebar maintains its own copy. Future multi-shop support will require a mechanism (e.g. a startup fetch that caches the profile in `chrome.storage.local`) to keep them in sync without duplication.

7. **`shopId` in `tmLoadedData.summary`** — Task 12 confirms whether `shopId` is available in the summary. If not, Task 12 Step 2 instructs adding it to `tmFormatROData` in `background.js`. The `rocAddServiceToRO` function in Task 10 already uses `tmLoadedData?.summary?.shopId || '238'` as the safe fallback — it will not throw a `ReferenceError`.

8. **`asc_requestDviScrape` already exists** — Task 5 Step 10 confirms the existing handler rather than adding it fresh. The DOM scrape fallback in `rocDviComplete()` (Task 9) already works via the existing content.js `scrapeInspectionsDom` function. The advisor must be on the TekMetric Inspections tab for the scrape to succeed; if not, a 1.5s timeout elapses and the function throws "No DVI data found" with a clear error message to the advisor.
