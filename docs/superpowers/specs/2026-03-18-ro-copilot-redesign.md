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
- **Hybrid auto-detect + manual navigation.** The copilot auto-detects the RO from the TekMetric URL (e.g. `shop.tekmetric.com/repair-order/44821`) and launches Intake automatically. No manual RO search required.
- The advisor advances through steps using a large full-width button at the bottom of each screen.
- A **persistent step rail** in the header shows all four steps with live status (Active / Done / Waiting). Any step pill is tappable to jump directly to that step at any time.
- A **back arrow** (top left) and **X close** (top right) are always present in the header.

### Visual Style
- Matches existing app: SF Pro font stack, `#FFFBF8` warm white background, `linear-gradient(135deg, #9A3412, #EA580C, #F97316)` orange header, `#FED7AA` borders, `#FFF7ED` card backgrounds.
- No emojis. Minimalist, Apple-ready.
- Sections within each step are separated by subtle flow dividers (thin line + dot).
- All collapsible sections use a right-pointing chevron that rotates 90° when open.

---

## Step 1 — Intake

**Trigger:** Auto-loads when the extension detects a TekMetric RO URL. RO data is fetched from the TekMetric API immediately.

**Purpose:** Verify the RO has everything it needs before the tech begins the inspection. Nothing gets missed at the start.

### UI
- **Verify checklist** — a live list of required fields, each with a green check or yellow warning indicator:
  - Customer concern (at least one documented)
  - Phone number — with inline Call / Text preference selector
  - Address on file
  - Technician assigned to all jobs
- Warning rows are tappable to resolve inline where possible.
- A note below the list: *"Resolved items will be written back to TekMetric automatically."*
- **Full-width primary button:** "Intake Complete — Move to Compression"

### TekMetric Integration
- Read: customer info, vehicle info, jobs, assigned technicians, concern text — via TekMetric API through Cloud Run.
- Write: update customer phone preference, address, concern text back to TekMetric via API where endpoints are available.

---

## Step 2 — Compression

**Trigger:** Advisor taps "Intake Complete." Step advances; advisor hands off to tech for the DVI.

**Purpose:** Guide the tech toward a thorough, customer-centric DVI. Then import and interpret the completed DVI data when ready.

### UI
- **DVI Checklist card** — a list of items the tech should document before submitting, with photo requirements flagged per item:
  - Brakes & Rotors — photo required
  - Tires (all 4 corners) — photo required
  - Fluids — color and level
  - Filters (engine + cabin) — photo if dirty
  - (list is configurable via shop culture profile)
- A note: *"When the tech submits the DVI, tap below to import all findings and move to Combustion."*
- **Full-width primary button:** "DVI Complete — Import & Continue"

### DVI Data Acquisition
TekMetric does not expose inspection data via public API. Data is acquired by **page scraping**:
- A button is **injected into the TekMetric inspection page** by `content.js` (consistent with existing button injection on the payment screen).
- When tapped (from the sidebar or the injected button), `content.js` scrapes all visible DVI data from the TekMetric DOM — item names, statuses (red/yellow/green), technician notes, and photo presence.
- Scraped data is sent to the Cloud Run service, which calls Claude with a structured system prompt to interpret the DVI.

### DVI Interpretation (Claude)
The Cloud Run service interprets the raw DVI data using a custom system prompt that returns four structured sections:
1. **Findings Overview** — 2–3 sentence factual summary of all findings. No sales language, no pressure. Facts only.
2. **Technical Detail** — industry-standard terminology for each finding; gives the advisor confidence and vocabulary.
3. **Call Script** — how to open the customer call based on this specific DVI. Warm and educational.
4. **Services Checklist** — every service that should be on the RO as a result of the DVI, cross-referenced against current RO jobs (On RO / Add to RO).

These four sections are passed to the extension and stored in session state for display in Combustion.

---

## Step 3 — Combustion

**Trigger:** DVI interpretation completes. Advisor is presented with the full RO intelligence package.

**Purpose:** The "magic" step. Ensure the RO is complete, arm the advisor with everything they need to make the sale confidently, and then execute.

### UI

#### RO Readiness Gauge
- A percentage gauge at the top (e.g. 91%) with a gradient progress bar.
- Status indicators below the bar show what contributes to the score:
  - DVI interpreted
  - All services on RO
  - Concerns documented
  - (additional checks TBD during implementation)

#### RO Intelligence — 4 Collapsible Sections
All four sections from the DVI interpretation are presented as tappable, collapsible cards. Each shows its label (Summary / Advisor Intel / Call Script / Checklist) and title. The advisor taps to expand only what they need — minimizing cognitive load.

