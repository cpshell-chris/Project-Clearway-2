# RO Copilot Redesign — Design Spec
**Date:** 2026-03-18
**Project:** Auto Shop Copilot (Chrome Extension + Cloud Run)
**Status:** Approved

---

## Overview

A wholesale redesign of the RO Copilot feature. The current system has 5 loosely-connected phases triggered manually. The new design is a structured 4-step workflow — named after the automotive engine cycle — that is simpler, more automated, and turns the service advisor into a more effective salesperson by surfacing the right intelligence at the right moment.

The four steps are: **Intake → Compression → Combustion → Exhaust.**

---

## Core Design Decisions

### Navigation Model
- **Hybrid auto-detect + manual navigation.** The copilot auto-detects the RO by watching for TekMetric URL patterns matching `/repair-orders/\d+` (with or without a trailing subpath). Because TekMetric is a React SPA and navigates without full page reloads, detection uses the existing `MutationObserver`/`setInterval` loop in `content.js` — the same mechanism already used for the payment and inspection button injections. When a matching URL is detected, a message is sent to the sidebar to auto-launch Intake.
- The advisor advances through steps using a large full-width button at the bottom of each screen.
- A **persistent step rail** in the header shows all four steps with live status (Active / Done / Waiting). Any step pill is tappable to jump directly to that step at any time — regardless of current step or direction.
- A **back arrow** (top left) and **X close** (top right) are always present in the header. The **back arrow** navigates to the previous step within the 4-step flow. From Step 1 (Intake), it returns to the main tool hub (exiting the RO Copilot flow). The **X close** always exits the RO Copilot flow entirely and returns to the tool hub; it does not discard session state — the RO remains resumable.

### Visual Style
- Matches existing app: SF Pro font stack, `#FFFBF8` warm white background, `linear-gradient(135deg, #9A3412, #EA580C, #F97316)` orange header, `#FED7AA` borders, `#FFF7ED` card backgrounds.
- No emojis. Minimalist, Apple-ready.
- Sections within each step are separated by subtle flow dividers (thin line + dot).
- All collapsible sections use a right-pointing chevron that rotates 90° when open. Hover state on collapsible headers: `#FFEDD5`.

---

## Step 1 — Intake

**Trigger:** Auto-loads when `content.js` detects a TekMetric URL matching `/repair-orders/\d+`. RO data is fetched immediately via the existing `GET /repair-order/:id` Cloud Run endpoint.

**Purpose:** Verify the RO has everything it needs before the tech begins the inspection. Nothing gets missed at the start.

### UI
- **Verify checklist** — a live list of required fields, each with a green check or yellow warning indicator:
  - Customer concern (at least one documented on any job)
  - Phone number — with inline Call / Text preference selector (tappable to toggle)
  - Address on file
  - Technician assigned to all jobs
- Yellow warning rows are tappable to resolve inline where possible (e.g. entering a missing phone number).
- **Full-width primary button:** "Intake Complete — Move to Compression"

### TekMetric Integration
- Read: customer info (name, phone, email, address), vehicle info, jobs (name, technician assignment), concern text — via `GET /api/v1/repair-orders/{id}` and `GET /api/v1/customers/{id}` through Cloud Run.
- **Write-back is not available.** The TekMetric public API is confirmed read-only — no POST or PATCH endpoints are exposed. Advisors must resolve any gaps (missing phone, unassigned tech) manually in TekMetric. The UI shows what is missing; it cannot fix it automatically.

---

## Step 2 — Compression

**Trigger:** Advisor taps "Intake Complete." Step rail advances to Compression.

**Purpose:** Guide the tech toward a thorough, customer-centric DVI. Then import and interpret the completed DVI data when ready.

