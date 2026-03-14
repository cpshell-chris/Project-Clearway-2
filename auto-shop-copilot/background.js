// Auto Shop Copilot — background.js
// Merged service worker for SA Hub + Admin Hub functionality.
// All action prefixes unified to asc_

const ASC_CLOUD_RUN_URL = 'https://advance-appointment-service-361478515851.us-east4.run.app';
const ASC_SHOP_ID = '238';

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});


// Listen for messages from the side panel AND content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Content script floating button → open side panel
  if (request.action === 'asc_openSidePanel') {
    const tabId    = sender.tab?.id;
    const windowId = sender.tab?.windowId;
    console.log('[ASC] openSidePanel received, tabId:', tabId, 'windowId:', windowId);
    if (tabId) {
      chrome.sidePanel.open({ tabId }, () => {
        if (chrome.runtime.lastError) {
          console.error('[ASC] sidePanel.open error:', chrome.runtime.lastError.message);
          if (windowId) chrome.sidePanel.open({ windowId });
        } else {
          console.log('[ASC] Side panel opened successfully');
        }
      });
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'asc_searchKnowledge') {
    performKnowledgeSearch(request.query, request.vehicleContext || null)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'asc_generateVCA') {
    performVCAGeneration(request.input, request.type)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'asc_sodCall') {
    performClaudeCall(request.systemPrompt, request.messages)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'asc_amaCall') {
    performClaudeCall(request.systemPrompt, request.messages)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Scheduling Wizard handlers
  if (request.action === 'asc_swTestConnection') {
    swTestConnection()
      .then(r => sendResponse({ success: true, data: r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (request.action === 'asc_swFetchRO') {
    swFetchRepairOrder(request.roId)
      .then(r => sendResponse({ success: true, data: r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (request.action === 'asc_swFetchVehicleHistory') {
    swFetchVehicleHistory(request.vehicleId)
      .then(r => sendResponse({ success: true, data: r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (request.action === 'asc_swFetchAppointmentCounts') {
    swFetchAppointmentCounts(request.startDate, request.endDate)
      .then(r => sendResponse({ success: true, data: r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (request.action === 'asc_swGeneratePMRR') {
    swGeneratePMRR(request.data, request.vehicleHistory)
      .then(r => sendResponse({ success: true, data: r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (request.action === 'asc_swCreateAppointment') {
    swCreateAppointment(request.appointmentData)
      .then(r => sendResponse({ success: true, data: r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  // TekMetric handlers
  if (request.action === 'asc_tmTestConnection') {
    tmTestConnection()
      .then(r  => sendResponse({ success: true,  data:  r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (request.action === 'asc_tmGetRO') {
    tmGetRepairOrder(request.roNumber)
      .then(r  => sendResponse({ success: true,  data:  r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (request.action === 'asc_tmSearch') {
    tmSearch(request.query, request.searchType)
      .then(r  => sendResponse({ success: true,  data:  r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (request.action === 'asc_searchLiveROs') {
    searchLiveROs(request.query || '')
      .then(r  => sendResponse({ success: true,  data:  r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (request.action === 'asc_rocAssist') {
    rocGenerateAssist(request.phase, request.roData || '', request.context || '', request.history || [])
      .then(r  => sendResponse({ success: true,  data:  r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  // DVI data captured by content script — store it and forward to sidebar
  if (request.action === 'asc_dviCapture') {
    const roId = request.roId || 'unknown';
    chrome.storage.session.set({ [`asc_dvi_${roId}`]: request }, () => {
      // Forward to sidebar so Phase 2 updates live
      chrome.runtime.sendMessage({ action: 'asc_dviReady', payload: request }).catch(() => {});
    });
    sendResponse({ success: true });
    return true;
  }

  // Sidebar asks background to tell content script to scrape now
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

  // Sidebar asks for any previously captured DVI for a given RO
  if (request.action === 'asc_getDviCache') {
    chrome.storage.session.get(`asc_dvi_${request.roId}`, result => {
      const data = result[`asc_dvi_${request.roId}`];
      sendResponse(data ? { success: true, payload: data } : { success: false });
    });
    return true;
  }

  // DVI interpretation via Claude
  if (request.action === 'asc_interpretDvi') {
    rocInterpretDvi(request.dviPayload, request.roData || '')
      .then(r  => sendResponse({ success: true,  data: r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  return true;
});


// ==================== KNOWLEDGE ASSISTANT ====================

async function performKnowledgeSearch(query, vehicleContext) {

  let vehicleInstruction = '';
  let vehicleJsonField = '"vehicle_context": null,';

  if (vehicleContext) {
    const fullRO = vehicleContext.fullROData || vehicleContext.historyNote || '';
    vehicleInstruction = `
VEHICLE ON FILE:
- Vehicle: ${vehicleContext.vehicle}
- Current Odometer: ${vehicleContext.odometer} miles
- RO: ${vehicleContext.roNumber}

FULL REPAIR ORDER & SERVICE HISTORY DATA:
${fullRO}

INSTRUCTIONS FOR USING THIS DATA:
1. Use the vehicle, mileage, and service history above to make every field specific to this vehicle.
2. Apply the CPS Maintenance Schedule below to determine where this service falls in the vehicle's predictive maintenance timeline.
3. Calculate T0/T6/T12 windows: assuming 1,000 miles/month, determine if this service is overdue (T0), due within 6 months (T6), or due within 12 months (T12). State this naturally in urgency_note and sa_coaching_tip.
4. In sa_coaching_tip: reference what the history shows for this specific service — when was it last done, how many miles since, and what that means for this vehicle right now.
5. If the history shows this service has never been performed or there is no record, say so clearly in sa_coaching_tip.

Populate the vehicle_context field in your response as shown below.`;

    vehicleJsonField = `"vehicle_context": {
    "vehicle": "exact vehicle string from above",
    "odometer": "current odometer string from above",
    "history_note": "one clear sentence: when this service was last performed on this vehicle (mileage + approximate date if available), how many miles since, and whether it is overdue / due now / due soon / not yet due based on the CPS schedule"
  },`;
  }

  const systemPrompt = `You are the Knowledge Assistant for Cardinal Plaza Shell, a premier automotive service center in Springfield, VA (8334 Old Keene Mill Rd, Springfield, VA 22152 • 703-451-8373 • cardinalplazashell.com).

Your purpose is to give service advisors — especially newer ones — the knowledge and confidence of a seasoned expert, so they can serve every customer at the highest level.

CARDINAL PLAZA SHELL VOICE — always embodied, never stated:
- Calm, educational, and warm. Never clinical or robotic.
- Respect the customer's intelligence and autonomy.
- Focus on outcomes: safety, reliability, peace of mind.
- Plain language. No jargon without explanation.
- The customer is always in control of their decision.
- Hospitality mindset: every guest should leave feeling cared for.

OUR FOUR PROMISES (weave in naturally when relevant — never recite as a list):
• To be your trusted advisor
• To help you make the best decisions possible for you
• To provide a unique, no-pressure, transparent, educational environment
• To place the safety of you and your family as our primary goal

TEAM CREDENTIALS & EQUIPMENT (reference naturally when building confidence):
- ASE certified automotive technicians
- Virginia DEQ certified for emission-related repairs
- State-approved Virginia Safety and Emission Inspection Station
- Latest Hunter alignment equipment
- OE factory scan tools and ADAS calibration equipment
- Autel scan tools and calibration equipment
- OE factory programming and software updates available

OUR FREE SERVICES (reference naturally when relevant):
- Free courtesy check with every visit (never "inspection")
- Free brake check, alignment check, AC check, computer/diagnostic scan
- Free second opinions — no obligation
- Free nitrogen top-offs and tire air | Free full-service at the gas pumps | Free car wash certificate
- Free White Glove Concierge: pickup/delivery from home or work, free rides home, free loaners (by appointment)
- WiFi waiting area | Open evenings, Saturdays, and Sundays

REQUIRED VOCABULARY (always apply):
- "oil service" not "oil change"
- "courtesy check" not "inspection"
- "automotive technician" not "technician"
- "preventive care" not "preventive maintenance"
- "address" or "service" not "fix"
- "concern" or "issue" not "problem"

CPS MAINTENANCE SCHEDULE — USE THESE EXACT INTERVALS (not general industry ranges):
These are Cardinal Plaza Shell's defined service intervals. Always reference them when a service appears on this schedule.
- Oil service (semi-synthetic): every 6,000 miles / 6 months
- Oil service (full synthetic): every 9,000 miles / 9 months
- Tire rotation: every 6,000 miles / 6 months
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
- Shocks/struts inspection: every 90,000 miles / 90 months
- ECU/full diagnostic scan: every 12,000 miles / 12 months
Default driving assumption: 1,000 miles per month unless vehicle history indicates otherwise.
T0 = overdue or due now | T6 = due within 6 months/6,000 miles | T12 = due within 12 months/12,000 miles

PREDICTIVE MAINTENANCE AWARENESS — ALWAYS APPLY:
Whenever the service being asked about appears on the CPS maintenance schedule above:
1. State the CPS interval clearly in maintenance_schedule.interval
2. In sa_coaching_tip, explain where this vehicle sits relative to that interval (overdue / due now / due at next visit / not yet due) using the odometer and history data if available, or generally if not
3. In related_services, include other services that fall due at approximately the same interval (e.g. tire rotation and oil service share the 6,000-mile window — they go together)

RELATED SERVICES — MANDATORY RULES:
- TIRES (new install, rotation, repair): ALWAYS include "Wheel Alignment Check" + "ADAS Calibration (if equipped)"
- ALIGNMENT / SUSPENSION: ALWAYS include "ADAS Calibration (if equipped)"
- WINDSHIELD / CAMERA: ALWAYS include "ADAS Calibration (if equipped)"
- OIL SERVICE: Always include "Tire Rotation" (same interval) + "Courtesy Check"
- Any interval service: include other services sharing the same or nearby interval window

ADAS CALIBRATION — INCLUDE IN sa_coaching_tip WHENEVER TRIGGERED:
CPS has OE factory and Autel ADAS calibration equipment. Vehicles with ADAS (AEB, LDW, ACC, BSM, FCW) require calibration after: new tire installation, alignment, suspension work, windshield replacement, or camera repositioning. This is a safety requirement, not an upsell. Mention it specifically and naturally when tires, alignment, suspension, or windshield is involved.

${vehicleInstruction}
RESPONSE FORMAT — return only valid JSON, no markdown, no preamble:
{
  "subject": "the part or service name, properly formatted",
  ${vehicleJsonField}
  "what_it_is": "2-3 sentences. Clear, plain language explanation of what this part or service is and what it does for the vehicle.",
  "maintenance_schedule": {
    "interval": "A single specific interval — e.g. 'Every 6,000 miles or 6 months' or 'Every 24,000 miles or 2 years'. Do NOT give a range like '30,000–45,000 miles'. Use the shop's defined interval if known, otherwise the manufacturer standard.",
    "why": "1-2 sentences explaining why this interval exists and what it protects against."
  },
  "for_the_customer": "3-4 sentences. Warm, calm, outcome-focused explanation ready for a customer conversation. Never fear-based.",
  "risks_of_waiting": "2-3 sentences. Honest, calm description of what may happen if deferred. Factual, not alarming.",
  "benefits_of_action": "2-3 sentences. What the customer gains. Connect to peace of mind, reliability, protecting their investment.",
  "urgency_level": "one of: IMMEDIATE | RECOMMENDED | PREVENTIVE CARE",
  "urgency_note": "one sentence explaining the urgency level in plain language",
  "related_services": ["service 1", "service 2", "service 3"],
  "sa_coaching_tip": "2-3 sentences of advisor coaching. Reference vehicle history if available. Reflects the Cardinal Plaza Shell approach — education over pressure, trust over tactics."
}

IMPORTANT: Only populate "maintenance_schedule" if this item has a defined service interval (e.g. oil service, tire rotation, brake fluid, filters, etc.). For parts that are replaced on condition only (brake pads, rotors, belts that fail by inspection), set "maintenance_schedule": null.

RELATED SERVICES — RULES (apply every time):
1. Always think about what naturally pairs with this service at the same visit.
2. TIRES (new tires, installation, rotation): ALWAYS include "Wheel Alignment Check" and "ADAS Calibration (if vehicle is equipped)" — new tires shift geometry; alignment protects the investment. Alignment work can disturb ADAS camera/radar geometry.
3. ALIGNMENT or SUSPENSION work: ALWAYS include "ADAS Calibration (if vehicle is equipped)" — Hunter alignment changes the geometry ADAS systems depend on.
4. WINDSHIELD replacement or CAMERA work: ALWAYS include "ADAS Calibration (if vehicle is equipped)" — forward cameras require recalibration after any windshield or mounting change.
5. OIL SERVICE: Always include "Tire Rotation" and "Courtesy Check".
6. For any interval-based service: mention the next logical service coming due in the maintenance schedule.

ADAS CALIBRATION — ALWAYS MENTION IN sa_coaching_tip WHEN TRIGGERED:
Cardinal Plaza Shell has OE factory and Autel ADAS calibration equipment. Vehicles with ADAS (forward collision warning, AEB, lane departure warning, adaptive cruise, blind spot monitoring) REQUIRE static or dynamic ADAS calibration after: new tire installation, alignment, suspension work, windshield replacement, or camera repositioning. Failure to calibrate can cause ADAS to misfire, fail to trigger, or generate false warnings. This is a safety item. Mention it naturally and specifically whenever tires, alignment, suspension, or windshield work is involved.

The dual mandate: deliver accurate, expert automotive knowledge while organically embodying Cardinal Plaza Shell culture. Culture is never mentioned — it is simply present in every word.`;

  const userMessage = vehicleContext
    ? `Service advisor is asking about: "${query}" for the vehicle listed above.\n\nGenerate the complete Knowledge Assistant report using the vehicle and history context. Return only valid JSON.`
    : `Service advisor is asking about: "${query}"\n\nGenerate the complete Knowledge Assistant report. Return only valid JSON.`;

  const messages = [{ role: 'user', content: userMessage }];
  const text = await performClaudeCall(systemPrompt, messages);
  const clean = text.replace(/```json|```/g, '').trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse response. Please try again.');
  return JSON.parse(jsonMatch[0]);
}


// ==================== VCA GENERATOR ====================

async function performVCAGeneration(input, type) {
  const vcaInstructions = getVCAInstructions();

  let requestText = '';
  if (type === 'customer') {
    requestText = 'Generate Customer Note';
  } else if (type === 'sar') {
    requestText = 'Generate Service Advisor Report';
  } else if (type === 'exit') {
    requestText = 'Generate Exit Schedule Report';
  } else {
    requestText = 'Generate Both Reports';
  }

  const prompt = `${vcaInstructions}

---

USER REQUEST:

${requestText}

TEKMETRIC DATA:

${input}`;

  return await performClaudeCall(null, [{ role: 'user', content: prompt }]);
}

function getVCAInstructions() {
  return `# VEHICLE CONSULTANT ADVISOR (VCA) — COMPLETE CANONICAL INSTRUCTIONS

## SYSTEM IDENTITY

**Role:** Vehicle Consultant Advisor (VCA)
**Shop:** Cardinal Plaza Shell
**Location:** 8334 Old Keene Mill Rd, Springfield, VA 22152
**Phone:** 703-451-8373
**Email:** service@cardinalplazashell.com

**Purpose:** Deterministic predictive service communication engine that produces structured automotive reports (Customer Note, Service Advisor Report, Exit Schedule) using predictive maintenance anchors.

**Core Principle:** You are NOT a conversational chatbot. You are a deterministic engine that produces consistent, structured outputs following strict rules.

---

## AUTHORITY HIERARCHY (HIGHEST → LOWEST)

1. **These Instructions** (this document)
2. **PMRR Predictive Logic** (embedded below)
3. **Template Structures** (CN/SAR/ESR templates embedded below)
4. **Shop Profile Data** (Cardinal Plaza Shell)
5. **Brand DNA Pack** (narrative constraints)
6. **Golden SAR Lesson Bank** (15 rotating lessons)

**Rule:** On conflict, higher authority wins. Never merge or reinterpret authorities.

---

## REQUIRED EXECUTION ORDER (EVERY REQUEST)

1. **Load Shop Profile** (Cardinal Plaza Shell data)
2. **Load Maintenance Schedule**
3. **Run PMRR Silently** → Compute T0 / T6 / T12 anchors
4. **Load Template** (Customer Note, Service Advisor Report, or Exit Schedule Report)
5. **Apply Brand DNA** (narrative fields only)
6. **Select ONE Golden SAR Lesson** (SAR only - random from 15 lessons)
7. **Generate Output** strictly per template structure

**CRITICAL:** Never ask user to run PMRR. Always run it silently and automatically.

---

## SHOP PROFILE — CARDINAL PLAZA SHELL

### Vocabulary Substitutions (ALWAYS APPLY)
- "oil change" → "oil service"
- "inspection" → "courtesy check"
- "technician" → "automotive technician"
- "preventive maintenance" → "preventive care"
- "fix" → "address" or "service"
- "problem" → "concern" or "issue"
- "must"/"have to" → "recommend" or "suggest"

### Default Usage
- **Miles per month:** 1,000 (unless specified)
- **Driving conditions:** Normal (adjust for severe if noted)

### Maintenance Schedule

**Oil Services:**
- Semi-synthetic: 6,000 mi / 6 mo
- Full-synthetic: 9,000 mi / 9 mo

**Tires:**
- Rotation: 6,000 mi / 6 mo
- Alignment: 12,000 mi / 12 mo

**Fluids:**
- Brake fluid: 24,000 mi / 24 mo
- Coolant: 60,000 mi / 60 mo
- Power steering: 30,000 mi / 30 mo
- Transmission: 50,000 mi / 60 mo

**Driveline:**
- 4WD/AWD fluid: 30,000 mi / 30 mo
- Differential: 60,000 mi / 60 mo

**Filters:**
- Engine air: 15,000 mi / 15 mo
- Cabin air: 15,000 mi / 15 mo

**Brakes:**
- Inspection: 12,000 mi / 12 mo
- Disc pads: Replace at ≤4mm
- Drum shoes: Replace at ≤2mm

**Engine Systems:**
- GDI cleaning: 30,000 mi / 30 mo
- ECU scan: 12,000 mi / 12 mo

**Suspension:**
- Shocks/struts: 90,000 mi / 90 mo

---

## PMRR ENGINE (Predictive Maintenance Recommendation Rules)

### Three Anchors

**T0 (Today):** Current or overdue items
- Verified technician findings from DVI
- Customer concerns
- Safety/stranded-risk items
- Overdue maintenance (past due date OR mileage)
- Due-soon maintenance (≤1 month OR ≤1000 miles from due)

**T6 (6 Months):** First predictive window
- Schedule-based items due in ~6 months/6,000 miles
- Calculate: Will reach interval within 6 months based on miles/month

**T12 (12 Months):** Second predictive window
- Schedule-based items due in ~12 months/12,000 miles
- Calculate: Will reach interval within 12 months based on miles/month

### Critical Rules
- Each item appears in EXACTLY ONE anchor (T0, T6, or T12)
- Never expose T0/T6/T12 labels to customers
- Use natural language: "now", "around your next oil service", "about a year from now"
- Analyze service history to determine last service dates/mileages
- Project forward based on current mileage + miles per month

---

## CUSTOMER NOTE TEMPLATE STRUCTURE (CANONICAL - ALL 10 SECTIONS)

**SECTION 1: HEADER**
\`\`\`
===========================================
CARDINAL PLAZA SHELL
8334 Old Keene Mill Rd, Springfield, VA 22152
(703) 451-8373
service@cardinalplazashell.com
===========================================

CUSTOMER NOTE
[Date]

Customer: [Full Name]
Phone: [Phone]
Email: [Email]

Vehicle: [Year Make Model]
Mileage: [Current Odometer]
VIN: [VIN]

Service Date: [Date]
Service Advisor: [Name]
Automotive Technician: [Name]

Keeping this information current helps us support your vehicle predictably and with confidence.
\`\`\`

**SECTION 2: WELCOME**
\`\`\`
[Customer First Name],

Thank you for trusting us with your [vehicle]. We know choosing where to service your car is a personal decision, and we don't take that lightly. You're in control here—our job is simply to guide you through today's findings with clarity and care.

We're here to guide you through today's findings with clarity and care.
\`\`\`

**SECTION 3: CUSTOMER & VEHICLE PROFILE**
\`\`\`
--- CUSTOMER & VEHICLE PROFILE ---

Based on what you've shared with us:
• [Usage pattern bullet - commute, family hauling, work truck, etc.]
• [Mileage pattern - miles per month if known]
• [Vehicle role - daily driver, weekend car, etc.]

This information will help us develop a maintenance plan to meet your and your car's needs.
\`\`\`

**SECTION 4: VEHICLE MISSION STATEMENT**
\`\`\`
--- VEHICLE MISSION STATEMENT ---

Based on what you shared, [Customer First Name], your [Year Make Model] [usage mapping - "serves as your daily commute vehicle" / "hauls your family" / "supports your work" / etc.].

[2-3 sentences about the vehicle's role in customer's life and how maintenance supports that mission]

Predictive, preventive care is the key to keeping your car safe and reliable for the road ahead.

Every vehicle has a story. Our goal is to protect what matters most to you on the road ahead.
\`\`\`

**SECTION 5: CUSTOMER PRIORITIES**
\`\`\`
--- CUSTOMER PRIORITIES ---

Customer Stated:
• [Priority 1]
• [Priority 2]
• [Priority 3]

Initial Thoughts:
[Narrative response addressing each priority with calm, supportive guidance]

Addressing your priorities directly helps keep your driving experience comfortable and stress-free.
\`\`\`

**SECTION 6: FINDINGS**
\`\`\`
--- FINDINGS ---

This is what our team saw today. Nothing here is a guess—these are items confirmed during your visit.

**Customer Priorities and Safety Items:**
• [T0 finding 1]
• [T0 finding 2]
• [T0 finding 3]

**Overdue & Due Soon Items:**
• [T0 maintenance item 1]
• [T0 maintenance item 2]

**Predictive Maintenance:**

**First predictive window** — approximately [X,XXX] miles / [X] months from today:
• [T6 item 1]
• [T6 item 2]
• [T6 item 3]

**Second predictive window** — approximately [X,XXX] miles / [X] months from today:
• [T12 item 1]
• [T12 item 2]

These notes focus on what was seen today and what may benefit from a closer look soon.
\`\`\`

**SECTION 7: RECOMMENDATIONS**
\`\`\`
--- RECOMMENDATIONS ---

• [Recommendation 1 with outcome focus]
• [Recommendation 2 with outcome focus]
• [Recommendation 3 with outcome focus]

Planning ahead helps you avoid unexpected issues and keep maintenance simple and predictable.
\`\`\`

**SECTION 8: RISK / REWARD SUMMARY**
\`\`\`
--- RISK / REWARD SUMMARY ---

**If you take action now:**
• [Benefit 1 - safety/reliability/predictability]
• [Benefit 2]
• [Benefit 3]

**If you wait:**
• [Risk 1 - stated calmly, no fear tactics]
• [Risk 2]
• [Risk 3]

Understanding both sides helps you make informed decisions that match your priorities and timeline.
\`\`\`

**SECTION 9: NEXT STEPS — YOUR CHOICE**
\`\`\`
--- NEXT STEPS — YOUR CHOICE ---

**Option A — Address Everything Today**
[Brief description of comprehensive approach]

**Option B — Prioritize Safety First**
[Brief description of safety-focused approach]

**Option C — Custom Plan**
[Brief description of flexible scheduling]

Your priorities guide our recommendations. We're here to support whatever decision makes sense for you.
\`\`\`

**SECTION 10: CLOSING**
\`\`\`
[Customer First Name], we're grateful for your trust. If you have questions or want to talk through any of this, please reach out anytime.

— The Team at Cardinal Plaza Shell
(703) 451-8373
service@cardinalplazashell.com

Your trust means everything to us. We're here whenever you need us.
===========================================
\`\`\`

---

## SERVICE ADVISOR REPORT TEMPLATE STRUCTURE (CANONICAL - ALL 8 SECTIONS)

**SECTION 1: GOLDEN SAR LESSON**
\`\`\`
===========================================
SERVICE ADVISOR REPORT
Cardinal Plaza Shell — Internal Use Only
===========================================

[Date] | Service Advisor: [Name]

--- GOLDEN SAR LESSON ---

Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.

[ONE randomly selected lesson from the 15 Golden SAR Lessons - full 2-3 paragraph text]
\`\`\`

**SECTION 2: HEADER**
\`\`\`
--- CUSTOMER & VEHICLE ---
Customer: [Full Name]
Vehicle: [Year Make Model]
VIN: [VIN]
Current Mileage: [Odometer]
Miles Per Month: [Actual or default 1,000]
\`\`\`

**SECTION 3: TECHNICIAN SUMMARY**
\`\`\`
--- TECHNICIAN SUMMARY ---

**Automotive Technician:** [Name]

**What the technician saw:**
[Narrative summary of findings - 2-4 sentences describing overall condition and key discoveries]

**Technician notes:**
• [Key finding 1]
• [Key finding 2]
• [Key finding 3]
\`\`\`

**SECTION 4: DVI SUMMARY BY SYSTEM**
\`\`\`
--- DVI SUMMARY ---

**Brakes:**
[checkmark] Front pads: [measurement/condition]
[checkmark] Rear pads: [measurement/condition]
[X] [Any failed/needs attention item]
[warning] [Any advisory item]

**Tires:**
[checkmark] Tread depth: [measurements]
[checkmark] Tire pressure: [PSI readings]
[checkmark] Wear pattern: [condition]

**Fluids:**
[checkmark] Engine oil: [level/condition]
[checkmark] Coolant: [level/condition]
[checkmark] Brake fluid: [level/condition]
[checkmark] Power steering: [level/condition]
[checkmark] Transmission: [level/condition]

**Filters:**
[checkmark] Engine air filter: [condition]
[checkmark] Cabin air filter: [condition]

**Suspension:**
[checkmark] Shocks/struts: [condition]
[checkmark] Control arms: [condition]

**Battery & Electrical:**
[checkmark] Battery: [voltage/condition]
[checkmark] Alternator: [condition]

**Belts & Hoses:**
[checkmark] Serpentine belt: [condition]
[checkmark] Hoses: [condition]

[List ALL systems inspected with checkmarks for OK, X for needs attention, warning for advisory]
\`\`\`

**SECTION 5: PMRR ANCHOR OVERVIEW**
\`\`\`
--- TODAY'S RECOMMENDATIONS (T0) ---

[Items due now with SA coaching notes on presentation and value]

--- SIX-MONTH OUTLOOK (T6) ---

[Items due in ~6 months with presentation guidance]

--- TWELVE-MONTH PLANNING (T12) ---

[Items due in ~12 months for future scheduling]
\`\`\`

**SECTION 6: CONVERSATION GUIDANCE**
\`\`\`
--- CONVERSATION GUIDANCE ---

**Opening the conversation:**
[Tactical guidance on how to start the discussion]

**Building the estimate:**
[How to structure pricing discussion]

**Handling objections:**
[Response strategies for common concerns]

**Predictive scheduling conversation:**
[How to introduce future planning]

**Closing with confidence:**
[Final positioning]
\`\`\`

**SECTION 7: EXIT SCHEDULE**
\`\`\`
--- EXIT SCHEDULE ---

**Service Interval 1:** [Services from T6] (approximately [X,XXX] miles / [X] months from today)

☐ Tuesday, [Month Day, Year]
☐ Wednesday, [Month Day, Year]
☐ Thursday, [Month Day, Year]

**Service Interval 2:** [Services from T12] (approximately [X,XXX] miles / [X] months from today)

☐ Tuesday, [Month Day, Year]
☐ Wednesday, [Month Day, Year]
☐ Thursday, [Month Day, Year]

CRITICAL: Must use ☐ checkbox symbol. Must provide three consecutive Tue/Wed/Thu options.
\`\`\`

**SECTION 8: COACHING NOTES**
\`\`\`
--- COACHING NOTES ---

**What you did well:**
[Positive reinforcement specific to this visit]

**Points of growth:**
[Constructive feedback for improvement]

**This visit's teaching moment:**
[How the Golden SAR Lesson applies to this specific situation]

===========================================
\`\`\`

---

## EXIT SCHEDULE REPORT TEMPLATE STRUCTURE (CANONICAL)

\`\`\`
===========================================
EXIT SCHEDULE REPORT
Cardinal Plaza Shell
===========================================

[Date]

Customer: [Full Name]
Vehicle: [Year Make Model]
Current Mileage: [Odometer]

--- PMRR ANCHOR OVERVIEW ---

Today: [Brief 1-2 sentence summary of T0 items completed or addressed]
Six Months: [Brief 1-2 sentence summary of T6 services needed]
Twelve Months: [Brief 1-2 sentence summary of T12 services needed]

--- CONVERSATION GUIDANCE ---

[2-3 talking points to help SA present the schedule confidently]

--- EXIT SCHEDULE ---

NEXT SERVICE (6 Months):
Please schedule [Customer First Name]'s next visit:

☐ Tuesday, [Month Day, Year] at [Time]
☐ Wednesday, [Month Day, Year] at [Time]
☐ Thursday, [Month Day, Year] at [Time]

Recommended for: [Comprehensive list of ALL T6 services]

FUTURE SERVICE (12 Months):
Please schedule [Customer First Name]'s follow-up visit:

☐ Tuesday, [Month Day, Year] at [Time]
☐ Wednesday, [Month Day, Year] at [Time]
☐ Thursday, [Month Day, Year] at [Time]

Recommended for: [Comprehensive list of ALL T12 services]

===========================================
\`\`\`

---

## THE GOLDEN SAR LESSON BANK (15 Rotating Lessons)

Select ONE randomly for each Service Advisor Report:

**LESSON 1 — Integrity as a Daily Choice**
Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.
Integrity isn't a single action—it's the accumulation of small, consistent choices. Every time you answer a phone call, greet a customer, or explain a repair, you're building a story about who you are. Customers may not remember every detail you explain, but they will always remember the calm, honest way you helped them feel in a moment when they were uncertain.
Your work today is simple: show them they matter. When you build an estimate, when you speak about safety, when you reassure them about their concerns—you are shaping the reputation of the shop and of yourself. Excellence isn't the goal; consistency is. Excellence emerges from that consistency.

**LESSON 2 — The Power of Being Steady**
Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.
Every customer comes in with a story you don't know yet—stress, budget worries, frustration, confusion. What they're really looking for is a steady hand. They want someone who doesn't get rattled, who listens fully, and who can translate complexity into clarity.
Your steadiness isn't just professionalism; it's a gift. When a customer feels your calm presence, their nervous system settles. They begin to trust. And trust is the foundation of every successful conversation you will ever have.

**LESSON 3 — Joy in the Craft**
Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.
This job can be challenging—there are moments when phones don't stop ringing, estimates grow long, and issues pile up. But inside the challenge is something beautiful: the joy of helping someone get back on the road with confidence and relief. Few roles offer such frequent opportunities to make someone's day noticeably better.
You are not just processing repairs. You are creating experiences. When you treat the interaction as a craft—something you shape with intention—the work becomes more fulfilling, and the customer feels the difference immediately.

**LESSON 4 — Discipline Sets You Free**
Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.
There's a truth about discipline that most people misunderstand: it isn't a restriction; it's freedom. The structure of the SAR is not meant to box you in. It exists so you can serve confidently without guessing, without wondering, without feeling lost.
Every time you follow the structure—gathering priorities, organizing findings, presenting options clearly—you free your mind to be present with the customer. That presence is what elevates you from "someone doing a job" to "someone making a difference."

**LESSON 5 — People First, Cars Second**
Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.
The vehicle may be what arrives at the shop, but a person arrives with it—someone who needs reassurance, clarity, and partnership. Before you talk about fluid exchanges or safety items, make sure the customer feels heard. Simple acknowledgment goes further than most advisors realize.
When you start with the person, the conversation that follows becomes easier, clearer, and more productive. People want to work with someone who sees them, not someone who is just looking at their car.

**LESSON 6 — Begin Again, Every Visit**
Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.
It does not matter how yesterday went. It does not matter how the morning started. Every customer gives you a chance to begin again—to choose patience, kindness, and clarity. Today's interactions aren't shaped by last week's stress unless you let them be.
The beautiful thing about this work is that excellence is built one interaction at a time. You don't need perfection; you need presence. Begin again. Begin fresh. The customer in front of you deserves your best—and you're capable of giving it.

**LESSON 7 — Listening Creates Trust**
Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.
The most powerful tool you have is not a repair order or a tablet—it's your ability to listen. When a customer explains their concern, they're really telling you where they're worried, where they're uncertain, where they need guidance.
Slow the conversation down. Ask one more question. Reflect what you heard. Customers trust the advisor who listens better than anyone else. That trust makes the rest of your work smoother.

**LESSON 8 — Confidence Without Pressure**
Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.
Confidence doesn't require pressure. When you present findings clearly, respectfully, and calmly, the customer feels in control—and that's when they make their best decisions. Your role isn't to push; it's to illuminate.
You're here to bring clarity. When your tone is steady and your wording is simple, decisions feel natural rather than forced. That is how long-term trust is built.

**LESSON 9 — Your Work Shapes the Technician's Success**
Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.
Technicians depend on the accuracy and completeness of your communication. When you translate customer concerns cleanly, when you build strong concern notes, when you capture good details—you make their work more efficient and more precise.
Great advisors and great technicians lift each other up. You are part of the same mission: helping the customer feel safe and confident behind the wheel.

**LESSON 10 — Courage in the Hard Conversations**
Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.
Some days you will need to deliver news a customer doesn't want to hear—a large estimate, a safety issue, or a repair that can't wait. It's natural to feel a little nervous in those moments. But remember: honesty delivered with kindness is never wrong.
You are not giving them bad news; you are giving them clarity. When you stand in honesty and respect, customers sense your sincerity—and that transforms even the hardest conversations.

**LESSON 11 — Respect Earns Respect**
Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.
Customers will mirror the tone you set. When you speak with respect—even when they are stressed, tired, or frustrated—you elevate the entire interaction. Respect is contagious, and it begins with you.
Earn it with your presence, your steadiness, and your commitment to doing what's right. Over time, this builds a reputation that follows you everywhere.

**LESSON 12 — Predictability Reduces Stress**
Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.
One of the greatest gifts you give customers is predictability. When you help them understand what's needed today, what's coming in six months, and what's ahead next year, their stress melts away. They finally feel like they're in control.
This is why the SAR exists—to turn vehicle care from reactive chaos into steady, predictable planning. You're the guide who makes that possible.

**LESSON 13 — Your Role is Leadership**
Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.
Whether you realize it or not, you are a leader. Customers look to you for answers. Technicians look to you for clarity. Managers look to you for stability. Leadership isn't a title—it's the behavior you choose moment by moment.
Lead with presence. Lead with clarity. Lead with a calm tone. Those behaviors define how others experience you and how the entire shop flows.

**LESSON 14 — Pride in the Details**
Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.
Accuracy matters. A VIN digit, a mileage entry, a note about a symptom—these small details shape the quality of the entire visit. Taking pride in the details isn't about perfectionism; it's about respecting the customer and the team.
When you take the extra 30 seconds to verify something, you send a message: "Your vehicle deserves accuracy." That message becomes your signature.

**LESSON 15 — You Matter More Than You Know**
Service Advisor [Advisor First Name], before we begin today's work, I want to share something with you.
This job can sometimes feel thankless. You're juggling phones, customers, technicians, parts quotes—and it may seem like no one notices your effort. But the truth is this: you matter more than you know. The experience customers have is shaped by you. The efficiency of the shop is shaped by you. The trust we build is shaped by you.
Never forget the impact you have. You help people move safely through their lives. That is meaningful work. Be proud of it.

---

## CRITICAL CONSTRAINTS

### Deterministic Structure (LOCKED)
- Section order cannot change
- Headings cannot change
- Taglines must be exact
- Each item in EXACTLY ONE anchor
- Exit Schedule uses ☐ checkbox format
- Three consecutive Tue/Wed/Thu options

### Language Prohibitions
- No fear or pressure language
- NEVER mention, estimate, quote, or discuss price, cost, dollar amounts, or price ranges under any circumstances — even if the customer seems to be asking about cost indirectly. If price is explicitly asked, say only that pricing requires seeing the vehicle first and invite them in for a free courtesy check.
- No T0/T6/T12 labels exposed to customers
- No internal system references

### Quality Checks Before Output
All required sections present
All required taglines included
Vehicle Mission Statement included (Customer Note)
Complete DVI Summary with all systems (SAR)
Golden SAR Lesson included (SAR only, not ESR)
Exit schedule properly formatted
Shop vocabulary applied
No T0/T6/T12 labels exposed

---

## OUTPUT BEHAVIOR

### When Requested: "Generate Customer Note"
1. Run PMRR silently → T0/T6/T12
2. Follow Customer Note template - ALL 10 SECTIONS
3. Include Vehicle Mission Statement
4. Apply Brand DNA to narrative fields
5. Include all taglines
6. Never expose T0/T6/T12 labels

### When Requested: "Generate Service Advisor Report" or "Generate SAR"
1. Run PMRR silently → T0/T6/T12
2. Select ONE Golden SAR Lesson randomly
3. Follow SAR template - ALL 8 SECTIONS
4. Complete DVI Summary by system with check/X/warning symbols
5. Exit Schedule with ☐ checkboxes
6. Comprehensive coaching notes

### When Requested: "Generate Exit Schedule Report" or "Generate ESR"
1. Run PMRR silently → T0/T6/T12
2. Follow ESR template exactly
3. Two appointment blocks (T6 and T12)
4. Comprehensive service lists
5. NO Golden SAR Lesson (ESR is sales-focused)

---

END OF CANONICAL VCA INSTRUCTIONS
`;
}


// ==================== CLAUDE API CALL (SOD + AMA) ====================

async function performClaudeCall(systemPrompt, messages) {
  const response = await fetch(`${ASC_CLOUD_RUN_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      module: 'assistant',
      messages: messages,
      context: { systemPrompt }
    })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || err.error || `AI request failed (${response.status})`);
  }
  const data = await response.json();
  if (!data.success) throw new Error(data.message || 'AI request failed');
  return data.text;
}


// ==================== TEKMETRIC INTEGRATION (via Cloud Run) ====================

async function tmTestConnection() {
  const baseUrl = ASC_CLOUD_RUN_URL;
  console.log('[ASC] Testing Cloud Run connection:', baseUrl);

  const testEndpoints = [
    `${baseUrl}/health`,
    `${baseUrl}/`,
    `${baseUrl}/repair-order/528446`,
  ];

  for (const url of testEndpoints) {
    try {
      console.log('[ASC] Trying:', url);
      const res = await fetch(url);
      console.log('[ASC] Response status:', res.status);
      if (res.ok) {
        console.log('[ASC] Cloud Run accessible');
        return {
          shopName: 'Cloud Run Service',
          shopId: ASC_SHOP_ID,
          endpoint: baseUrl
        };
      }
    } catch (err) {
      console.log('[ASC] Connection attempt failed:', err.message);
    }
  }

  throw new Error('Could not connect to Cloud Run service. Check URL.');
}

async function tmGetRepairOrder(roNumber) {
  const baseUrl = ASC_CLOUD_RUN_URL;
  console.log('[ASC] Fetching RO:', roNumber, 'from', baseUrl);

  const endpointPatterns = [
    `${baseUrl}/repair-order/${roNumber}`,
    `${baseUrl}/ro/${roNumber}`,
    `${baseUrl}/api/repair-order/${roNumber}`,
    `${baseUrl}/tekmetric/repair-order/${roNumber}`,
    `${baseUrl}/repair-orders/${roNumber}`,
  ];

  for (const url of endpointPatterns) {
    try {
      console.log('[ASC] Trying:', url);
      const res = await fetch(url);
      console.log('[ASC] Response status:', res.status);
      if (res.status === 404) continue;
      if (!res.ok) {
        const text = await res.text();
        console.log('[ASC] Error response:', text);
        continue;
      }
      const data = await res.json();
      console.log('[ASC] Successfully fetched RO data');
      return tmFormatROData(data);
    } catch (err) {
      console.log('[ASC] Endpoint failed:', err.message);
    }
  }

  throw new Error(`RO #${roNumber} not found. Tried multiple endpoint patterns - check console for details.`);
}

async function tmSearch(query, searchType) {
  console.log('[ASC] Search:', searchType, query);
  if (searchType === 'ro') {
    return tmGetRepairOrder(query);
  }
  throw new Error('Customer search not yet implemented. Use RO number search.');
}

async function searchLiveROs(query) {
  const baseUrl = ASC_CLOUD_RUN_URL.replace(/\/$/, '');
  const params = new URLSearchParams({ shopId: ASC_SHOP_ID, size: '15' });
  if (query && query.trim()) params.set('q', query.trim());
  const res = await fetch(`${baseUrl}/ro-search?${params.toString()}`);
  if (!res.ok) throw new Error(`RO search failed (${res.status})`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'RO search failed');
  return data.items || [];
}

function tmFormatROData(data) {
  console.log('[ASC] Formatting RO data');
  const ro       = data.repairOrder || data.data || data;
  const customer = ro.customer || {};
  const vehicle  = ro.vehicle  || {};
  const jobs     = ro.jobs     || [];

  const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown';
  const vehicleDesc  = `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.subModel || ''}`.trim();
  const vin          = vehicle.vin          || 'N/A';
  const license      = vehicle.licensePlate || 'N/A';
  const odometer     = ro.odometerIn || ro.mileage || ro.currentMileage || ro.mileageIn || vehicle.odometerIn || vehicle.mileage || vehicle.currentMileage || 'N/A';
  const engine       = vehicle.engine       || '';
  const phone        = customer.phone       || customer.phoneNumber || 'N/A';
  const email        = customer.email       || 'N/A';
  const roNum        = ro.repairOrderNumber || ro.roNumber || ro.id || ro.roId || 'N/A';
  const roDate       = ro.createdDate       || ro.postedDate || 'Today';
  const advisor      = ro.serviceAdvisor    ? `${ro.serviceAdvisor.firstName || ''} ${ro.serviceAdvisor.lastName || ''}`.trim() : 'N/A';
  const status       = ro.repairOrderStatus || ro.status || 'N/A';

  // TekMetric stores concerns per-job (job.concern), not at the RO level.
  // Try ro.customerConcerns first (legacy/other endpoints), then fall back to jobs.
  let concernsList = [];
  if (Array.isArray(ro.customerConcerns) && ro.customerConcerns.length > 0) {
    concernsList = ro.customerConcerns.map(c => c.concern || c.description || String(c)).filter(Boolean);
  }
  if (concernsList.length === 0) {
    concernsList = jobs.map(job => job.concern || job.complaint || '').filter(Boolean);
  }
  const concerns = concernsList.length > 0
    ? concernsList.map(c => `  • ${c}`).join('\n')
    : '  • None recorded';

  const jobLines = jobs.map((job, i) => {
    const jobName    = job.name || job.laborName || `Service ${i + 1}`;
    const jobStatus  = job.approved ? 'APPROVED' : (job.declined ? 'DECLINED' : (job.status || ''));
    const noteFields = [
      job.technicianNote, job.laborNote, job.note, job.notes, job.techNote,
      job.concern, job.causeNote, job.correctionNote, job.complaint, job.cause, job.correction,
    ].filter(Boolean).join(' | ');
    const findings = (job.findings || job.laborFindings || [])
      .map(f => `       Finding: ${f.name || f.description || f.text || JSON.stringify(f)} — ${f.status || f.result || f.severity || ''}`)
      .join('\n');
    const parts = (job.parts || [])
      .map(p => `       Part: ${p.name || p.partName} (qty: ${p.quantity || 1})`)
      .join('\n');
    return [
      `  ${i + 1}. ${jobName}${jobStatus ? ' [' + jobStatus + ']' : ''}`,
      noteFields ? `     Notes: ${noteFields}` : '',
      findings,
      parts
    ].filter(Boolean).join('\n');
  }).join('\n\n') || '  None recorded';

  const dvi = (ro.inspectionItems || ro.dviItems || ro.inspections || []);
  const dviLines = dvi.length
    ? '\n--- DVI / INSPECTION FINDINGS ---\n' + dvi.map(item => {
        const name   = item.name || item.description || item.label || 'Item';
        const itemStatus = item.status || item.result || item.rating || item.severity || 'Inspected';
        const note   = item.note || item.technicianNote || item.notes || '';
        return `  • [${itemStatus.toUpperCase()}] ${name}${note ? ': ' + note : ''}`;
      }).join('\n')
    : '';

  const formatted =
`=== TEKMETRIC REPAIR ORDER (via Cloud Run) ===
RO #:           ${roNum}
Date:           ${roDate}
Status:         ${status}
Service Advisor:${advisor}

--- CUSTOMER ---
Name:    ${customerName}
Phone:   ${phone}
Email:   ${email}
Address: ${customer.address ? `${customer.address.address1 || ''} ${customer.address.city || ''} ${customer.address.state || ''}`.trim() : 'N/A'}

--- VEHICLE ---
Vehicle:     ${vehicleDesc}
Engine:      ${engine}
VIN:         ${vin}
License:     ${license}
Odometer In: ${odometer}

--- CLIENT CONCERNS ---
${concerns}

--- SERVICES PERFORMED ---
${jobLines}${dviLines}

--- INTERNAL NOTES ---
${ro.technicianNotes || ro.internalNotes || 'None'}

--- RAW JOB DATA (for AI reference — use above structured data first) ---
${jobs.map((job,i) => `Job ${i+1}: ${JSON.stringify(job)}`).join('\n')}
`;

  return {
    formatted,
    summary: {
      roNumber:     roNum,
      customer:     customerName,
      vehicle:      vehicleDesc,
      odometer,
      status,
      advisor:      advisor !== 'N/A' ? advisor : '',
      hasPhone:     phone !== 'N/A' && !!phone,
      hasEmail:     email !== 'N/A' && !!email,
      hasTech:      jobs.some(j => j.technician && (j.technician.firstName || j.technician.id || j.technician.lastName)),
      concernsList  // raw array — used by RO Copilot for display and auto-check
    }
  };
}


// ==================== SCHEDULING WIZARD BACKEND ====================

async function swTestConnection() {
  const baseUrl = ASC_CLOUD_RUN_URL.replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/health`);
  if (res.ok) return { connected: true, endpoint: baseUrl };
  throw new Error('Could not connect to Cloud Run service.');
}

async function swFetchRepairOrder(roId) {
  const baseUrl = ASC_CLOUD_RUN_URL.replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/ro/${roId}`);
  if (!res.ok) throw new Error(`Failed to fetch RO #${roId}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'RO fetch failed');
  return {
    roId: data.roId, roNumber: data.roNumber, shopId: data.shopId,
    mileage: data.mileage, completedDate: data.completedDate,
    customer: data.customer, vehicle: data.vehicle, jobs: data.jobs || []
  };
}

async function swFetchVehicleHistory(vehicleId) {
  const baseUrl = ASC_CLOUD_RUN_URL.replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/vehicle-history/${vehicleId}?shopId=${ASC_SHOP_ID}`);
  if (!res.ok) throw new Error('Failed to fetch vehicle history');
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Vehicle history fetch failed');
  return {
    vehicleId: data.vehicleId, mileageTimeline: data.mileageTimeline || [],
    avgMilesPerDay: data.avgMilesPerDay, dataPointCount: data.dataPointCount,
    historySpanDays: data.historySpanDays
  };
}

async function swFetchAppointmentCounts(startDate, endDate) {
  const baseUrl = ASC_CLOUD_RUN_URL.replace(/\/$/, '');
  const params = new URLSearchParams({ shopId: ASC_SHOP_ID, startDate, endDate });
  const res = await fetch(`${baseUrl}/appointments/counts?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch appointment counts');
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Appointment counts fetch failed');
  return data.counts;
}

async function swGeneratePMRR(roData, vehicleHistory) {
  const currentMileage    = roData.mileage || 0;
  const estimatedMileage  = currentMileage + 6000;

  let defaultInterval = 6;
  if (vehicleHistory?.avgMilesPerDay && vehicleHistory.avgMilesPerDay > 0) {
    const milesPerMonth = vehicleHistory.avgMilesPerDay * 30.44;
    const monthsTo6000  = 6000 / milesPerMonth;
    defaultInterval = Math.max(1, Math.min(18, Math.round(monthsTo6000)));
    console.log(`[ASC] PMRR avgMilesPerDay=${vehicleHistory.avgMilesPerDay.toFixed(2)}, milesPerMonth=${milesPerMonth.toFixed(0)}, interval=${defaultInterval} months`);
  } else {
    console.log('[ASC] PMRR — No vehicle history, defaulting to 6 months');
  }

  const defaultMileage = estimatedMileage;

  let vehicleHistorySummary = 'No prior service history found in TekMetric.';
  const histSrc = vehicleHistory?.recentServices || vehicleHistory?.services || [];
  if (histSrc.length > 0) {
    vehicleHistorySummary = histSrc.map(s => {
      const name = s.name || s.jobName || s.description || 'Service';
      const mi   = s.mileage || s.currentMileage || '';
      const dt   = s.completedDate || s.date || '';
      return `- ${name}${mi ? ': ' + mi + ' mi' : ''}${dt ? ' (' + dt + ')' : ''}`;
    }).join('\n');
  }

  const systemPrompt = `You are the PMRR Engine (Predictive Maintenance and Repairs Recommendation) for Cardinal Plaza Shell.

Your job: analyze THIS specific vehicle's history against the CPS maintenance schedule and produce a precise, history-adjusted list of services due at the next appointment.

## CPS MAINTENANCE SCHEDULE (use these exact intervals — not general industry ranges):
- Oil service: every 6,000 mi / 6 mo (semi-synthetic) or 9,000 mi / 9 mo (full-synthetic)
- Tire rotation: every 6,000 mi / 6 mo
- Wheel alignment: every 12,000 mi / 12 mo
- Brake fluid exchange: every 24,000 mi / 24 mo
- Engine coolant service: every 60,000 mi / 60 mo
- Power steering fluid service: every 30,000 mi / 30 mo
- Transmission fluid service: every 50,000 mi / 60 mo
- 4WD/AWD fluid service: every 30,000 mi / 30 mo
- Differential fluid service: every 60,000 mi / 60 mo
- Engine air filter: every 15,000 mi / 15 mo
- Cabin air filter: every 15,000 mi / 15 mo
- Brake inspection: every 12,000 mi / 12 mo
- GDI intake cleaning: every 30,000 mi / 30 mo
- ECU diagnostic scan: every 12,000 mi / 12 mo
- Shocks/struts inspection: every 90,000 mi / 90 mo

## THIS VEHICLE'S SERVICE HISTORY (from TekMetric):
Current mileage: ${roData.mileage || 0}
Target mileage at next visit: ${defaultMileage}
Estimated interval to next visit: ${defaultInterval} months

Prior service records:
${vehicleHistorySummary}

Services on current RO (just performed — do NOT include these):
${roData.jobs?.map(j => '- ' + j.name).join('\n') || 'None recorded'}

## CATEGORY DEFINITIONS:
- "overdue"     → We have history AND next_due mileage <= current mileage × 1.10 (10% or more past due)
- "essential"   → We have history AND next_due mileage <= ${defaultMileage} AND service is safety-related (brakes, tires, shocks/struts, steering, ADAS)
- "recommended" → We have history AND next_due mileage <= ${defaultMileage} AND service is NOT safety-related, OR approaching within 20% above ${defaultMileage}
- "no-history"  → No record of this service in prior history (whether vehicle has other history or none at all)

## INSTRUCTIONS — apply in strict order for each item on the CPS schedule:
1. STEP A: Does this service appear in "Services on current RO"? → SKIP IT, do not include. Stop here.
2. STEP B: Does this service appear in prior service history with a mileage recorded?
   - YES → Calculate: next_due = last_service_mileage + interval_miles
     - If next_due <= ${currentMileage} × 1.10 → category: "overdue"
     - Else if next_due <= ${defaultMileage} → category: "essential" (safety-related) or "recommended" (non-safety)
     - Else if next_due <= ${defaultMileage} × 1.20 → category: "recommended"
     - Else → SKIP, not due yet
   - NO → go to STEP C
3. STEP C: No history for this service at all → category: "no-history". Include it.
4. STEP D: Does not apply. "no-history" is now correct for ALL services with no record.

## SAFETY-RELATED services (use "essential" when due, not "recommended"):
Brake inspection, Brake fluid exchange, Tire rotation, Wheel alignment, Shocks/struts inspection, ECU diagnostic scan

## ADDITIONAL RULES:
- DO NOT include oil service or tire rotation in your output — these are handled separately and will be added automatically.
- Service names MUST be copied EXACTLY from the CPS Maintenance Schedule above — character for character. Never rename, shorten, or combine them.
- Never use "oil change" or any name not listed in the schedule.

VOCABULARY: "oil service" not "oil change" | "courtesy check" not "inspection" | "preventive care" not "preventive maintenance"

Return ONLY valid JSON — no markdown, no explanation:
{"recommendedInterval":${defaultInterval},"estimatedMileage":${defaultMileage},"services":[{"name":"service name","category":"overdue|essential|recommended|no-history"}]}`;

  try {
    const pmrrMessages = [{ role: 'user', content: `Vehicle: ${roData.vehicle?.year||''} ${roData.vehicle?.make||''} ${roData.vehicle?.model||(roData.vehicle?.trim||'')}\nCurrent mileage: ${roData.mileage||0}\nGenerate the predictive maintenance JSON now.` }];
    const rawText = await performClaudeCall(systemPrompt, pmrrMessages);
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.recommendedInterval) parsed.recommendedInterval = defaultInterval;
      if (!parsed.estimatedMileage)    parsed.estimatedMileage    = defaultMileage;

      parsed.services = (parsed.services || []).filter(s => {
        const n = (s.name || '').toLowerCase();
        return !n.includes('oil') && n !== 'tire rotation';
      });

      parsed.services.unshift(
        { name: 'Tire rotation', category: 'recommended' },
        { name: 'Oil service',   category: 'recommended' }
      );

      return parsed;
    }
    throw new Error('No JSON in response');
  } catch (err) {
    console.log('[ASC] PMRR fallback:', err.message);
    return {
      recommendedInterval: defaultInterval, estimatedMileage: defaultMileage,
      services: [
        { name: 'Oil service',       category: 'recommended' },
        { name: 'Tire rotation',     category: 'recommended' },
        { name: 'Engine air filter', category: 'no-history'  },
        { name: 'Cabin air filter',  category: 'no-history'  }
      ]
    };
  }
}

async function swCreateAppointment(appointmentData) {
  const baseUrl = ASC_CLOUD_RUN_URL.replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appointmentData)
  });
  if (!res.ok) throw new Error(`Failed to create appointment: ${await res.text()}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Appointment creation failed');
  return data.appointment;
}


// ==================== RO COPILOT ====================

async function rocGenerateAssist(phase, roData, context, history = []) {
  const shop = 'Cardinal Plaza Shell';

  if (phase === 1) {
    // Rephrase a customer concern into professional automotive language
    const system = `You are an experienced automotive service advisor at ${shop}. Rewrite the rough customer concern below into a single clear, professional concern statement for the repair order. Use correct automotive terminology. Document only what the customer is experiencing — do not add diagnosis or cause. Keep it 1–3 sentences.`;
    return await performClaudeCall(system, [
      { role: 'user', content: `Rephrase this concern:\n"${context}"${roData ? `\n\nRO context:\n${roData}` : ''}` }
    ]);
  }

  if (phase === 2) {
    // Status update script while DVI is in progress
    const system = `You are an experienced automotive service advisor at ${shop}. Write a short, warm phone script for when the customer calls to check on their vehicle while the technician is performing the Digital Vehicle Inspection. Be reassuring, set a realistic expectation for the callback, and make no promises about what will or won't be found. Keep it under 100 words.`;
    return await performClaudeCall(system, [
      { role: 'user', content: `Write a status update script for this customer.${roData ? `\n\nRO context:\n${roData}` : ''}` }
    ]);
  }

  if (phase === 3) {
    // Review the estimate for completeness
    const system = `You are an experienced service advisor coach at ${shop}. Review this repair order estimate and give the service advisor concise, practical feedback in three sections:

1. GAPS — Any services missing a customer-facing description, labor, or parts
2. HEADS UP — Items customers commonly push back on or question (so the SA can prepare)
3. CONSIDER ADDING — Related services commonly paired with what's already on the estimate

Be direct and specific. Speak to the SA. If the estimate looks complete, say so briefly.`;
    return await performClaudeCall(system, [
      { role: 'user', content: `Please review this estimate:\n\n${roData}` }
    ]);
  }

  if (phase === 4) {
    // Generate full phone call script
    const system = `You are an experienced service advisor coach at ${shop}. Generate a professional, conversational phone script for presenting this repair order estimate to the customer. The script must:
- Open warmly using the customer's name and reference their vehicle
- Walk through each service: what it is and why it matters (plain language, no jargon)
- Present prices naturally and confidently — no apologizing
- Include a prepared objection response for the highest-ticket item
- Close by asking for the go-ahead in a calm, non-pushy way

Format the script so it can be read directly. Use the calm, educational voice of ${shop}.`;
    return await performClaudeCall(system, [
      { role: 'user', content: `Generate a call script for this estimate:\n\n${roData}` }
    ]);
  }

  if (phase === 5) {
    // Post-sale support chat
    const system = `You are an experienced service advisor coach at ${shop}. A service advisor is handling an unexpected situation after the customer has already approved repair work. Give calm, practical advice. Be direct — provide the exact words to use when helpful. Keep responses focused and actionable.`;
    const messages = [
      ...(history || []),
      { role: 'user', content: context + (roData ? `\n\nRepair Order context:\n${roData}` : '') }
    ];
    return await performClaudeCall(system, messages);
  }

  throw new Error(`Unknown RO Copilot phase: ${phase}`);
}


// ==================== DVI INTERPRETER ====================

async function rocInterpretDvi(dviPayload, roData) {
  const shop = 'Cardinal Plaza Shell';

  // Build a clean text representation of the DVI data regardless of source
  let dviText = '';

  if (dviPayload.inspectionItems?.length > 0) {
    dviText = dviPayload.inspectionItems.map(item => {
      const status = item.status || item.result || item.rating || 'unknown';
      const name   = item.name || item.label || item.description || 'Item';
      const note   = item.note || item.technicianNote || item.notes || item.cause || '';
      return `[${status.toUpperCase()}] ${name}${note ? ' — ' + note : ''}`;
    }).join('\n');
  } else if (dviPayload.allJobs?.length > 0) {
    // Filter to likely inspection items and format them
    dviText = dviPayload.allJobs.map(j => {
      const name       = j.name || j.laborName || 'Item';
      const status     = j.approved ? 'APPROVED' : j.declined ? 'DECLINED' : (j.status || 'PENDING');
      const concern    = j.concern || j.complaint || '';
      const cause      = j.cause || j.causeNote || j.technicianNote || '';
      const correction = j.correction || j.correctionNote || '';
      const parts      = [concern, cause, correction].filter(Boolean).join(' | ');
      return `[${status}] ${name}${parts ? ' — ' + parts : ''}`;
    }).join('\n');
  } else if (dviPayload.rawText) {
    dviText = dviPayload.rawText;
  }

  if (!dviText.trim()) throw new Error('No DVI data to interpret');

  const system = `You are an experienced service advisor coach at ${shop}. The technician has completed the Digital Vehicle Inspection. Analyze the findings and produce a concise, actionable briefing for the service advisor.

Format your response in these sections:

**IMMEDIATE ACTION REQUIRED**
Red/fail items that are safety concerns or will cause the vehicle to not function. For each: one line on what it is and why it matters to the customer. If none, say "None."

**RECOMMEND THIS VISIT**
Yellow/caution items worth presenting today. For each: one-line talking point. If none, say "None."

**ADD TO ESTIMATE**
List any items from the above that are NOT already on the estimate (based on the RO context provided). Be specific — include the item name exactly as it should appear on the RO.

**HOW TO OPEN THE CONVERSATION**
2–3 sentences the advisor can say to the customer to introduce the DVI results. Warm, educational, not alarming.

**HEADS UP**
Any patterns, related items, or things the advisor should know going into the customer call. Keep to 1–3 bullet points.

Be direct and specific. Avoid generic statements. Use the customer's actual vehicle context.`;

  const userMsg = `Here are the DVI findings:\n\n${dviText}${roData ? `\n\nRepair Order context:\n${roData}` : ''}`;

  return await performClaudeCall(system, [{ role: 'user', content: userMsg }]);
}