1. **Findings Overview** — facts-only summary, always a good starting read
2. **Technical Detail** — advisor reference for sounding knowledgeable
3. **How to Open the Call** — ready-to-use script opener
4. **Services on RO** — checklist with On RO / Add to RO status per item; items marked "Add to RO" are actionable

#### Advisor Quick Actions
Two chip buttons below the intelligence sections:
- **Part Lookup** — advisor can ask "what does this part do / why does it fail" for any item on the RO; answers returned in plain customer-facing language
- **Objection Help** — advisor describes a customer objection; Claude returns a calm, specific response based on the shop's culture profile

#### Advance
- **Full-width primary button:** "Sale Complete — Move to Exhaust"

### TekMetric Write-back
Where the TekMetric API permits, services flagged "Add to RO" can be written back as new jobs on the repair order.

---

## Step 4 — Exhaust

**Trigger:** Advisor taps "Sale Complete." The RO has been presented and approved (fully or partially).

**Purpose:** Handle everything that happens after the sale — supplement items, delays, objections, and pickup.

### UI

#### Prior Step Summary
Three mini-cards showing completion status for Intake, Compression, and Combustion (e.g. "4 items", "Sold").

#### Situation Chips
Four quick-action chips for the most common post-sale scenarios:
- **Supplement Item** — tech found something unexpected mid-repair; generate a supplement call script for that item including objection prep for the "but I already approved $X" response
- **Delay Follow-up** — vehicle won't be ready on time; generate a script for calling the customer
- **Post-sale Objection** — customer is pushing back after approving; get coaching on how to respond
- **Ready for Pickup** — generate the pickup call / text

Each chip opens a targeted Claude-powered response with full RO context loaded.

#### Coaching Chat
An open text area below the chips. The advisor can type any situation and get a coached response. Full RO context (customer, vehicle, all jobs, DVI findings) is available to Claude.

---

## Data & State Architecture

### Session State (held in extension memory per RO)
```
{
  roNumber,
  currentStep,          // 'intake' | 'compression' | 'combustion' | 'exhaust'
  roData,               // formatted TekMetric API response
  intakeVerification,   // { concern, phone, contactPref, address, techAssigned }
  dviRaw,               // scraped DVI data from TekMetric page
  dviIntelligence: {
    summary,            // 2-3 sentence overview
    technicalDetail,    // array of { item, detail }
    callScript,         // opening script string
    serviceChecklist    // array of { name, status: 'on-ro' | 'missing' }
  },
  roReadiness,          // 0–100 score
  exhaustHistory        // array of { role, content } for coaching chat
}
```

### Cloud Run Endpoints (new/modified)
- `POST /ro-copilot/interpret-dvi` — accepts scraped DVI payload + RO context; returns 4-section intelligence object
- `POST /ro-copilot/part-lookup` — accepts item name + RO context; returns plain-language explanation
- `POST /ro-copilot/objection-help` — accepts objection description + RO context; returns coached response
- `POST /ro-copilot/exhaust-assist` — accepts situation type + context; returns targeted script/advice
- Existing `GET /repair-order/:id` endpoint reused for Intake data fetch

---

## Content Script Changes (`content.js`)

- Detect TekMetric RO URL pattern and fire a message to the sidebar to auto-launch Intake
- Inject a **"DVI Ready"** button on the TekMetric inspection page (styled to match existing injected buttons)
- Add a DVI scraper: traverse the inspection DOM to extract item name, status, technician notes, and photo count per item

---

## What Is NOT Changing

- The existing Appointment Copilot / scheduling wizard is unchanged
- The AI Chat tool is unchanged
- The concern rephrasing tool remains available as a standalone feature (not part of RO Copilot flow)
- The vehicle history / PMRR logic is unchanged

---

## Open Questions (to resolve during implementation)

1. **TekMetric write-back scope** — which fields does the TekMetric API actually allow writing? (customer address, contact preference, new RO jobs) Need to confirm against live API docs before implementing write-back.
2. **DVI DOM structure** — the exact CSS selectors for scraping TekMetric's inspection page need to be mapped against the live app (sandbox + production) before the scraper is written.
3. **RO Readiness scoring** — exact weighting of readiness factors (e.g. how much does a missing service hurt the score?) to be defined during implementation.
4. **DVI photo prompts** — the Compression checklist items and photo requirements should eventually be configurable per shop via the culture profile. For now, a sensible default list is hardcoded.