### UI
- **DVI Checklist card** — a list of items the tech should document before submitting, with photo requirements flagged per item:
  - Brakes & Rotors — photo required
  - Tires (all 4 corners) — photo required
  - Fluids — color and level
  - Filters (engine + cabin) — photo if dirty
  - (list is defined in the shop's culture profile in `cultureProfiles.js` — each entry specifies `{ name, photoRequired: true|false|'if-dirty', note }` — not hardcoded)
- A note: *"When the tech submits the DVI, tap below to import all findings and move to Combustion."*
- **Full-width primary button:** "DVI Complete — Import & Continue"

### DVI Data Acquisition
TekMetric does not expose inspection data via public API. Data is acquired through a two-layer approach:

**Primary — Fetch Interception:** `page-fetch-interceptor.js` already intercepts TekMetric's own XHR/fetch network calls. If a DVI-related response is intercepted (identifiable by response shape containing inspection items), it is captured and stored in session state automatically. The advisor tapping "DVI Complete" will use this already-captured data if available.

**Fallback — DOM Scrape:** If fetch interception has not captured DVI data by the time the advisor taps the button, `content.js` performs a DOM scrape of the visible TekMetric inspection page — traversing inspection item rows to extract item name, status (red/yellow/green), technician notes, and photo presence. The exact CSS selectors are to be mapped against the live app during implementation (see Open Question #2).

**Injected Button:** A **"DVI Ready"** button is injected into the TekMetric inspection page by `content.js` (styled to match the existing Appointment Copilot button on the payment page). Tapping it sends a message to the sidebar to trigger the same "DVI Complete" flow — useful when the advisor is viewing the inspection tab rather than the sidebar. The sidebar button and the injected page button are equivalent triggers.

### DVI Interpretation (Claude)
Scraped DVI data is sent to `POST /ro-copilot/interpret-dvi` on Cloud Run. Claude processes it using a custom system prompt and returns four structured sections as JSON:
1. **Findings Overview** — 2–3 sentence factual summary of all findings. No sales language, no pressure. Facts only.
2. **Technical Detail** — industry-standard terminology for each finding; gives the advisor confidence and vocabulary.
3. **Call Script** — how to open the customer call based on this specific DVI. Warm and educational.
4. **Services Checklist** — every service that should be on the RO as a result of the DVI, cross-referenced against current RO jobs (`on-ro` | `missing`).

These four sections are stored in `dviIntelligence` in session state and displayed in Combustion.

---

## Step 3 — Combustion

**Trigger:** DVI interpretation completes successfully. Advisor is presented with the full RO intelligence package.

**Purpose:** The "magic" step. Ensure the RO is complete, arm the advisor with everything they need to make the sale confidently, and then execute.

### UI

#### RO Readiness Gauge
A percentage gauge with a gradient fill bar. The score is **informational only** — it does not gate the "Sale Complete" button. The advisor can always advance regardless of score.

**Scoring formula (each factor is equally weighted at 25%):**
- DVI interpreted and loaded — 25 pts
- All DVI services reconciled on RO (no "missing" items in the checklist) — 25 pts
- Customer concern documented on all jobs — 25 pts
- All jobs have a technician assigned — 25 pts

Status indicators below the bar reflect each factor (green dot = met, amber dot = not met).

#### RO Intelligence — 4 Collapsible Sections
All four DVI intelligence sections are presented as tappable, collapsible cards with a visible chevron. Default state: all collapsed on first open so the advisor is not overwhelmed. The advisor expands what they need.

1. **Findings Overview** — facts-only summary
2. **Technical Detail** — advisor reference for sounding knowledgeable
3. **How to Open the Call** — ready-to-use script opener
4. **Services on RO** — checklist with On RO / Add to RO status per item

**"Add to RO" items:** Each item marked `missing` shows a tappable row. Because the TekMetric public API is read-only, tapping an "Add to RO" row does not write to TekMetric — it instead copies the service name to clipboard and shows a brief inline note: *"Add this manually in TekMetric."* The advisor adds it in the TekMetric window, then returns to the sidebar. The checklist item remains highlighted as a reminder until the advisor dismisses it manually.

#### Advisor Quick Actions
Two chip buttons below the intelligence sections:
- **Part Lookup** — advisor types a part/system name; Claude returns a plain-language explanation of what it does and why it fails
- **Objection Help** — advisor describes a customer objection; Claude returns a calm, specific response grounded in the shop's culture profile

#### Advance
- **Full-width primary button:** "Sale Complete — Move to Exhaust"

---

## Step 4 — Exhaust

**Trigger:** Advisor taps "Sale Complete." The RO has been presented and approved (fully or partially).

**Purpose:** Handle everything that happens after the sale — supplement items, delays, objections, and pickup.

### UI

#### Prior Step Summary
Three mini-cards summarizing completed steps. Values are derived from session state:
- **Intake** — always shows "Complete"
- **Compression** — shows count of DVI findings (e.g. "4 items") derived from `dviRaw` item count; falls back to "Complete" if count unavailable
- **Combustion** — shows "Sold" if advisor advanced via "Sale Complete"; if the advisor jumped to Exhaust manually via the step rail, shows "In Progress"

#### Situation Chips
Four quick-action chips for the most common post-sale scenarios. Each chip opens a Claude-powered response panel with full RO context loaded:
- **Supplement Item** — advisor describes the unexpected item; generates a supplement call script including objection prep for "but I already approved $X"
- **Delay Follow-up** — generates a call/text script for notifying the customer the vehicle won't be ready on time
- **Post-sale Objection** — advisor describes the objection; Claude returns coaching on how to respond
- **Ready for Pickup** — generates the pickup notification call or text

#### Coaching Chat
A free-form open text input below the chips. The advisor can describe any situation and receive a coached response. Full RO context (customer, vehicle, all jobs, DVI findings) is injected into the Claude system prompt. Conversation history is stored in `exhaustHistory` in session state for multi-turn coherence.

---

## Data & State Architecture

### Session State
Stored in `chrome.storage.session` (tab-scoped, clears on browser restart), keyed per RO as `asc_roc_${roNumber}`. This prevents cross-tab contamination when multiple ROs are open simultaneously.

```
{
  roNumber,
  currentStep,            // 'intake' | 'compression' | 'combustion' | 'exhaust'
  roData,                 // formatted TekMetric API response
  intakeVerification: {
    concern,              // boolean
    phone,                // boolean
    contactPref,          // 'call' | 'text' | null
    address,              // boolean
    techAssigned          // boolean
  },
  dviRaw,                 // scraped/intercepted DVI item array
  dviIntelligence: {
    summary,              // string — 2-3 sentence overview
    technicalDetail,      // array of { item, detail }
    callScript,           // string — opening script
    serviceChecklist      // array of { name, status: 'on-ro' | 'missing' }
  },
  roReadiness,            // 0–100 integer score (informational only)
  exhaustHistory          // array of { role: 'user'|'assistant', content } for coaching chat
}
```

### Cloud Run Endpoints (new/modified)
- `POST /ro-copilot/interpret-dvi` — accepts `{ dviItems, roContext }`; returns `{ summary, technicalDetail, callScript, serviceChecklist }`
- `POST /ro-copilot/part-lookup` — accepts `{ itemName, roContext }`; returns `{ explanation }`
- `POST /ro-copilot/objection-help` — accepts `{ objection, roContext }`; returns `{ response }`
- `POST /ro-copilot/exhaust-assist` — accepts `{ situationType, detail, roContext, history }`; returns `{ script }`
- Existing `GET /repair-order/:id` reused for Intake data fetch

---

## Content Script Changes (`content.js`)

- **URL detection:** Add pattern `/repair-orders/\d+` to the existing `MutationObserver`/`setInterval` URL-watching loop. On match, send `{ type: 'ASC_RO_DETECTED', roNumber }` message to the sidebar.
- **Injected button:** Inject a "DVI Ready" button on pages matching `/repair-orders/\d+/inspections?` — same injection pattern as the existing Appointment Copilot button on `/payment`.
- **DVI DOM scraper:** Function to traverse the inspection item rows and return `[{ name, status, note, hasPhoto }]`. CSS selectors to be confirmed against live TekMetric DOM during implementation (see Open Question #2).

---

## What Is NOT Changing

- The existing Appointment Copilot / scheduling wizard is unchanged
- The AI Chat tool is unchanged
- The concern rephrasing tool remains available as a standalone feature (not part of RO Copilot flow)
- The vehicle history / PMRR logic is unchanged

---

## Open Questions (to resolve during implementation)

1. **TekMetric write-back scope** — ~~RESOLVED~~. The TekMetric public API is confirmed read-only (GET endpoints only: `/api/v1/repair-orders`, `/api/v1/customers`, `/api/v1/jobs`, `/api/v1/shops`). No POST or PATCH endpoints are available. All write-back functionality has been removed from the design. The app is a read + intelligence layer only.
2. **DVI DOM structure** — exact CSS selectors for the TekMetric inspection page must be mapped against both sandbox and production environments before the DOM scraper is written. Fetch interception is the primary path; DOM scrape is the fallback.
3. **RO Readiness scoring** — the 4-factor equal-weight formula defined above is a starting point. Weighting may be adjusted during implementation based on real-world advisor feedback.
4. **DVI photo prompts** — the Compression checklist items and photo requirements are defined in `cultureProfiles.js` per shop from day one, using the schema `{ name, photoRequired: true|false|'if-dirty', note }`. The current Cardinal Plaza Shell profile will need this `dviChecklist` array added as part of implementation.
