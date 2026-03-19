// Auto Shop Copilot — sidepanel.js
// Merged from Service Advisor Hub v3.16.6 and Admin Hub v1.5

const ASC_CLOUD_RUN_URL = 'https://advance-appointment-service-361478515851.us-east4.run.app';
const ASC_SHOP_ID = '238';

// ==================== INITIALIZATION ====================

window.addEventListener('load', () => {
    console.log('[ASC] Auto Shop Copilot loaded');
    // Hide initial loading overlay once everything is ready
    const _overlay = document.getElementById('app-loading-overlay');
    if (_overlay) { _overlay.classList.add('hidden'); setTimeout(() => { _overlay.style.display = 'none'; }, 280); }

    // ── Tile clicks → open tool on Screen 2 ──
    document.getElementById('tile-ka') ?.addEventListener('click', () => openTool('ka'));
    document.getElementById('tile-sw') ?.addEventListener('click', () => openTool('sw'));
    document.getElementById('tile-vca')?.addEventListener('click', () => openTool('vca'));
    document.getElementById('tile-ama')?.addEventListener('click', () => { openTool('ama'); amaShowView('ama-customer-view'); });
    document.getElementById('tile-review')?.addEventListener('click', () => { openTool('ama'); amaShowView('ama-review-view'); });
    document.getElementById('tile-roc')?.addEventListener('click', () => openTool('roc'));
    document.getElementById('tile-sod')?.addEventListener('click', () => openTool('sod'));
    document.getElementById('tile-moc')?.addEventListener('click', () => { mocOpen(); });

    // ── MOC S2 listeners (registered once at load) ──
    document.getElementById('moc-s2-back')    ?.addEventListener('click', mocShowS1);
    document.getElementById('moc-s2-hub-btn') ?.addEventListener('click', mocGoHub);
    document.getElementById('moc-copy-btn')   ?.addEventListener('click', mocCopy);
    document.getElementById('moc-newq-btn')   ?.addEventListener('click', mocGoHome);
    document.getElementById('moc-s2-hiw-btn') ?.addEventListener('click', () => document.getElementById('moc-s2-hiw-modal').classList.add('active'));
    document.getElementById('moc-s2-hiw-close')?.addEventListener('click', () => document.getElementById('moc-s2-hiw-modal').classList.remove('active'));
    document.getElementById('moc-s2-hiw-modal')?.addEventListener('click', (e) => { if (e.target === document.getElementById('moc-s2-hiw-modal')) document.getElementById('moc-s2-hiw-modal').classList.remove('active'); });

    // ── MOC S3 listeners (registered once at load) ──
    document.getElementById('moc-s3-home-btn')?.addEventListener('click', mocGoHome);
    document.getElementById('moc-s3-hub-btn') ?.addEventListener('click', mocGoHub);
    document.getElementById('moc-clear-btn')  ?.addEventListener('click', mocClearHistory);
    document.getElementById('moc-s3-hiw-btn') ?.addEventListener('click', () => document.getElementById('moc-s3-hiw-modal').classList.add('active'));
    document.getElementById('moc-s3-hiw-close')?.addEventListener('click', () => document.getElementById('moc-s3-hiw-modal').classList.remove('active'));
    document.getElementById('moc-s3-hiw-modal')?.addEventListener('click', (e) => { if (e.target === document.getElementById('moc-s3-hiw-modal')) document.getElementById('moc-s3-hiw-modal').classList.remove('active'); });

    // ── Return to hub ──
    document.getElementById('return-to-hub-btn')?.addEventListener('click', goBackToHub);

    // ── Tool HiW button ──
    document.getElementById('tool-hiw-btn')?.addEventListener('click', () => {
        const toolKey = document.getElementById('screen-tool').dataset.currentTool;
        const meta = TOOL_META[toolKey];
        if (!meta) return;
        document.getElementById('tool-hiw-title').textContent = meta.hiw.title;
        document.getElementById('tool-hiw-body').innerHTML   = meta.hiw.body;
        document.getElementById('tool-hiw-modal').classList.add('active');
    });
    document.getElementById('tool-hiw-close')?.addEventListener('click', () => {
        document.getElementById('tool-hiw-modal').classList.remove('active');
    });

    // ── Hub HiW modal ──
    document.getElementById('hub-hiw-btn')?.addEventListener('click', () => {
        document.getElementById('hub-hiw-modal').classList.add('active');
    });
    document.getElementById('hub-hiw-close')?.addEventListener('click', () => {
        document.getElementById('hub-hiw-modal').classList.remove('active');
    });

    // ── Hub Gear → Settings Modal ──
    document.getElementById('hub-gear-btn')?.addEventListener('click', () => {
        document.getElementById('hub-settings-modal').classList.add('active');
    });
    document.getElementById('hub-modal-close')?.addEventListener('click', () => {
        document.getElementById('hub-settings-modal').classList.remove('active');
    });

    // ── Knowledge Assistant ──
    document.getElementById('knowledge-search-btn')?.addEventListener('click', searchKnowledge);
    document.getElementById('knowledge-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchKnowledge();
    });

    // KA quick tags
    document.querySelectorAll('.ka-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            document.getElementById('knowledge-input').value = this.textContent.trim();
            searchKnowledge();
        });
    });

    // Screen 1 inline result — Copy to RO
    document.getElementById('ka-s1-copy')?.addEventListener('click', () => {
        if (!kaCurrentReport) return;
        kaCopyWithFeedback(document.getElementById('ka-s1-copy'), kaCurrentReport.what_it_is);
    });
    // Screen 1 — Advisor Prep button
    document.getElementById('ka-s1-continue')?.addEventListener('click', () => kaShowScreen('ka-screen-2'));

    // Screen 2 nav
    document.getElementById('ka-s2-back')?.addEventListener('click', () => kaShowScreen('ka-screen-1'));
    document.getElementById('ka-s2-new-search')?.addEventListener('click', kaReset);
    document.getElementById('ka-s2-next')?.addEventListener('click', () => kaShowScreen('ka-screen-3'));

    // Screen 3 nav
    document.getElementById('ka-s3-back')?.addEventListener('click', () => kaShowScreen('ka-screen-2'));
    document.getElementById('ka-s3-new-search')?.addEventListener('click', kaReset);
    document.getElementById('ka-s3-new-search-bar')?.addEventListener('click', kaReset);

    // Screen 3 section copy buttons
    document.querySelectorAll('.ka-section-copy').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!kaCurrentReport) return;
            const type = btn.getAttribute('data-copy');
            const map = {
                'for-customer': kaCurrentReport.for_the_customer,
                'risks':        kaCurrentReport.risks_of_waiting,
                'benefits':     kaCurrentReport.benefits_of_action
            };
            if (map[type]) kaCopyWithFeedback(btn, map[type]);
        });
    });

    document.getElementById('ka-copy-full')?.addEventListener('click', () => {
        if (kaCurrentReport) kaCopyWithFeedback(document.getElementById('ka-copy-full'), kaBuildFullReport(kaCurrentReport));
    });

    // ── VCA buttons ──
    document.getElementById('vca-customer-btn')?.addEventListener('click', () => generateVCA('customer'));
    document.getElementById('vca-sar-btn')?.addEventListener('click', () => generateVCA('sar'));
    document.getElementById('vca-both-btn')?.addEventListener('click', () => generateVCA('both'));
    document.getElementById('vca-exit-btn')?.addEventListener('click', () => generateVCA('exit'));

    // ── Initialize Scheduling Wizard ──
    initSchedulingWizard();

    // ── Initialize RO Copilot ──
    initRocWizard();

    // ── Initialize AMA ──
    initAMA();

    // ── Lesson teaser on hub ──
    initLessonTeaser();

    // ── MOC S3 back arrow ──
    document.getElementById('moc-s3-back')?.addEventListener('click', mocShowS1);
});

// ==================== SCREEN SWITCHING (two-screen architecture) ====================

const TOOL_META = {
    ka:     { icon: '', name: 'Knowledge Assistant',       panel: 'tool-ka-content',  hiw: { title: 'Knowledge Assistant', body: '<p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Search for any part or service</strong> — type a name like "brake pads" or "timing belt" and tap Get Information.</p><p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Screen 1 — What It Is:</strong> A professional description appears instantly. Copy it directly to your Repair Order with one tap.</p><p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Screen 2 — Advisor Prep:</strong> Your SA coaching tip, urgency level, and related services.</p><p style="font-size:12px;color:#4a5568;line-height:1.65;"><strong>Screen 3 — Customer View:</strong> Plain-language explanations, risks of waiting, and benefits of action.</p>' } },
    sw:     { icon: '', name: 'Appointment Copilot',        panel: 'tool-sw-content',  hiw: { title: 'Appointment Copilot', body: '<p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;">Books the next appointment directly into TekMetric in three steps: select date and time, choose services, then confirm.</p><p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;">When an RO is loaded, the Appointment Copilot uses the vehicle\'s service history to calculate the recommended interval and pre-populate the Preventive Maintenance and Repairs Recommendation predictive maintenance list.</p><p style="font-size:12px;color:#4a5568;line-height:1.65;">Appointments are created with the title format: Appointment Copilot - [Customer Name] - [Year Make Model].</p>' } },
    vca:    { icon: '', name: 'Vehicle Consultant',         panel: 'tool-vca-content', hiw: { title: 'Vehicle Consultant Advisor', body: '<p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;">Generate three report types from TekMetric data: Customer Notes, Service Advisor Reports, and Exit Schedule Reports.</p><p style="font-size:12px;color:#4a5568;line-height:1.65;">Powered by Cardinal Plaza Shell\'s Preventive Maintenance and Repairs Recommendation engine with T0 (today), T6 (6 months), and T12 (12 months) predictive time windows.</p>' } },
    ama:    { icon: '', name: 'Ask Me Anything',             panel: 'tool-ama-content', hiw: { title: 'Ask Me Anything', body: '<p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Customer Question mode:</strong> In-person or phone — answer questions, overcome objections, and help customers decide. Vehicle context from the loaded RO is automatically included.</p><p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Google Review mode:</strong> Craft professional, warm responses to positive or negative Google reviews in Cardinal Plaza Shell\'s voice.</p><p style="font-size:12px;color:#4a5568;line-height:1.65;">Use the length and detail chips to refine, or type a follow-up in the chat thread to adjust tone.</p>' } },
    roc:    { icon: '', name: 'RO Copilot',                  panel: 'tool-roc-content', hiw: { title: 'RO Copilot', body: '<p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Phase 1 — Write-Up:</strong> Document concerns, confirm vehicle info, assign tech. AI assist helps phrase vague concerns in professional automotive language.</p><p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Phase 2 — Findings Ready:</strong> Tech has the car and is performing the DVI. Checklist keeps you on track. Generates a status script if the customer calls.</p><p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Phase 3 — Estimate Build:</strong> Review all services on the RO. Claude reviews your estimate for gaps, missing descriptions, and items customers commonly question.</p><p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Phase 4 — Present &amp; Sell:</strong> Generate a full phone script for the estimate call, track approvals, and mark the sale when done.</p><p style="font-size:12px;color:#4a5568;line-height:1.65;"><strong>Phase 5 — Post-Sale Support:</strong> Handles the unexpected — customer changes, tech findings, parts delays, unhappy customers. Describe the situation and get coaching on what to do.</p>' } },
    sod:    { icon: '', name: 'Service Offering Developer',  panel: 'tool-sod-content', hiw: { title: 'Service Offering Developer', body: '<p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Develop New Service:</strong> An AI-guided conversation helps you define a new service offering — including what\'s included, time estimates, recommended frequency, and target vehicles.</p><p style="font-size:12px;color:#4a5568;line-height:1.65;margin-bottom:10px;"><strong>Create Marketing Materials:</strong> Generate customer-ready descriptions, marketing copy, advisor training, and operational checklists for any existing service.</p><p style="font-size:12px;color:#4a5568;line-height:1.65;">All materials are written in Cardinal Plaza Shell\'s calm, educational voice.</p>' } },
};

function openTool(toolKey) {
    const meta = TOOL_META[toolKey];
    if (!meta) return;

    // Update Screen 2 header
    document.getElementById('tool-header-icon').textContent = meta.icon;
    document.getElementById('tool-header-name').textContent  = meta.name;

    // Show correct panel
    ['tool-ka-content','tool-sw-content','tool-vca-content','tool-ama-content','tool-sod-content','tool-roc-content'].forEach(id => {
        const el = document.getElementById(id); if(el) el.style.display='none';
    });
    const tp = document.getElementById(meta.panel); if(tp) tp.style.display='block';

    // Switch to Screen 2
    document.getElementById('screen-hub').classList.remove('active');
    document.getElementById('screen-tool').classList.add('active');

    // Move RO banner + search into tool screen
    const _toolHeader = document.getElementById('tool-header');
    const _roBar = document.getElementById('tm-banner');
    const _roSearch = document.getElementById('tm-ro-search-wrap');
    if (_roBar && _toolHeader) { _toolHeader.after(_roBar); _roBar.after(_roSearch); }

    // Store current tool for HiW
    document.getElementById('screen-tool').dataset.currentTool = toolKey;

    // ROC uses its own step-rail header; hide the outer tool-header for ROC
    document.getElementById('tool-header').style.display = (toolKey === 'roc') ? 'none' : '';

    // AMA: refresh TM pill when opening
    if (toolKey === 'ama') amaUpdateTMPill();

    // SW: if TM data already loaded, feed it in immediately using the internal roId from the URL
    if (toolKey === 'sw') {
        if (tmLoadedData && lastRoId && swLoadingRoId !== lastRoId && !(swRoData?.roId === lastRoId && swServicesRendered)) {
            swLoadRO(lastRoId);
        } else if (swRoData) {
            swDisplayRO(); // already loaded — re-render banner
        }
    }

    // ROC: initialize when opened
    if (toolKey === 'roc') rocOnOpen();
}

function goBackToHub() {
    document.getElementById('tool-header').style.display = '';
    document.getElementById('screen-tool').classList.remove('active');
    document.getElementById('screen-hub').classList.add('active');

    // Move RO banner + search back to hub screen
    const _hubHeader = document.querySelector('#screen-hub .hub-header');
    const _roBar = document.getElementById('tm-banner');
    const _roSearch = document.getElementById('tm-ro-search-wrap');
    if (_roBar && _hubHeader) { _hubHeader.after(_roBar); _roBar.after(_roSearch); }
}

// ==================== LESSON TEASER (Hub) ====================

let teaserLessonIdx = -1;

function initLessonTeaser() {
    teaserLessonIdx = Math.floor(Math.random() * MOC_LESSONS.length);
    const lesson = MOC_LESSONS[teaserLessonIdx];

    document.getElementById('teaser-lesson-num').textContent = `#${lesson.num} of 60`;
    document.getElementById('teaser-lesson-title').textContent = lesson.title;

    // Split body into paragraphs
    const paras = lesson.body.split('\n\n').map(p => p.trim()).filter(Boolean);

    // Snippet: first ~140 chars of first paragraph, ending cleanly at a word boundary
    const full0 = paras[0] || '';
    const snippetRaw = full0.length > 140
        ? full0.slice(0, 140).replace(/\s+\S*$/, '') + '\u2026'
        : full0;
    document.getElementById('teaser-lesson-snippet').textContent = snippetRaw;

    // Expanded view: short intro label + all paragraphs
    const fullInner = document.getElementById('teaser-lesson-full-inner');
    fullInner.innerHTML = '';
    const introLine = document.createElement('span');
    introLine.className = 'teaser-intro-line';
    introLine.textContent = 'A thought to carry with you today \u2014';
    fullInner.appendChild(introLine);
    paras.forEach(para => {
        const p = document.createElement('p');
        p.textContent = para;
        fullInner.appendChild(p);
    });

    // More / collapse toggle
    const moreBtn = document.getElementById('teaser-more-btn');
    const fullDiv = document.getElementById('teaser-lesson-full');
    const openBtn = document.getElementById('teaser-open-btn');
    let expanded  = false;

    moreBtn.addEventListener('click', () => {
        expanded = !expanded;
        if (expanded) {
            fullDiv.classList.add('expanded');
            moreBtn.textContent = 'Show Less ▴';
            openBtn.classList.add('visible');
        } else {
            fullDiv.classList.remove('expanded');
            moreBtn.textContent = 'Read More ▾';
            openBtn.classList.remove('visible');
        }
    });

    openBtn.addEventListener('click', () => {
        mocOpenWithLesson(teaserLessonIdx);
    });
}

// ==================== KNOWLEDGE ASSISTANT v2.1 ====================

let kaCurrentReport = null;

function kaShowScreen(id) {
    document.querySelectorAll('.ka-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // Sync step bar
    const stepMap = { 'ka-screen-1': 1, 'ka-screen-2': 2, 'ka-screen-3': 3 };
    const active = stepMap[id] || 1;
    const total  = 3;
    for (let i = 1; i <= total; i++) {
        const el = document.getElementById(`ka-step-${i}`);
        if (!el) continue;
        el.classList.remove('active', 'complete');
        if (i < active) el.classList.add('complete');
        else if (i === active) el.classList.add(active === total ? 'complete' : 'active');
    }
}

function kaCopyWithFeedback(btn, text) {
    navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✓ Copied';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 2000);
    }).catch(() => alert('Copy failed. Please try manually.'));
}

function kaUrgencyHTML(level, note) {
    const labels = {
        'IMMEDIATE': 'Immediate Attention',
        'RECOMMENDED': 'Recommended',
        'PREVENTIVE CARE': 'Preventive Care'
    };
    return `<strong>${labels[level] || level}</strong><br><span style="font-size:11px;color:#6c757d;">${note}</span>`;
}

function kaPopulate(r) {
    // ── Screen 1: inline result card ──
    document.getElementById('ka-result-title').textContent = r.subject;
    document.getElementById('ka-result-body').textContent  = r.what_it_is;
    const resultCard = document.getElementById('ka-result-card');
    if (resultCard) resultCard.style.display = 'block';
    // Hide suggestions once result shows
    const suggestions = document.getElementById('ka-suggestions');
    if (suggestions) suggestions.style.display = 'none';

    // ── Screen 2: Advisor Prep ──
    document.getElementById('ka-subject-s2').textContent = r.subject;

    // Urgency display
    const urgencyEl = document.getElementById('ka-urgency-display');
    if (urgencyEl) {
        const lvl = r.urgency_level || 'PREVENTIVE CARE';
        const labels = { 'IMMEDIATE': 'Immediate Attention', 'RECOMMENDED': 'Recommended', 'PREVENTIVE CARE': 'Preventive Care' };
        urgencyEl.innerHTML = `<div style="font-size:13px;font-weight:700;color:#7A3520;margin-bottom:4px;">${labels[lvl] || lvl}</div><div style="font-size:12px;color:#495057;line-height:1.5;">${escapeHTML(r.urgency_note || '')}</div>`;
    }

    // Vehicle history note
    const histSection = document.getElementById('ka-vehicle-history-section');
    const histText    = document.getElementById('ka-vehicle-note-s2');
    if (histSection && histText) {
        if (r.vehicle_context && r.vehicle_context.history_note) {
            histText.textContent = r.vehicle_context.history_note;
            histSection.style.display = 'block';
        } else {
            histSection.style.display = 'none';
        }
    }

    // Maintenance schedule
    const schedSection = document.getElementById('ka-schedule-section');
    if (r.maintenance_schedule) {
        document.getElementById('ka-interval-val').textContent = r.maintenance_schedule.interval || '';
        document.getElementById('ka-interval-why').textContent = r.maintenance_schedule.why || '';
        if (schedSection) schedSection.style.display = 'block';
    } else {
        if (schedSection) schedSection.style.display = 'none';
    }

    // Related services pills (screen 2)
    const relEl = document.getElementById('ka-related-pills-s2');
    if (relEl) {
        relEl.innerHTML = '';
        (r.related_services || []).forEach(s => {
            const pill = document.createElement('span');
            pill.className = 'ka-related-pill';
            pill.textContent = s;
            relEl.appendChild(pill);
        });
    }

    // SA Coaching tip
    const coachingBox = document.getElementById('ka-coaching-box');
    if (coachingBox) {
        coachingBox.innerHTML = '<div class="ka-coaching-title">SA Tips</div>' + escapeHTML(r.sa_coaching_tip || '');
    }

    // ── Screen 3: Customer View ──
    document.getElementById('ka-subject-s3').textContent  = r.subject;
    document.getElementById('ka-for-customer').textContent = r.for_the_customer;
    document.getElementById('ka-risks').textContent        = r.risks_of_waiting;
    document.getElementById('ka-benefits').textContent     = r.benefits_of_action;
}

function kaReset() {
    kaCurrentReport = null;
    const inp = document.getElementById('knowledge-input');
    if (inp) inp.value = '';
    const resultCard = document.getElementById('ka-result-card');
    if (resultCard) resultCard.style.display = 'none';
    const suggestions = document.getElementById('ka-suggestions');
    if (suggestions) suggestions.style.display = 'block';
    const errorMsg = document.getElementById('ka-error-msg');
    if (errorMsg) errorMsg.style.display = 'none';
    kaShowScreen('ka-screen-1');
}

// Navigate back to screen 1 WITHOUT clearing the current report

function kaBuildFullReport(r) {
    return `KNOWLEDGE ASSISTANT REPORT — Cardinal Plaza Shell
${'─'.repeat(48)}
SERVICE: ${r.subject}
URGENCY: ${r.urgency_level} — ${r.urgency_note}
${'─'.repeat(48)}

WHAT IT IS
${r.what_it_is}

FOR THE CUSTOMER
${r.for_the_customer}

RISKS OF WAITING
${r.risks_of_waiting}

BENEFITS OF ACTION
${r.benefits_of_action}

RELATED SERVICES
${r.related_services.join(' • ')}

SA COACHING TIP
${r.sa_coaching_tip}
${'─'.repeat(48)}`;
}

async function searchKnowledge() {
    const query     = document.getElementById('knowledge-input').value.trim();
    const loading   = document.getElementById('ka-loading');
    const errorMsg  = document.getElementById('ka-error-msg');
    const searchBtn = document.getElementById('knowledge-search-btn');

    if (!query) {
        if (errorMsg) { errorMsg.textContent = 'Please enter a part, service, or question.'; errorMsg.style.display = 'block'; }
        return;
    }

    if (errorMsg) errorMsg.style.display = 'none';
    if (loading)   loading.classList.add('active');
    if (searchBtn) searchBtn.disabled = true;

    // Build vehicle context from loaded RO if available — pass full data
    let vehicleContext = null;
    if (tmLoadedData) {
        const s = tmLoadedData.summary;
        vehicleContext = {
            vehicle:     s.vehicle,
            odometer:    s.odometer,
            roNumber:    s.roNumber,
            fullROData:  tmLoadedData.formatted || '',   // full RO including all technician notes
            historyNote: buildHistoryNote(query, tmLoadedData.formatted || '')
        };
    }

    chrome.runtime.sendMessage(
        { action: 'asc_searchKnowledge', query, vehicleContext },
        (response) => {
            if (loading)   loading.classList.remove('active');
            if (searchBtn) searchBtn.disabled = false;

            if (chrome.runtime.lastError || !response?.success) {
                const msg = response?.error || chrome.runtime.lastError?.message || 'Search failed. Please try again.';
                if (errorMsg) { errorMsg.textContent = msg; errorMsg.style.display = 'block'; }
                return;
            }

            kaCurrentReport = response.data;
            kaPopulate(response.data);
            kaShowScreen('ka-screen-1');   // stay on screen 1, result card appears inline
        }
    );
}

// Scan the formatted RO text for any mention of the searched service
function buildHistoryNote(query, formattedRO) {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const lines = formattedRO.split('\n');
    const matches = lines.filter(line => {
        const lower = line.toLowerCase();
        return keywords.some(kw => lower.includes(kw));
    });

    if (matches.length === 0) {
        return `No record of a service matching "${query}" was found in this repair order's history.`;
    }

    return `The following relevant entries were found in the repair order:\n` +
        matches.slice(0, 5).map(m => `  • ${m.trim()}`).join('\n');
}

// ==================== VCA GENERATOR ====================

async function generateVCA(type) {
    const input   = tmLoadedData?.formatted || '';
    const loading = document.getElementById('vca-loading');
    const result  = document.getElementById('vca-result');

    if (!input) {
        result.classList.add('active');
        result.querySelector('#vca-result-text').textContent = 'No TekMetric data loaded. Open a Repair Order in TekMetric first, then try again.';
        return;
    }

    loading.classList.add('active');
    result.classList.remove('active');

    chrome.runtime.sendMessage(
        { action: 'asc_generateVCA', input: input, type: type },
        (response) => {
            loading.classList.remove('active');
            if (chrome.runtime.lastError || !response?.success) {
                const resultText = document.getElementById('vca-result-text');
                if (resultText) resultText.textContent = `Error: ${response?.error || chrome.runtime.lastError?.message || 'Unknown error'}`;
                result.classList.add('active');
                return;
            }
            displayVCAResults(response.data, type);
        }
    );
}

function displayVCAResults(content, type) {
    const result     = document.getElementById('vca-result');
    const resultText = document.getElementById('vca-result-text');
    const copyBtn    = document.getElementById('vca-copy-btn');
    const newBtn     = document.getElementById('vca-new-btn');

    resultText.textContent = content;
    result.classList.add('active');

    // Copy button
    if (copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(content).then(() => {
                const orig = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = orig; }, 1800);
            });
        };
    }

    // New report button — hide result, show buttons again
    if (newBtn) {
        newBtn.onclick = () => {
            result.classList.remove('active');
        };
    }
}

// ==================== UTILITY FUNCTIONS ====================

function formatList(text) {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return '<p>No information available</p>';
    
    const formatted = lines.map(line => {
        const cleaned = line.trim().replace(/^[-•*]\s*/, '');
        return cleaned ? `<li>${cleaned}</li>` : '';
    }).filter(l => l).join('');
    
    return `<ul>${formatted}</ul>`;
}

function escapeQuotes(text) {
    return text.replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/\\/g, '\\\\').replace(/"/g, '&quot;');
}

function copyText(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        if (button) {
            const originalText = button.innerHTML;
            button.innerHTML = 'Copied!';
            setTimeout(() => {
                button.innerHTML = originalText;
            }, 2000);
        }
    }).catch(err => {
        alert('Failed to copy: ' + err);
    });
}

// ==================== SERVICE OFFERING DEVELOPER ====================

// ── State ──────────────────────────────────────────────────────────
let sodHistory = [];
let sodMsgCount = 0;
let sodDefinition = '';

// ── Init (runs inside the existing load listener via delegation) ───
document.addEventListener('DOMContentLoaded', initSOD);
window.addEventListener('load', initSOD);

function initSOD() {
    // Menu buttons
    const devBtn = document.getElementById('sod-develop-btn');
    const mktgBtn = document.getElementById('sod-marketing-btn');
    if (devBtn)  devBtn.addEventListener('click', sodStartDevelop);
    if (mktgBtn) mktgBtn.addEventListener('click', () => sodShowView('sod-marketing-view'));

    // Back buttons
    document.getElementById('sod-back-1')?.addEventListener('click', sodReturnMenu);
    document.getElementById('sod-back-2')?.addEventListener('click', sodReturnMenu);
    document.getElementById('sod-back-3')?.addEventListener('click', sodReturnMenu);

    // Chat
    document.getElementById('sod-send-btn')?.addEventListener('click', sodSendMessage);
    document.getElementById('sod-chat-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sodSendMessage(); }
    });

    // Build package
    document.getElementById('sod-build-btn')?.addEventListener('click', sodBuildPackage);

    // Definition actions
    document.getElementById('sod-copy-def-btn')?.addEventListener('click', sodCopyDefinition);
    document.getElementById('sod-to-mktg-btn')?.addEventListener('click', sodPrefillMarketing);
    document.getElementById('sod-new-service-btn')?.addEventListener('click', sodReturnMenu);

    // Marketing generate
    document.getElementById('sod-mktg-generate-btn')?.addEventListener('click', sodGenerateMarketing);
}

// ── Navigation ─────────────────────────────────────────────────────
function sodShowView(viewId) {
    document.querySelectorAll('#tool-sod-content .sod-view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId)?.classList.add('active');
}

function sodReturnMenu() {
    sodHistory = [];
    sodMsgCount = 0;
    sodDefinition = '';
    document.getElementById('sod-chat-messages').innerHTML = '';
    document.getElementById('sod-chat-input').value = '';
    document.getElementById('sod-build-bar').classList.remove('active');
    document.getElementById('sod-definition-sections').innerHTML = '';
    document.getElementById('sod-mktg-results').style.display = 'none';
    document.getElementById('sod-mktg-form').style.display = 'block';
    sodShowView('sod-menu');
}

// ── Chat ───────────────────────────────────────────────────────────
function sodStartDevelop() {
    sodShowView('sod-chat-view');
    sodAddAIMsg("What service are you thinking about offering? Give me a brief idea and I'll help you develop it into a complete offering.");
}

async function sodSendMessage() {
    const input = document.getElementById('sod-chat-input');
    const text = input.value.trim();
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

        if (sodMsgCount >= 2) {
            document.getElementById('sod-build-bar').classList.add('active');
        }
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
    div.innerHTML = '<img class="chat-loading-gif" src="loading.gif" alt="Loading...">';
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

// ── Build Package ──────────────────────────────────────────────────
async function sodBuildPackage() {
    document.getElementById('sod-build-btn').disabled = true;
    document.getElementById('sod-chat-input').disabled = true;
    document.getElementById('sod-send-btn').disabled = true;
    sodShowTyping();

    try {
        const recPrompt = "I'm ready to build the service package. Based on everything we've discussed, please RECOMMEND the ideal frequency and target vehicles for this service. Be specific and explain your reasoning briefly for each recommendation. End with: 'Click Generate below whenever you're ready.'";
        sodHistory.push({ role: 'user', content: recPrompt });
        const recReply = await sodCallAPI(sodBuildDevPrompt(), sodHistory);
        sodHideTyping();
        sodAddAIMsg(recReply);
        sodHistory.push({ role: 'assistant', content: recReply });

        // Show green generate button in chat
        const btn = document.createElement('div');
        btn.style.cssText = 'text-align:center;margin:14px 0;';
        btn.innerHTML = '<button id="sod-final-gen-btn" style="background:linear-gradient(135deg,#28a745,#20c997);color:white;border:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Generate Final Service Definition</button>';
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

// ── Generate Definition ────────────────────────────────────────────
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

// ── Populate definition sections ───────────────────────────────────
const SOD_SECTIONS = [
    { key: 'name',        label: 'Service Name',                     id: 'sod-sec-name',     rows: 2  },
    { key: 'description', label: 'Service Description',              id: 'sod-sec-desc',     rows: 3  },
    { key: 'included',    label: "What's Included",                  id: 'sod-sec-incl',     rows: 8  },
    { key: 'time',        label: 'Time Estimate',                    id: 'sod-sec-time',     rows: 2  },
    { key: 'frequency',   label: 'Recommended Frequency',            id: 'sod-sec-freq',     rows: 2  },
    { key: 'target',      label: 'Target Vehicles',                  id: 'sod-sec-target',   rows: 3  },
    { key: 'why',         label: 'Why It Matters',                   id: 'sod-sec-why',      rows: 5  },
    { key: 'benefits',    label: 'Customer Benefits',                id: 'sod-sec-benefits', rows: 5  },
    { key: 'talking',     label: 'Service Advisor Talking Points',   id: 'sod-sec-talking',  rows: 6  },
    { key: 'when',        label: 'When to Recommend',                id: 'sod-sec-when',     rows: 5  }
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
    const nextHeaders = Object.values(SOD_HEADERS).filter(h => h !== header).join('|');
    const regex = new RegExp(`${header.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*\\n([\\s\\S]*?)(?=##|$)`, 'i');
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
                <button class="regen-btn" data-key="${sec.key}">↺ Regenerate</button>
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
        const prompt = `Regenerate ONLY the "${sec.label.replace(/^[^\s]+\s/,'')}" section of the service definition. Keep it consistent with everything else we discussed. Use Cardinal Plaza Shell's voice. Return only the section content, no header.`;
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

// ── Copy definition ────────────────────────────────────────────────
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

// ── Pre-fill marketing from definition ────────────────────────────
function sodPrefillMarketing() {
    document.getElementById('sod-mktg-name').value  = document.getElementById('sod-sec-name')?.value  || '';
    document.getElementById('sod-mktg-desc').value  = document.getElementById('sod-sec-desc')?.value  || '';
    document.getElementById('sod-mktg-hours').value = document.getElementById('sod-sec-time')?.value  || '';
    document.getElementById('sod-mktg-freq').value  = document.getElementById('sod-sec-freq')?.value  || '';

    // Pass full definition as context
    const full = SOD_SECTIONS.map(s => `${SOD_HEADERS[s.key]}\n${document.getElementById(s.id)?.value||''}`).join('\n\n');
    document.getElementById('sod-mktg-extra').value = `Full service definition:\n\n${full}`;

    document.getElementById('sod-mktg-results').style.display = 'none';
    document.getElementById('sod-mktg-form').style.display = 'block';
    sodShowView('sod-marketing-view');
}

// ── Generate Marketing ─────────────────────────────────────────────
async function sodGenerateMarketing() {
    const name  = document.getElementById('sod-mktg-name').value.trim();
    const desc  = document.getElementById('sod-mktg-desc').value.trim();
    const hours = document.getElementById('sod-mktg-hours').value.trim();
    const freq  = document.getElementById('sod-mktg-freq').value.trim();
    const extra = document.getElementById('sod-mktg-extra').value.trim();

    if (!name) { alert('Please enter a service name.'); return; }

    document.getElementById('sod-mktg-loading').classList.add('active');
    document.getElementById('sod-mktg-generate-btn').disabled = true;

    const sysPrompt = sodBuildDevPrompt();
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
        const result = await sodCallAPI(sysPrompt, [{ role: 'user', content: userMsg }]);
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
        { header: '## CUSTOMER MATERIALS',      label: 'Customer Materials' },
        { header: '## MARKETING COPY',           label: 'Marketing Copy' },
        { header: '## SERVICE ADVISOR TRAINING', label: 'Advisor Training' },
        { header: '## OPERATIONS',               label: 'Operations' }
    ];

    const container = document.getElementById('sod-mktg-results');
    container.innerHTML = '';

    sections.forEach((sec, i) => {
        const nextHeader = sections[i + 1]?.header || null;
        let text = '';
        const regex = new RegExp(`${sec.header.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*\\n([\\s\\S]*?)(?=${nextHeader ? nextHeader.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') : '$'})`, 'i');
        const m = content.match(regex);
        if (m) text = m[1].trim();

        const div = document.createElement('div');
        div.className = 'mktg-result-section';
        div.innerHTML = `
            <h4>${sec.label} <button class="mktg-copy-btn" data-text="">Copy</button></h4>
            <div class="mktg-content">${escapeHTML(text)}</div>
        `;
        const copyBtn = div.querySelector('.mktg-copy-btn');
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(text);
            const orig = copyBtn.textContent;
            copyBtn.textContent = '✓ Copied!';
            setTimeout(() => copyBtn.textContent = orig, 2000);
        });
        container.appendChild(div);
    });

    const newBtn = document.createElement('button');
    newBtn.className = 'btn action-btn-new';
    newBtn.style.marginTop = '8px';
    newBtn.textContent = 'Start New Service';
    newBtn.addEventListener('click', sodReturnMenu);
    container.appendChild(newBtn);

    document.getElementById('sod-mktg-form').style.display = 'none';
    container.style.display = 'block';
}

// ── API Helper ─────────────────────────────────────────────────────
async function sodCallAPI(systemPrompt, messages) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: 'asc_sodCall', systemPrompt, messages },
            (response) => {
                if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
                if (response?.success) resolve(response.data);
                else reject(new Error(response?.error || 'Unknown error'));
            }
        );
    });
}

// ── System Prompt ──────────────────────────────────────────────────
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
Use soft language: "about six months," "at your next visit" — never hard deadlines.

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

// ── Helpers ────────────────────────────────────────────────────────
function escapeHTML(str) {
    return String(str)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
}

function sodFormatText(text) {
    return escapeHTML(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

// ==================== ASK ME ANYTHING ====================

let amaCustomerHistory = [];
let amaReviewHistory   = [];
let amaCustomerLocation = null;
let amaReviewSentiment  = null;

window.addEventListener('load', initAMA);

function initAMA() {
    // Menu buttons
    document.getElementById('ama-mode-customer')?.addEventListener('click', () => amaShowView('ama-customer-view'));

    // Back buttons
    document.getElementById('ama-back-customer')?.addEventListener('click', () => amaShowView('ama-menu'));
    document.getElementById('ama-back-review')?.addEventListener('click',  () => amaShowView('ama-menu'));

    // Location toggles
    document.getElementById('ama-loc-inperson')?.addEventListener('click', () => {
        amaCustomerLocation = 'inperson';
        document.getElementById('ama-loc-inperson').classList.add('active');
        document.getElementById('ama-loc-phone').classList.remove('active');
        amaUpdateTMPill();
    });
    document.getElementById('ama-loc-phone')?.addEventListener('click', () => {
        amaCustomerLocation = 'phone';
        document.getElementById('ama-loc-phone').classList.add('active');
        document.getElementById('ama-loc-inperson').classList.remove('active');
        amaUpdateTMPill();
    });

    // Sentiment toggles
    document.getElementById('ama-review-positive')?.addEventListener('click', () => {
        amaReviewSentiment = 'positive';
        document.getElementById('ama-review-positive').classList.add('active');
        document.getElementById('ama-review-negative').classList.remove('active');
    });
    document.getElementById('ama-review-negative')?.addEventListener('click', () => {
        amaReviewSentiment = 'negative';
        document.getElementById('ama-review-negative').classList.add('active');
        document.getElementById('ama-review-positive').classList.remove('active');
    });

    // Generate buttons
    document.getElementById('ama-customer-generate')?.addEventListener('click', amaGenerateCustomer);
    document.getElementById('ama-review-generate')?.addEventListener('click',   amaGenerateReview);

    // Chip feedback
    document.querySelectorAll('#ama-customer-result .ama-chip').forEach(c =>
        c.addEventListener('click', () => amaHandleChip(c, 'customer')));
    document.querySelectorAll('#ama-review-result .ama-chip').forEach(c =>
        c.addEventListener('click', () => amaHandleChip(c, 'review')));

    // Refinement send
    document.getElementById('ama-customer-refine-send')?.addEventListener('click', () => amaRefineSend('customer'));
    document.getElementById('ama-review-refine-send')?.addEventListener('click',   () => amaRefineSend('review'));
    document.getElementById('ama-customer-refine-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); amaRefineSend('customer'); }
    });
    document.getElementById('ama-review-refine-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); amaRefineSend('review'); }
    });
    document.getElementById('ama-customer-followup-send')?.addEventListener('click', () => amaFollowUpSend());
    document.getElementById('ama-customer-followup-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); amaFollowUpSend(); }
    });

    // Copy buttons
    document.getElementById('ama-customer-copy')?.addEventListener('click', () => {
        const text = document.getElementById('ama-customer-response-text').textContent;
        navigator.clipboard.writeText(text);
        amaCopyFlash('ama-customer-copy');
    });
    document.getElementById('ama-review-copy')?.addEventListener('click', () => {
        const text = document.getElementById('ama-review-response-text').textContent;
        navigator.clipboard.writeText(text);
        amaCopyFlash('ama-review-copy');
    });

    // Start Over — return to AMA menu
    document.getElementById('ama-customer-reset')?.addEventListener('click', () => {
        amaResetCustomer(); amaShowView('ama-menu');
    });
    document.getElementById('ama-review-reset')?.addEventListener('click', () => {
        amaResetReview(); amaShowView('ama-menu');
    });
}

function amaShowView(viewId) {
    document.querySelectorAll('#tool-ama-content .ama-view').forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
    });
    const el = document.getElementById(viewId);
    if (el) { el.classList.add('active'); el.style.display = 'flex'; }
    amaUpdateTMPill();
}

function amaUpdateTMPill() {
    const pill     = document.getElementById('ama-vehicle-pill');
    const pillText = document.getElementById('ama-vehicle-pill-text');
    if (!pill || !pillText) return;
    if (tmLoadedData) {
        const s = tmLoadedData.summary;
        pillText.textContent = `${s.vehicle || ''}${s.odometer ? ' · ' + s.odometer : ''}`;
        pill.classList.add('active');
    } else {
        pill.classList.remove('active');
    }
}

// ── Generate: Customer Question ──
async function amaGenerateCustomer() {
    const question = document.getElementById('ama-question-input').value.trim();
    if (!question) { alert('Please enter the customer\'s question or situation first.'); return; }
    if (!amaCustomerLocation) { alert('Please select In Person or On the Phone first.'); return; }

    const context    = document.getElementById('ama-context-input').value.trim();
    const isPhone    = amaCustomerLocation === 'phone';
    const hasRO      = !!tmLoadedData;
    const dropOffMode = isPhone && !hasRO;

    const systemPrompt = amaCustomerSystemPrompt();
    const userMsg      = amaCustomerUserMsg(question, context, hasRO, isPhone, dropOffMode);

    amaCustomerHistory = [{ role: 'user', content: userMsg }];

    document.getElementById('ama-customer-generate').disabled = true;
    document.getElementById('ama-customer-loading').style.display = 'block';
    document.getElementById('ama-customer-result').style.display = 'none';

    try {
        const reply = await amaCallAPI(systemPrompt, amaCustomerHistory);
        amaCustomerHistory.push({ role: 'assistant', content: reply });
        document.getElementById('ama-customer-response-text').textContent = reply;
        document.getElementById('ama-customer-result').style.display = 'block';
    } catch(err) {
        alert('AMA Error: ' + (err?.message || String(err)));
        console.error('[ASC]', err);
    }

    document.getElementById('ama-customer-loading').style.display = 'none';
    document.getElementById('ama-customer-generate').disabled = false;
}

function amaCustomerUserMsg(question, context, hasRO, isPhone, dropOffMode) {
    let msg = '';
    if (dropOffMode) {
        msg += `MODE: Phone call — customer does NOT have an existing repair order. Goal is to help them feel confident and excited about dropping off their vehicle.\n\n`;
    } else if (isPhone && hasRO) {
        msg += `MODE: Phone call — customer HAS an open repair order. Use the full RO details below to give a specific, informed answer — do NOT respond generically.\n`;
        if (tmLoadedData) msg += amaVehicleContext() + '\n';
        msg += '\n';
    } else {
        msg += `MODE: Customer is in person at the shop. Use the full RO details below to give a specific, informed answer — do NOT respond generically.\n`;
        if (hasRO && tmLoadedData) msg += amaVehicleContext() + '\n';
    }
    // Always include full RO data when available — this is the authoritative source
    if (hasRO && tmLoadedData?.formatted) {
        msg += `\nFULL REPAIR ORDER DATA (use this to answer specifically — do not ignore these details):\n${tmLoadedData.formatted}\n`;
    }
    msg += `\nCUSTOMER QUESTION / SITUATION:\n${question}`;
    if (context) msg += `\n\nADDITIONAL CONTEXT:\n${context}`;
    return msg;
}

function amaVehicleContext() {
    if (!tmLoadedData) return '';
    const s = tmLoadedData.summary;
    const parts = [];
    if (s.vehicle)   parts.push(`Vehicle: ${s.vehicle}`);
    if (s.odometer)  parts.push(`Odometer: ${s.odometer}`);
    if (s.roNumber)  parts.push(`RO: #${s.roNumber}`);
    if (s.customer)  parts.push(`Customer: ${s.customer}`);
    return parts.join(' | ');
}

// ── Generate: Google Review ──
async function amaGenerateReview() {
    const reviewText = document.getElementById('ama-review-input').value.trim();
    if (!reviewText) { alert('Please enter or describe the review first.'); return; }
    if (!amaReviewSentiment) { alert('Please select Positive or Negative.'); return; }

    const context      = document.getElementById('ama-review-context-input').value.trim();
    const systemPrompt = amaReviewSystemPrompt();
    const userMsg      = `REVIEW TYPE: ${amaReviewSentiment === 'positive' ? 'Positive' : 'Negative'}\n\nREVIEW TEXT:\n${reviewText}${context ? '\n\nADDITIONAL CONTEXT:\n' + context : ''}`;

    amaReviewHistory = [{ role: 'user', content: userMsg }];

    document.getElementById('ama-review-generate').disabled = true;
    document.getElementById('ama-review-loading').style.display = 'block';
    document.getElementById('ama-review-result').style.display = 'none';

    try {
        const reply = await amaCallAPI(systemPrompt, amaReviewHistory);
        amaReviewHistory.push({ role: 'assistant', content: reply });
        document.getElementById('ama-review-response-text').textContent = reply;
        document.getElementById('ama-review-result').style.display = 'block';
    } catch(err) {
        alert('AMA Error: ' + (err?.message || String(err)));
        console.error('[ASC]', err);
    }

    document.getElementById('ama-review-loading').style.display = 'none';
    document.getElementById('ama-review-generate').disabled = false;
}

// ── Chip feedback ──
function amaHandleChip(chip, mode) {
    const group = chip.dataset.group;
    const val   = chip.dataset.val;
    const containerId = mode === 'customer' ? '#ama-customer-result' : '#ama-review-result';
    document.querySelectorAll(`${containerId} [data-group="${group}"]`).forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    if (val === 'good') return;
    const maps = {
        length:          { shorter: 'Please make the response shorter and more concise.', longer: 'Please make the response longer and more thorough.' },
        technical:       { less: 'Please simplify — less technical language, easier for the customer to understand.', more: 'Please add more technical detail and specifics.' },
        'review-length': { shorter: 'Please shorten this response.', longer: 'Please make this response a bit longer.' }
    };
    const refineMsg = maps[group]?.[val];
    if (refineMsg) amaRefineSendMsg(mode, refineMsg);
}

// ── Refinement send ──
async function amaRefineSend(mode) {
    const inputId = mode === 'customer' ? 'ama-customer-refine-input' : 'ama-review-refine-input';
    const msg = document.getElementById(inputId).value.trim();
    if (!msg) return;
    document.getElementById(inputId).value = '';
    amaRefineSendMsg(mode, msg);
}

async function amaRefineSendMsg(mode, msg) {
    const history       = mode === 'customer' ? amaCustomerHistory : amaReviewHistory;
    const systemPrompt  = mode === 'customer' ? amaCustomerSystemPrompt() : amaReviewSystemPrompt();
    const responseBoxId = mode === 'customer' ? 'ama-customer-response-text' : 'ama-review-response-text';
    const threadId      = mode === 'customer' ? 'ama-customer-thread' : 'ama-review-thread';
    const sendBtnId     = mode === 'customer' ? 'ama-customer-refine-send' : 'ama-review-refine-send';
    const refineInputId = mode === 'customer' ? 'ama-customer-refine-input' : 'ama-review-refine-input';

    const thread = document.getElementById(threadId);
    const userBubble = document.createElement('div');
    userBubble.style.cssText = 'text-align:right;margin-bottom:6px;';
    userBubble.innerHTML = `<span style="display:inline-block;background:#FDF4F0;border:1px solid #E8C4B0;border-radius:10px;padding:5px 10px;font-size:11px;color:#7A3520;max-width:85%;">${escapeHTML(msg)}</span>`;
    thread.appendChild(userBubble);

    const responseBox = document.getElementById(responseBoxId);
    const previousText = responseBox.textContent;
    responseBox.style.opacity = '0.45';

    history.push({ role: 'user', content: msg });
    document.getElementById(sendBtnId).disabled = true;
    document.getElementById(refineInputId).disabled = true;

    try {
        const reply = await amaCallAPI(systemPrompt, history);
        history.push({ role: 'assistant', content: reply });
        responseBox.textContent = reply;
        responseBox.style.opacity = '1';

        const aiBubble = document.createElement('div');
        aiBubble.style.cssText = 'text-align:left;margin-bottom:8px;';
        aiBubble.innerHTML = `<span style="display:inline-block;background:#eafaf1;border:1px solid #c3e6cb;border-radius:10px;padding:5px 10px;font-size:11px;color:#1a6b3a;max-width:85%;">✓ Updated</span>`;
        thread.appendChild(aiBubble);
        thread.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
function amaResetCustomer() {
    amaCustomerHistory = [];
    amaCustomerLocation = null;
    document.getElementById('ama-loc-inperson').classList.remove('active');
    document.getElementById('ama-loc-phone').classList.remove('active');
    document.getElementById('ama-question-input').value = '';
    document.getElementById('ama-context-input').value = '';
    document.getElementById('ama-customer-result').style.display = 'none';
    document.getElementById('ama-customer-loading').style.display = 'none';
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

// ── Follow-up question — appends answer below existing response ──
async function amaFollowUpSend() {
    const input    = document.getElementById('ama-customer-followup-input');
    const question = input.value.trim();
    if (!question) return;

    input.value    = '';
    input.disabled = true;
    document.getElementById('ama-customer-followup-send').disabled = true;
    document.getElementById('ama-customer-followup-loading').style.display = 'block';

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

        const block = document.createElement('div');
        block.style.cssText = 'margin-top:10px;padding:10px 12px;background:#FDF4F0;border:1px solid #E8C4B0;border-radius:8px;font-size:13px;color:#2d3748;line-height:1.6;';
        block.textContent = reply;

        const copyBtn = document.createElement('button');
        copyBtn.type      = 'button';
        copyBtn.textContent = 'Copy';
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
        console.error('[ASC]', err);
    }

    document.getElementById('ama-customer-followup-loading').style.display = 'none';
    input.disabled = false;
    document.getElementById('ama-customer-followup-send').disabled = false;
    input.focus();
}

function amaResetReview() {
    amaReviewHistory = [];
    amaReviewSentiment = null;
    document.getElementById('ama-review-positive').classList.remove('active');
    document.getElementById('ama-review-negative').classList.remove('active');
    document.getElementById('ama-review-input').value = '';
    document.getElementById('ama-review-context-input').value = '';
    document.getElementById('ama-review-result').style.display = 'none';
    document.getElementById('ama-review-loading').style.display = 'none';
    document.getElementById('ama-review-thread').innerHTML = '';
    document.getElementById('ama-review-refine-input').value = '';
    document.querySelectorAll('#ama-review-result .ama-chip').forEach(c => c.classList.remove('selected'));
}

// ── Copy flash ──
function amaCopyFlash(btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
}

// ── API call ──
async function amaCallAPI(systemPrompt, messages) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: 'asc_amaCall', systemPrompt, messages },
            (response) => {
                if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
                if (response?.success) resolve(response.data);
                else reject(new Error(response?.error || 'Unknown error'));
            }
        );
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

## OUR FREE SERVICES (always mention relevant ones naturally — especially in drop-off mode):
• Free courtesy check with every visit (always "courtesy check," never "inspection")
• Free brake check
• Free alignment check
• Free AC performance check
• Free computer / diagnostic code check
• Free second opinions — no obligation, no pressure
• Free nitrogen top-offs and air for tires
• Free full-service at the gas pumps
• Free car wash certificate
• Free White Glove Concierge: free pickup and delivery from home, work, or anywhere they need
• Free rides home while we service their vehicle
• Free loaner vehicles (by appointment — very popular)
• WiFi waiting area
• Maintenance and light repairs available evenings, Saturdays, and Sundays

## OUR VALUE:
We deliver dealership-level expertise and equipment at an independent shop price. Every visit includes a free courtesy check. We help customers plan ahead so they avoid costly surprises. We never pressure — we educate.

## CARDINAL PLAZA SHELL BRAND DNA:
- Calm, educational tone — no fear, no pressure
- Customer autonomy: we inform, they decide
- Outcome-focused: Safety, Reliability, Predictability
- Plain language — no jargon unless the customer uses it first
- Warm and genuinely helpful, never salesy
- Hospitality mindset: every guest should leave feeling cared for

## SERVICE APPROACH — T0 / T6 / T12:
T0 = Today / immediate | T6 = about 6 months from now | T12 = about a year from now
Use soft language — "about six months," "at your next visit" — never hard deadlines.

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
When a customer asks about a service that's on this schedule, always state the CPS interval and — when vehicle data is loaded — where their specific vehicle stands relative to that interval.

## REQUIRED VOCABULARY:
- "oil service" (never "oil change")
- "courtesy check" (never "inspection")
- "automotive technician" (never just "technician")
- "preventive care" (never "preventive maintenance")
- "address" or "service" (never "fix")
- "concern" or "issue" (never "problem")
- "recommend" or "suggest" (never "must" or "have to")

## CRITICAL — WHEN REPAIR ORDER DATA IS PROVIDED:
If FULL REPAIR ORDER DATA is included in the message, you MUST use it. Reference the actual findings and technician notes by name. Do NOT give generic answers about "common causes" or "possibilities" when you have the real data. Answer as someone who already knows exactly what was found on this specific vehicle.

## RESPONSE STYLE:
Write the response as something the service advisor can say aloud or read directly to the customer. Warm, conversational, clear. Not a list of bullet points unless specifically asked for. Lead with the person, not the car.

If vehicle context is provided, use it to add specificity where genuinely relevant. If it doesn't add anything meaningful, don't force it.`;
}

function amaReviewSystemPrompt() {
    return `You are the Google Review Response assistant for Cardinal Plaza Shell, a premium automotive service center at 8334 Old Keene Mill Rd, Springfield, VA 22152 (703-451-8373 • cardinalplazashell.com).

You write Google review responses on behalf of the shop. Every response must feel personal, warm, and specific — never template-sounding.

## CARDINAL PLAZA SHELL — WHO WE ARE:
We are a full-service automotive shop in Springfield, VA staffed by ASE certified automotive technicians and experienced service advisors. We invest in professional-grade diagnostic equipment and the latest technology to serve our customers at the highest level. We are a hospitality business as much as an automotive business — every guest is treated like family.

## OUR FOUR PROMISES (weave in naturally — never list them):
• To be your trusted advisor
• To help you make the best decisions possible for you
• To provide a unique, no-pressure, transparent, educational environment
• To place the safety of you and your family as our primary goal

## OUR FREE SERVICES (mention relevant ones naturally for Google keyword richness):
• Free courtesy check with every visit
• Free brake check, alignment check, AC check, computer/diagnostic scan
• Free second opinions — no obligation
• Free nitrogen top-offs and tire air
• Free full-service at the gas pumps
• Free car wash certificate
• Free White Glove Concierge: pickup/delivery from home or work, free rides home, free loaners (by appointment)
• WiFi waiting area
• Open evenings, Saturdays, and Sundays

## OUR EQUIPMENT & EXPERTISE:
• ASE certified automotive technicians
• Virginia DEQ certified for emission-related repairs
• State-approved Virginia Safety and Emission Inspection Station
• Latest Hunter alignment equipment
• OE factory scan tools and ADAS calibration equipment
• Autel scan tools and calibration equipment
• OE factory programming and software updates
• Professional-grade diagnostics across all makes and models

## OUR VALUE PROPOSITION:
We deliver dealership-level expertise and equipment at an independent shop price — with a level of personal care and transparency that dealerships simply can't match. We educate customers rather than pressure them. Every visit includes a free courtesy check. Open evenings and weekends.

## FOR POSITIVE REVIEWS:
- Thank the customer genuinely and warmly — celebrate with them, commiserate with what they experienced
- Reference something specific from their review so it feels personal
- Reinforce our values, our team, and/or a relevant free service naturally
- Mention our location (Springfield, VA) and a specific service when it flows naturally
- Keep it warm and personal — 3–5 sentences typically
- Never start with "Thank you for your review" — it's overused. Start differently every time.

## FOR NEGATIVE REVIEWS:
- Lead with genuine empathy — commiserate with the customer's experience first, before anything else
- Thank them sincerely for taking the time to share their feedback — it helps us improve
- Never be defensive, dismissive, or robotic
- Acknowledge their experience with real compassion — make them feel heard
- Take responsibility where appropriate
- Offer a clear path forward: call us directly at 703-451-8373, ask to speak with Scott, or email service@cardinalplazashell.com
- End with a genuine invitation to give us another chance
- NEVER use tired phrases like "We apologize for any inconvenience" or "We strive to provide"
- NEVER produce the same structure twice

## GOOGLE ALGORITHM OPTIMIZATION:
- Naturally mention specific services: oil service, brake service, tire rotation, wheel alignment, AC service, engine diagnostics, courtesy check, etc.
- Reference our location: Springfield, VA; Springfield/Burke/Fairfax/Northern Virginia area
- Mention our name: Cardinal Plaza Shell
- Include credential signals: ASE certified, professional diagnostics, experienced technicians

## CRITICAL RULES:
- Respond with ONLY the review response text — no labels, no preamble, no explanation
- Never start two responses the same way
- Write like a real person who genuinely cares about every customer`;
}

// ==================== TEKMETRIC INTEGRATION ====================

// ── State ──────────────────────────────────────────────────────────
let tmLoadedData = null;   // Currently loaded RO data (shared across all tools)

// ── Init ───────────────────────────────────────────────────────────
window.addEventListener('load', initTekMetric);

function initTekMetric() {
    // Search button — open/close inline RO search
    document.getElementById('tm-search-btn')?.addEventListener('click', tmToggleROSearch);

    // Test connection on startup
    tmSetStatus('checking', 'Connecting…');
    tmTestConnection();

    // Start monitoring active tab URL for TekMetric RO pages
    startURLMonitoring();

    // Close search dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const wrap = document.getElementById('tm-ro-search-wrap');
        if (!wrap?.classList.contains('open')) return;
        const btn = document.getElementById('tm-search-btn');
        if (!wrap.contains(e.target) && !btn?.contains(e.target)) {
            tmCloseROSearch();
        }
    });
}

// ── URL Monitoring ─────────────────────────────────────────────────
let lastRoId = null;

function startURLMonitoring() {
    // Check current tab immediately
    checkCurrentTab();
    
    // Monitor tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.url) {
            checkTabURL(changeInfo.url);
        }
    });
    
    // Monitor tab switches
    chrome.tabs.onActivated.addListener(() => {
        checkCurrentTab();
    });
    
    // Poll every 2 seconds as backup (in case events are missed)
    setInterval(checkCurrentTab, 2000);
}

function checkCurrentTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]?.url) {
            checkTabURL(tabs[0].url);
        }
    });
}

function checkTabURL(url) {
    // Extract RO ID from TekMetric URL
    const match = url.match(/\/repair-orders\/(\d+)/);
    const isTekMetric = url.includes('tekmetric.com');
    const isPaymentPage = /\/repair-orders\/\d+\/(?:[^/?#]+\/)*payments?(?:\/|$)/i.test(url);

    if (match) {
        const roId = match[1];
        if (roId !== lastRoId) {
            lastRoId = roId;
            console.log('[ASC] Detected RO ID in URL:', roId);
            tmAutoFetchRO(roId);
        }
        // Feed into Scheduling Wizard
        swCheckURL(url);
        // Auto-switch to Scheduling Wizard on payment page (once per RO)
        if (isPaymentPage && roId !== swLastPaymentRoId) {
            swLastPaymentRoId = roId;
            openTool('sw');
        }
    } else if (!isTekMetric) {
        // Only clear when navigating away from TekMetric entirely
        if (lastRoId !== null) {
            lastRoId = null;
            swLastPaymentRoId = null;
            tmClearLoaded();
        }
    }
    // If still on TekMetric but not on an RO page, keep existing context loaded
}

async function tmAutoFetchRO(roId) {
    console.log('[ASC] Auto-fetching RO:', roId);

    chrome.runtime.sendMessage(
        { action: 'asc_tmGetRO', roNumber: roId },
        response => {
            if (response?.success) {
                tmLoadRO(response.data);
            } else {
                console.error('[ASC] Auto-fetch failed:', response?.error);
                tmSetStatus('error', 'Failed to load RO');
            }
        }
    );
}

// ── Status indicator ───────────────────────────────────────────────
function tmSetStatus(state, text) {
    const dot  = document.getElementById('tm-dot');
    const span = document.getElementById('tm-status-text');
    if (!dot || !span) return;
    dot.className = `tm-dot ${state}`;
    span.textContent = text;
}

function tmTestConnection() {
    chrome.runtime.sendMessage(
        { action: 'asc_tmTestConnection' },
        response => {
            if (response?.success) {
                tmSetStatus('connected', `Connected · ${response.data.shopName}`);
            } else {
                tmSetStatus('error', 'Connection error');
            }
        }
    );
}

// ── Search ─────────────────────────────────────────────────────────
// ── Load RO into all tools ─────────────────────────────────────────
function tmLoadRO(data) {
    tmLoadedData = data;

    // Show green loaded banner (hub screen)
    const bannerText = `RO #${data.summary.roNumber} · ${data.summary.customer} · ${data.summary.vehicle}`;
    const hubBanner = document.getElementById('tm-banner');
    document.getElementById('tm-banner-text').textContent = bannerText;
    hubBanner.classList.add('active');

    // Also sync vehicle pills in all tools
    amaUpdateTMPill();
    const vcaPill = document.getElementById('vca-vehicle-pill');
    const vcaTxt  = document.getElementById('vca-vehicle-text');
    if (vcaPill && vcaTxt) { vcaTxt.textContent = data.summary.vehicle; vcaPill.classList.add('active'); }
    const swPill = document.getElementById('sw-vehicle-pill');
    const swTxt  = document.getElementById('sw-vehicle-text');
    if (swPill && swTxt) { swTxt.textContent = data.summary.vehicle; swPill.classList.add('active'); }
    const kaPill = document.getElementById('ka-vehicle-pill');
    const kaTxt  = document.getElementById('ka-vehicle-pill-text');
    if (kaPill && kaTxt) { kaTxt.textContent = `${data.summary.vehicle}${data.summary.odometer ? ' · ' + data.summary.odometer : ''}`; kaPill.classList.add('active'); }
    // Auto-populate whichever tool is currently active
    tmPopulateActiveTab();
    rocUpdateFromTM();
}

function tmPopulateActiveTab() {
    if (!tmLoadedData) return;
    // If SW is currently open, trigger its load
    const activeTool = document.getElementById('screen-tool')?.dataset.currentTool;
    if (activeTool === 'sw' && lastRoId && swLoadingRoId !== lastRoId && !(swRoData?.roId === lastRoId && swServicesRendered)) {
        swLoadRO(lastRoId);
    }
    if (activeTool === 'roc') rocUpdateFromTM();
}

function tmClearLoaded() {
    tmLoadedData = null;
    document.getElementById('tm-banner').classList.remove('active');
    ['vca-vehicle-pill','sw-vehicle-pill','ama-vehicle-pill','ka-vehicle-pill'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
}

// ── RO Search Dropdown ──────────────────────────────────────────────
let _roSearchDebounce = null;

function tmToggleROSearch() {
    const wrap = document.getElementById('tm-ro-search-wrap');
    if (!wrap) return;
    if (wrap.classList.contains('open')) {
        tmCloseROSearch();
    } else {
        wrap.classList.add('open');
        const input = document.getElementById('tm-ro-search-input');
        if (input) {
            input.value = '';
            input.focus();
            tmRunROSearch('');
        }
    }
}

function tmCloseROSearch() {
    const wrap = document.getElementById('tm-ro-search-wrap');
    if (wrap) wrap.classList.remove('open');
    clearTimeout(_roSearchDebounce);
}

(function initROSearchInput() {
    // Wire up the input after DOM is ready
    window.addEventListener('load', () => {
        const input = document.getElementById('tm-ro-search-input');
        if (!input) return;
        input.addEventListener('input', () => {
            clearTimeout(_roSearchDebounce);
            _roSearchDebounce = setTimeout(() => tmRunROSearch(input.value), 300);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') tmCloseROSearch();
        });
    });
})();

function tmRunROSearch(query) {
    const results = document.getElementById('tm-ro-search-results');
    if (!results) return;
    results.innerHTML = '<div class="tm-ro-result-loading">Searching…</div>';
    chrome.runtime.sendMessage(
        { action: 'asc_searchLiveROs', query: query.trim() },
        (response) => {
            if (!response?.success) {
                results.innerHTML = '<div class="tm-ro-result-empty">Search failed. Try again.</div>';
                return;
            }
            const items = response.data || [];
            if (items.length === 0) {
                results.innerHTML = '<div class="tm-ro-result-empty">No open ROs found.</div>';
                return;
            }
            results.innerHTML = items.map(item => {
                const roLabel = `RO #${item.roNumber || item.id}`;
                const customer = item.customerName || '';
                const vehicle = item.vehicle || '';
                const sub = [customer, vehicle].filter(Boolean).join(' · ');
                return `<div class="tm-ro-result" data-ro-id="${item.id}">
                    <span class="tm-ro-result-top">${roLabel}</span>
                    ${sub ? `<span class="tm-ro-result-sub">${sub}</span>` : ''}
                </div>`;
            }).join('');
            results.querySelectorAll('.tm-ro-result').forEach(el => {
                el.addEventListener('click', () => {
                    const roId = el.dataset.roId;
                    if (roId) {
                        tmCloseROSearch();
                        lastRoId = roId;
                        tmAutoFetchRO(roId);
                    }
                });
            });
        }
    );
}

// ── escapeHTML helper (if not already defined) ─────────────────────
if (typeof escapeHTML === 'undefined') {
    function escapeHTML(str) {
        return String(str || '')
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;');
    }
}

// ==================== SCHEDULING WIZARD ====================

let swRoData = null;
let swVehicleHistory = null;
let swPmrrData = null;
let swAppointmentCounts = {};
let swSelectedDate = null;
let swSelectedTime = null;
let swSelectedType = null;
let swSelectedServices = [];
let swSelectedColor = 'navy';
let swWeekOffset = 0;
let swTargetDate = null;
let swSelectedMonthInterval = null;
let swLastPaymentRoId = null;

function initSchedulingWizard() {
    // Navigation
    document.getElementById('sw-s1-continue')?.addEventListener('click', () => swGoToStep(2));
    document.getElementById('sw-s2-back')?.addEventListener('click', () => swGoToStep(1));
    document.getElementById('sw-s2-continue')?.addEventListener('click', () => swGoToStep(3));
    document.getElementById('sw-s3-back')?.addEventListener('click', () => swGoToStep(2));
    document.getElementById('sw-s3-confirm')?.addEventListener('click', swConfirmAppointment);
    document.getElementById('sw-s3-copy')?.addEventListener('click', swCopySummary);
    document.getElementById('sw-open-scheduler')?.addEventListener('click', swOpenScheduler);
    document.getElementById('sw-restart')?.addEventListener('click', swClearAndRestart);

    // Custom service add
    const customInput = document.getElementById('sw-custom-service-input');
    const customAddBtn = document.getElementById('sw-custom-service-add');
    function swAddCustomService() {
        const val = customInput?.value.trim();
        if (!val) return;
        swAddCustomServiceItem(val);
        if (!swSelectedServices.includes(val)) swSelectedServices.push(val);
        swPersistState();
        customInput.value = '';
        customInput.focus();
    }
    customAddBtn?.addEventListener('click', swAddCustomService);
    customInput?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); swAddCustomService(); } });

    // Type buttons — filter times
    document.querySelectorAll('[data-swtype]').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('[data-swtype]').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            swSelectedType = this.dataset.swtype;
            swApplyTypeFilter();
            swPersistState();
            swValidateStep1();
        });
    });

    // Color options — updated for swatch layout
    document.querySelectorAll('[data-swcolor]').forEach(opt => {
        opt.addEventListener('click', function() {
            document.querySelectorAll('[data-swcolor]').forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
            swSelectedColor = this.dataset.swcolor;
        });
    });

    // Week navigation
    document.getElementById('sw-week-prev')?.addEventListener('click', () => {
        if (!swTargetDate) return;
        swWeekOffset--;
        swPopulateDays(swTargetDate);
    });
    document.getElementById('sw-week-next')?.addEventListener('click', () => {
        if (!swTargetDate) return;
        swWeekOffset++;
        swPopulateDays(swTargetDate);
    });

    // Open full scheduler from step 1
    document.getElementById('sw-open-scheduler-s1')?.addEventListener('click', swOpenScheduler);

    // Restore state from storage
    chrome.storage.local.get(['swDate','swTime','swType','swServices'], result => {
        if (result.swDate) swSelectedDate = result.swDate;
        if (result.swTime) swSelectedTime = result.swTime;
        if (result.swType) swSelectedType = result.swType;
        if (result.swServices) swSelectedServices = result.swServices;
        swApplyTypeFilter(); // rebuilds time grid and shows/hides note based on restored type
    });
}

function swPersistState() {
    chrome.storage.local.set({
        swDate: swSelectedDate, swTime: swSelectedTime,
        swType: swSelectedType, swServices: swSelectedServices
    });
}

function swGoToStep(n) {
    for (let i = 1; i <= 3; i++) {
        const ind = document.getElementById(`sw-step-ind-${i}`);
        const screen = document.getElementById(`sw-screen-${i}`);
        ind.classList.remove('active','complete');
        screen.classList.remove('active');
        if (i < n) ind.classList.add('complete');
        else if (i === n) {
            ind.classList.add(n === 3 ? 'complete' : 'active');
            screen.classList.add('active');
        }
    }
    if (n === 3) swUpdateSummary();
}

function swValidateStep1() {
    const btn = document.getElementById('sw-s1-continue');
    if (btn) btn.disabled = !(swSelectedDate && swSelectedTime && swSelectedType);
    swUpdateStep1Summary();
}

function swUpdateStep1Summary() {
    const box = document.getElementById('sw-step1-summary');
    if (swSelectedDate && swSelectedTime && swSelectedType) {
        box.style.display = 'block';
        const d = new Date(swSelectedDate);
        document.getElementById('sw-s1-date').textContent = d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
        document.getElementById('sw-s1-time').textContent = swSelectedTime;
        document.getElementById('sw-s1-type').textContent = swSelectedType === 'dropoff' ? 'Drop-Off' : 'Wait';
    } else {
        box.style.display = 'none';
    }
}

function swUpdateSummary() {
    if (!swSelectedDate) return;
    const d = new Date(swSelectedDate);
    document.getElementById('sw-s3-date').textContent = d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    document.getElementById('sw-s3-time').textContent = swSelectedTime || '—';
    const projMi = swGetProjectedMileage(swSelectedMonthInterval || swPmrrData?.recommendedInterval || 6);
    document.getElementById('sw-s3-mileage').textContent = projMi ? `${projMi.toLocaleString()} mi` : '—';
    document.getElementById('sw-s3-type').textContent = swSelectedType === 'dropoff' ? 'Drop-Off' : 'Wait';
    const box = document.getElementById('sw-s3-services');
    box.innerHTML = swSelectedServices.length === 0
        ? '<p style="font-size:13px;color:#6c757d;padding:4px 0;">No services selected</p>'
        : swSelectedServices.map(s => `<div style="padding:7px 0;border-bottom:1px solid #dee2e6;font-size:13px;">• ${s}</div>`).join('');
}

function swPopulateDays(startDate) {
    const grid = document.getElementById('sw-day-grid');
    if (!grid) return;
    grid.innerHTML = ''; // always rebuild so week offset and selection apply

    const dayNames = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // Find the Monday of the week containing startDate, then apply offset
    let cur = new Date(startDate);
    cur.setDate(cur.getDate() + (swWeekOffset * 7));
    while (cur.getDay() !== 1) cur.setDate(cur.getDate() + 1);

    // Update week label
    const weekEnd = new Date(cur); weekEnd.setDate(weekEnd.getDate() + 4);
    const weekLabel = document.getElementById('sw-week-label');
    if (weekLabel) {
        const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        weekLabel.textContent = `${fmt(cur)} – ${fmt(weekEnd)}`;
    }

    for (let i = 0; i < 5; i++) {
        const d = new Date(cur); d.setDate(d.getDate() + i);
        const key = d.toISOString().split('T')[0];
        const count = swAppointmentCounts[key] || 0;
        const card = document.createElement('div');
        card.className = 'sw-day-card';
        card.dataset.fullDate = d.toISOString();
        if (swSelectedDate && new Date(swSelectedDate).toISOString().split('T')[0] === key) {
            card.classList.add('selected');
        }
        card.innerHTML = `<div class="sw-day-name">${dayNames[d.getDay()]}</div><div class="sw-day-date">${d.getDate()}</div><div class="sw-day-month">${monthNames[d.getMonth()]}</div><div class="sw-day-appts">${count} appts</div>`;
        card.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('.sw-day-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            swSelectedDate = this.dataset.fullDate;
            swPersistState(); swValidateStep1();
        });
        grid.appendChild(card);
    }
}

function swPopulateTimes() {
    const grid = document.getElementById('sw-time-grid');
    if (!grid) return;
    grid.innerHTML = ''; // always rebuild so filter applies correctly

    const ALL_TIMES = ['6:00 AM','7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM',
                       '1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM','8:00 PM','9:00 PM'];

    const times = ALL_TIMES;

    times.forEach(t => {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'sw-time-btn'; btn.textContent = t;
        if (t === swSelectedTime) btn.classList.add('selected');
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('.sw-time-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            swSelectedTime = t;
            swPersistState(); swValidateStep1();
        });
        grid.appendChild(btn);
    });

}

// Rebuild time grid when type changes
function swApplyTypeFilter() {
    swPopulateTimes();
}


let swServicesRendered = false;

function swPopulateServices(force) {
    const repeatList = document.getElementById('sw-repeat-services');
    const predictiveList = document.getElementById('sw-predictive-services');
    if (!repeatList || !predictiveList) return;

    // Only re-render if forced or not yet rendered (preserves checkbox state)
    if (swServicesRendered && !force) return;
    swServicesRendered = true;

    repeatList.innerHTML = '';
    const declined = (swRoData?.jobs || []).filter(j => {
        const s = String(j?.authorizationStatus || j?.authorizedStatus || j?.approvalStatus || j?.appointmentStatus || j?.jobStatus || j?.status || '').trim().toUpperCase();
        if (j?.authorized === false || j?.declined === true || j?.isDeclined === true) return true;
        return s.includes('DECLIN') || s.includes('REJECT') || s.includes('UNAUTH');
    });
    if (declined.length === 0) {
        repeatList.innerHTML = '<p style="font-size:12px;color:#6c757d;padding:8px 0;">No declined services</p>';
    } else {
        declined.forEach(job => repeatList.appendChild(swCreateServiceItem(job.name, 'declined')));
    }

    predictiveList.innerHTML = '';
    if (swPmrrData?.services?.length > 0) {
        swPmrrData.services.forEach(s => predictiveList.appendChild(swCreateServiceItem(s.name, s.category)));
    } else {
        predictiveList.innerHTML = '<p style="font-size:12px;color:#6c757d;padding:8px 0;">No predictive services — open an RO to generate recommendations</p>';
    }
}

function swAddCustomServiceItem(name) {
    const list = document.getElementById('sw-custom-services-list');
    if (!list) return;
    // Don't duplicate
    if ([...list.querySelectorAll('.sw-custom-name')].some(el => el.textContent === name)) return;
    const row = document.createElement('div');
    row.className = 'sw-service-item';
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'sw-custom-name sw-service-name'; nameSpan.textContent = name;
    nameSpan.style.flex = '1';
    const badge = document.createElement('span');
    badge.className = 'sw-service-badge'; badge.textContent = 'added';
    badge.style.background = '#D97757';
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button'; removeBtn.textContent = '✕';
    removeBtn.style.cssText = 'background:none;border:none;color:#999;cursor:pointer;font-size:14px;padding:0 2px;line-height:1;';
    removeBtn.addEventListener('click', () => {
        swSelectedServices = swSelectedServices.filter(s => s !== name);
        swPersistState();
        row.remove();
    });
    row.appendChild(nameSpan); row.appendChild(badge); row.appendChild(removeBtn);
    list.appendChild(row);
}

function swCreateServiceItem(name, category) {
    const item = document.createElement('label');
    item.className = 'sw-service-item';
    item.style.cursor = 'pointer';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = swSelectedServices.includes(name);
    cb.addEventListener('change', function() {
        if (this.checked) { if (!swSelectedServices.includes(name)) swSelectedServices.push(name); }
        else { swSelectedServices = swSelectedServices.filter(s => s !== name); }
        swPersistState();
    });
    const nameSpan = document.createElement('span');
    nameSpan.className = 'sw-service-name'; nameSpan.textContent = name;
    const badge = document.createElement('span');
    const badgeClass = category === 'no-history' ? 'no-history' : category;
    const badgeLabel = category === 'overdue' ? 'urgent' : category === 'essential' ? 'essential' : category === 'recommended' ? 'recommended' : category === 'no-history' ? 'no history' : category;
    badge.className = `sw-service-badge ${badgeClass}`; badge.textContent = badgeLabel;
    item.appendChild(cb); item.appendChild(nameSpan); item.appendChild(badge);
    return item;
}

let swLoadingRoId = null; // Lock: prevents concurrent or duplicate loads

// Compute interval + mileage from vehicle history math alone (instant, no Claude call)
function swBuildDefaultPMRR(roData, vehicleHistory) {
    const currentMileage = roData.mileage || 0;
    let defaultInterval = 6;
    if (vehicleHistory?.avgMilesPerDay && vehicleHistory.avgMilesPerDay > 0) {
        const milesPerMonth = vehicleHistory.avgMilesPerDay * 30.44;
        defaultInterval = Math.max(1, Math.min(18, Math.round(6000 / milesPerMonth)));
    }
    const estMileage = currentMileage + Math.round((vehicleHistory?.avgMilesPerDay || 33) * 30.44 * defaultInterval);
    return { recommendedInterval: defaultInterval, estimatedMileage: estMileage, services: [] };
}

async function swLoadRO(roId) {
    // Already loaded this RO and services are rendered — nothing to do
    if (swRoData?.roId === roId && swServicesRendered) return;
    // Already in the middle of loading this RO — don't fire again
    if (swLoadingRoId === roId) return;

    swLoadingRoId = roId;
    swServicesRendered = false;

    try {
        // Step 1: Fetch RO data
        const roResp = await swSend({ action:'asc_swFetchRO', roId });
        if (!roResp.success) throw new Error(roResp.error);
        swRoData = roResp.data;
        swRoData.roId = roId;

        // Step 2: Fetch vehicle history (needs vehicleId from step 1)
        const histResp = await swSend({ action:'asc_swFetchVehicleHistory', vehicleId: swRoData.vehicle.id });
        if (histResp.success) {
            swVehicleHistory = histResp.data;
        } else {
            console.log('[ASC] Vehicle history fetch failed:', histResp.error);
        }

        // Step 3: Build default PMRR instantly from math — no Claude call needed yet
        swPmrrData = swBuildDefaultPMRR(swRoData, swVehicleHistory);

        // Step 4: Render UI immediately with defaults — user sees scheduler right away
        swDisplayRO();
        await swLoadScheduleData();
        swLoadingRoId = null; // Release lock — UI is now interactive

        // Step 5: Run Claude PMRR in background; update services list when done
        swLoadPMRRBackground(roId);
    } catch (err) {
        console.error('SW: Failed to load RO', err);
        swLoadingRoId = null;
    }
}

// Fetches AI service recommendations after the UI is already visible
async function swLoadPMRRBackground(roId) {
    const predictiveList = document.getElementById('sw-predictive-services');
    if (predictiveList) {
        predictiveList.innerHTML = '<p style="font-size:12px;color:#9494A8;padding:8px 0;">Generating recommendations...</p>';
    }
    try {
        const pmrrResp = await swSend({ action:'asc_swGeneratePMRR', data: swRoData, vehicleHistory: swVehicleHistory });
        // Bail if the RO changed while Claude was thinking
        if (swRoData?.roId !== roId) return;
        if (pmrrResp.success) swPmrrData = pmrrResp.data;
        swServicesRendered = false;
        swPopulateServices();
    } catch (err) {
        console.error('SW: PMRR background failed', err);
        if (predictiveList) {
            predictiveList.innerHTML = '<p style="font-size:12px;color:#6c757d;padding:8px 0;">Could not load recommendations.</p>';
        }
    }
}

function swDisplayRO() {
    const recommended = swPmrrData.recommendedInterval || 6;
    if (!swSelectedMonthInterval) swSelectedMonthInterval = recommended;

    // Populate month select
    const monthSel = document.getElementById('sw-interval-months');
    if (monthSel) {
        monthSel.innerHTML = '';
        for (let m = 1; m <= 12; m++) {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m === 1 ? '1 month' : `${m} months`;
            if (m === swSelectedMonthInterval) opt.selected = true;
            monthSel.appendChild(opt);
        }
        monthSel.classList.toggle('sw-interval-recommended', swSelectedMonthInterval === recommended);
        monthSel.onchange = function() {
            swSelectedMonthInterval = Number(this.value);
            this.classList.toggle('sw-interval-recommended', swSelectedMonthInterval === recommended);
            swWeekOffset = 0;
            swSelectedDate = null;
            swUpdateMileageSelect();
            swUpdateTooltip();
            swUpdateTargetDate();
        };
    }

    swUpdateMileageSelect();
    swUpdateTooltip();
    document.getElementById('sw-interval-box').classList.add('visible');
    const disclaimer = document.getElementById('sw-mileage-disclaimer');
    if (disclaimer) disclaimer.style.display = 'block';
    swWireMileageTooltip();
}

function swGetProjectedMileage(months) {
    const cur = swRoData?.mileage || 0;
    const avg = swVehicleHistory?.avgMilesPerDay;
    if (!Number.isFinite(avg) || avg <= 0) return cur + months * 1000;
    return Math.round(cur + avg * months * 30.4375);
}

function swGetConfidenceLevel() {
    const c = swVehicleHistory?.dataPointCount || 0;
    const s = swVehicleHistory?.historySpanDays || 0;
    if (!c || c < 2 || !s) return { label: 'Low', tone: 'low' };
    if (c >= 5 && s >= 365) return { label: 'High', tone: 'high' };
    if (c >= 3 && s >= 180) return { label: 'Medium', tone: 'medium' };
    return { label: 'Low', tone: 'low' };
}

function swUpdateMileageSelect() {
    const mileageSel = document.getElementById('sw-interval-mileage');
    if (!mileageSel) return;
    const avg = swVehicleHistory?.avgMilesPerDay;
    const cur = swSelectedMonthInterval || swPmrrData?.recommendedInterval || 6;
    mileageSel.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
        const mi = (Number.isFinite(avg) && avg > 0) ? Math.round(avg * m * 30.4375) : m * 1000;
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = mi.toLocaleString() + ' mi';
        if (m === cur) opt.selected = true;
        mileageSel.appendChild(opt);
    }
    mileageSel.onchange = function() {
        swSelectedMonthInterval = Number(this.value);
        swWeekOffset = 0;
        swSelectedDate = null;
        const monthSel = document.getElementById('sw-interval-months');
        if (monthSel) {
            monthSel.value = swSelectedMonthInterval;
            monthSel.classList.toggle('sw-interval-recommended', swSelectedMonthInterval === (swPmrrData?.recommendedInterval || 6));
        }
        swUpdateTooltip();
        swUpdateTargetDate();
    };
}

function swUpdateTooltip() {
    const tip = document.getElementById('sw-mileage-tooltip');
    if (!tip || !swRoData) return;
    const months = swSelectedMonthInterval || swPmrrData?.recommendedInterval || 6;
    const currentMileage = swRoData.mileage || 0;
    const avg = swVehicleHistory?.avgMilesPerDay;
    const cf = swGetConfidenceLevel();
    const confColor = cf.tone === 'high' ? '#16A34A' : cf.tone === 'medium' ? '#D97706' : '#DC2626';

    if (!Number.isFinite(avg) || avg <= 0) {
        const projected = currentMileage + months * 1000;
        tip.innerHTML = `<div style="font-size:10px;font-weight:700;color:#4a5568;margin-bottom:6px;">Estimated (Default)</div><div style="font-size:11px;color:#6c757d;line-height:1.6;">Current: ${currentMileage.toLocaleString()} mi<br>Default: 1,000 mi/month<br>Months: ${months}<br><br>Increase: +${(months * 1000).toLocaleString()}<br><strong>Projected: ${projected.toLocaleString()} mi</strong></div>`;
    } else {
        const mpm = avg * 30.4375;
        const increase = Math.round(mpm * months);
        const projected = currentMileage + increase;
        const spanMonths = swVehicleHistory?.historySpanDays ? Math.round(swVehicleHistory.historySpanDays / 30) : null;
        const dp = swVehicleHistory?.dataPointCount || 0;
        tip.innerHTML = `<div style="display:flex;align-items:center;gap:5px;margin-bottom:6px;"><div style="width:6px;height:6px;border-radius:50%;background:${confColor};flex-shrink:0;"></div><span style="font-size:11px;font-weight:700;color:#4a5568;">${cf.label} Confidence</span></div><hr style="border:none;border-top:1px solid #f0f0f0;margin:4px 0 6px;"><div style="font-size:11px;color:#6c757d;line-height:1.6;">${dp} data points · ${spanMonths || '—'} months history<br><br>Current: ${currentMileage.toLocaleString()} mi<br>Avg: ${avg.toFixed(1)} mi/day · ${Math.round(mpm).toLocaleString()} mi/month<br>Months: ${months}<br><br>Increase: +${increase.toLocaleString()}<br><strong>Projected: ${projected.toLocaleString()} mi</strong></div>`;
    }
}

function swWireMileageTooltip() {
    const btn = document.getElementById('sw-mileage-tip-btn');
    const tip = document.getElementById('sw-mileage-tooltip');
    if (!btn || !tip || btn.dataset.wired === '1') return;
    btn.dataset.wired = '1';

    function positionTip() {
        const r = btn.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        let top = r.bottom + 6;
        if (top + 170 + 8 > vh) top = r.top - 170 - 6;
        top = Math.max(8, Math.min(top, vh - 170 - 8));
        let left = r.right - 220;
        left = Math.max(8, Math.min(left, vw - 220 - 8));
        tip.style.top = top + 'px';
        tip.style.left = left + 'px';
    }

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = tip.classList.toggle('active');
        if (open) positionTip();
    });
    document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !tip.contains(e.target)) tip.classList.remove('active');
    });
}

function swUpdateTargetDate() {
    const months = swSelectedMonthInterval || swPmrrData?.recommendedInterval || 6;
    const target = new Date();
    target.setMonth(target.getMonth() + months);
    swTargetDate = target;
    swPopulateDays(target);
}

async function swLoadScheduleData() {
    const months = swPmrrData?.recommendedInterval || 6;
    if (!swSelectedMonthInterval) swSelectedMonthInterval = months;
    const target = new Date(); target.setMonth(target.getMonth() + months);
    swTargetDate = target;
    swWeekOffset = 0;
    const start = new Date(target); start.setDate(start.getDate() - 7);
    const end = new Date(target); end.setDate(end.getDate() + 14);

    try {
        const cr = await swSend({ action:'asc_swFetchAppointmentCounts',
            startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] });
        if (cr.success) swAppointmentCounts = cr.data;
    } catch(e) { swAppointmentCounts = {}; }
    swPopulateDays(target);
    swPopulateServices();
}

async function swConfirmAppointment() {
    const btn = document.getElementById('sw-s3-confirm');
    if (!swSelectedDate || !swSelectedTime) { alert('Please select a date and time.'); return; }
    if (!swRoData) { alert('No RO loaded. Please open a repair order in TekMetric first.'); return; }

    btn.disabled = true; btn.textContent = '⏳ Creating...';
    const startDT = new Date(swSelectedDate);
    const [time, period] = swSelectedTime.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    startDT.setHours(h, m, 0, 0);
    const endDT = new Date(startDT); endDT.setHours(endDT.getHours() + 1);
    const custName = `${swRoData.customer.firstName||''} ${swRoData.customer.lastName||''}`.trim();
    const vehicle = `${swRoData.vehicle.year||''} ${swRoData.vehicle.make||''} ${swRoData.vehicle.model||''}`.trim();
    const apptData = {
        shopId: swRoData.shopId, customerId: swRoData.customer.id, vehicleId: swRoData.vehicle.id,
        title: `Appointment Copilot - ${custName} - ${vehicle}`,
        description: swSelectedServices.length > 0 ? swSelectedServices.join(', ') : 'Routine maintenance',
        startTime: startDT.toISOString(), endTime: endDT.toISOString(),
        mileage: swGetProjectedMileage(swSelectedMonthInterval || swPmrrData?.recommendedInterval || 6),
        appointmentType: swSelectedType, color: swSelectedColor
    };

    try {
        const resp = await swSend({ action:'asc_swCreateAppointment', appointmentData: apptData });
        if (resp.success) {
            btn.textContent = 'Appointment Created!';
            btn.style.background = '#28a745';
        } else throw new Error(resp.error);
    } catch (err) {
        alert(`Failed to create appointment: ${err.message}`);
        btn.disabled = false; btn.textContent = 'Confirm Appointment';
    }
}

function swCopySummary() {
    const btn = document.getElementById('sw-s3-copy');
    if (!swSelectedDate || !swSelectedTime) { alert('Please select a date and time first.'); return; }

    const d = new Date(swSelectedDate);
    const dateStr = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
    const custName = swRoData ? `${swRoData.customer.firstName||''} ${swRoData.customer.lastName||''}`.trim() : '';
    const vehicle  = swRoData ? `${swRoData.vehicle.year||''} ${swRoData.vehicle.make||''} ${swRoData.vehicle.model||''}`.trim() : '';

    const serviceLines = swSelectedServices.length > 0
        ? swSelectedServices.map(s => `  • ${s}`).join('\n')
        : '  • Routine maintenance';

    const summaryBlock = [
        custName  ? `Name: ${custName}` : '',
        vehicle   ? `Vehicle: ${vehicle}` : '',
        `Date: ${dateStr}`,
        `Time: ${swSelectedTime}`,
        `Type: ${swSelectedType === 'dropoff' ? 'Drop-Off' : 'Wait'}`,
        swPmrrData?.estimatedMileage ? `Est. Mileage: ${swPmrrData.estimatedMileage.toLocaleString()} mi` : '',
        `\nServices Planned:\n${serviceLines}`
    ].filter(Boolean).join('\n');

    // Explainer appended to copied text — visible to customer but not shown in the tool UI
    const explainer = `\n\nEven though you will receive reminders from us, we wanted you to have this information in case you want to add the appointment to your scheduler. If this can't happen, no big deal.`;

    const copyText = summaryBlock + explainer;

    navigator.clipboard.writeText(copyText).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.style.background = '#28a745';
        setTimeout(() => { btn.textContent = orig; btn.style.background = '#D97757'; }, 2200);
    }).catch(() => alert('Copy failed. Please try manually.'));
}

function swOpenScheduler(e) {
    if (e) e.preventDefault();
    const shopId = swRoData?.shopId || ASC_SHOP_ID;

    // Compute the Monday of the currently displayed week (mirrors swPopulateDays logic)
    const base = swTargetDate ? new Date(swTargetDate) : new Date();
    base.setDate(base.getDate() + (swWeekOffset * 7));
    while (base.getDay() !== 1) base.setDate(base.getDate() + 1);

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const currentTab = tabs[0];
        const tabUrl = currentTab?.url || '';
        const baseUrl = tabUrl.includes('sandbox.tekmetric.com') ? 'https://sandbox.tekmetric.com' : 'https://shop.tekmetric.com';
        const url = `${baseUrl}/admin/shop/${shopId}/appointments?date=${encodeURIComponent(base.toISOString())}&view=week`;
        chrome.tabs.create({ url, index: (currentTab?.index ?? 0) + 1 });
    });
}

function swClearAndRestart() {
    swSelectedDate = null; swSelectedTime = null; swSelectedType = null;
    swSelectedServices = []; swSelectedColor = 'navy';
    chrome.storage.local.remove(['swDate','swTime','swType','swServices']);
    document.querySelectorAll('.sw-day-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.sw-time-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('[data-swtype]').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.sw-service-item input').forEach(cb => { cb.checked = false; });
    document.querySelectorAll('[data-swcolor]').forEach(o => {
        o.classList.remove('selected');
        if (o.dataset.swcolor === 'navy') o.classList.add('selected');
    });
    // Clear custom services
    const customList = document.getElementById('sw-custom-services-list');
    if (customList) customList.innerHTML = '';
    const customInput = document.getElementById('sw-custom-service-input');
    if (customInput) customInput.value = '';
    // Hide drop-off note and reset time grid
    const note = document.getElementById('sw-time-note');
    if (note) note.style.display = 'none';
    swApplyTypeFilter();
    document.getElementById('sw-step1-summary').style.display = 'none';
    const confirmBtn = document.getElementById('sw-s3-confirm');
    if (confirmBtn) { confirmBtn.textContent = 'Confirm Appointment'; confirmBtn.style.background = ''; confirmBtn.disabled = false; }
    // Reset load lock and state so a new RO can be loaded after restart
    swLoadingRoId = null;
    swServicesRendered = false;
    swWeekOffset = 0;
    swSelectedMonthInterval = null;
    swLastPaymentRoId = null;
    swGoToStep(1);
}

// Hook into hub's TekMetric URL monitoring to also trigger SW RO loading
function swCheckURL(url) {
    const match = url.match(/tekmetric\.com.*\/repair-orders\/(\d+)/);
    if (match) {
        const roId = match[1];
        if (swLoadingRoId === roId) return; // Already loading
        if (swRoData?.roId === roId && swServicesRendered) return; // Already loaded
        swLoadRO(roId);
    }
}

function swSend(message) {
    return new Promise(resolve => chrome.runtime.sendMessage(message, resolve));
}

// ══════════════════════════════════════════════════════
//  MOMENT OF CULTURE (MOC)
// ══════════════════════════════════════════════════════

const MOC_LESSONS = [
  { num:1, title:"Integrity as a Daily Choice", body:"Integrity isn't a single action — it's the accumulation of small, consistent choices. Every time you answer a phone call, greet a customer, or explain a repair, you're building a story about who you are. Customers may not remember every detail you explain, but they will always remember the calm, honest way you helped them feel in a moment when they were uncertain.\n\nYour work today is simple: show them they matter. When you build an estimate, when you speak about safety, when you reassure them about their concerns — you are shaping the reputation of the shop and of yourself. Excellence isn't the goal; consistency is. Excellence emerges from that consistency." },
  { num:2, title:"The Power of Being Steady", body:"Every customer comes in with a story you don't know yet — stress, budget worries, frustration, confusion. What they're really looking for is a steady hand. They want someone who doesn't get rattled, who listens fully, and who can translate complexity into clarity.\n\nYour steadiness isn't just professionalism; it's a gift. When a customer feels your calm presence, their nervous system settles. They begin to trust. And trust is the foundation of every successful conversation you will ever have." },
  { num:3, title:"Joy in the Craft", body:"This job can be challenging — there are moments when phones don't stop ringing, estimates grow long, and issues pile up. But inside the challenge is something beautiful: the joy of helping someone get back on the road with confidence and relief. Few roles offer such frequent opportunities to make someone's day noticeably better.\n\nYou are not just processing repairs. You are creating experiences. When you treat the interaction as a craft — something you shape with intention — the work becomes more fulfilling, and the customer feels the difference immediately." },
  { num:4, title:"Discipline Sets You Free", body:"There's a truth about discipline that most people misunderstand: it isn't a restriction; it's freedom. The structure we follow is not meant to box you in. It exists so you can serve confidently without guessing, without wondering, without feeling lost.\n\nEvery time you follow the structure — gathering priorities, organizing findings, presenting options clearly — you free your mind to be present with the customer. That presence is what elevates you from 'someone doing a job' to 'someone making a difference.'" },
  { num:5, title:"People First, Cars Second", body:"The vehicle may be what arrives at the shop, but a person arrives with it — someone who needs reassurance, clarity, and partnership. Before you talk about fluid exchanges or safety items, make sure the customer feels heard. Simple acknowledgment goes further than most advisors realize.\n\nWhen you start with the person, the conversation that follows becomes easier, clearer, and more productive. People want to work with someone who sees them, not someone who is just looking at their car." },
  { num:6, title:"Begin Again, Every Visit", body:"It does not matter how yesterday went. It does not matter how the morning started. Every customer gives you a chance to begin again — to choose patience, kindness, and clarity. Today's interactions aren't shaped by last week's stress unless you let them be.\n\nThe beautiful thing about this work is that excellence is built one interaction at a time. You don't need perfection; you need presence. Begin again. Begin fresh. The customer in front of you deserves your best — and you're capable of giving it." },
  { num:7, title:"Listening Creates Trust", body:"The most powerful tool you have is not a repair order or a tablet — it's your ability to listen. When a customer explains their concern, they're really telling you where they're worried, where they're uncertain, where they need guidance.\n\nSlow the conversation down. Ask one more question. Reflect what you heard. Customers trust the advisor who listens better than anyone else. That trust makes the rest of your work smoother." },
  { num:8, title:"Confidence Without Pressure", body:"Confidence doesn't require pressure. When you present findings clearly, respectfully, and calmly, the customer feels in control — and that's when they make their best decisions. Your role isn't to push; it's to illuminate.\n\nYou're here to bring clarity. When your tone is steady and your wording is simple, decisions feel natural rather than forced. That is how long-term trust is built." },
  { num:9, title:"Your Work Shapes the Technician's Success", body:"Technicians depend on the accuracy and completeness of your communication. When you translate customer concerns cleanly, when you build strong concern notes, when you capture good details — you make their work more efficient and more precise.\n\nGreat advisors and great technicians lift each other up. You are part of the same mission: helping the customer feel safe and confident behind the wheel." },
  { num:10, title:"Courage in the Hard Conversations", body:"Some days you will need to deliver news a customer doesn't want to hear — a large estimate, a safety issue, or a repair that can't wait. It's natural to feel a little nervous in those moments. But remember: honesty delivered with kindness is never wrong.\n\nYou are not giving them bad news; you are giving them clarity. When you stand in honesty and respect, customers sense your sincerity — and that transforms even the hardest conversations." },
  { num:11, title:"Respect Earns Respect", body:"Customers will mirror the tone you set. When you speak with respect — even when they are stressed, tired, or frustrated — you elevate the entire interaction. Respect is contagious, and it begins with you.\n\nEarn it with your presence, your steadiness, and your commitment to doing what's right. Over time, this builds a reputation that follows you everywhere." },
  { num:12, title:"Predictability Reduces Stress", body:"One of the greatest gifts you give customers is predictability. When you help them understand what's needed today, what's coming in six months, and what's ahead next year, their stress melts away. They finally feel like they're in control.\n\nThis is the power of planning together — turning vehicle care from reactive chaos into steady, predictable partnership. You're the guide who makes that possible." },
  { num:13, title:"Your Role is Leadership", body:"Whether you realize it or not, you are a leader. Customers look to you for answers. Technicians look to you for clarity. Managers look to you for stability. Leadership isn't a title — it's the behavior you choose moment by moment.\n\nLead with presence. Lead with clarity. Lead with a calm tone. Those behaviors define how others experience you and how the entire shop flows." },
  { num:14, title:"Pride in the Details", body:"Accuracy matters. A VIN digit, a mileage entry, a note about a symptom — these small details shape the quality of the entire visit. Taking pride in the details isn't about perfectionism; it's about respecting the customer and the team.\n\nWhen you take the extra 30 seconds to verify something, you send a message: 'Your vehicle deserves accuracy.' That message becomes your signature." },
  { num:15, title:"You Matter More Than You Know", body:"This job can sometimes feel thankless. You're juggling phones, customers, technicians, parts quotes — and it may seem like no one notices your effort. But the truth is this: you matter more than you know. The experience customers have is shaped by you. The efficiency of the shop is shaped by you. The trust we build is shaped by you.\n\nNever forget the impact you have. You help people move safely through their lives. That is meaningful work. Be proud of it." },
  { num:16, title:"The Quiet Discipline of Showing Up", body:"Mental toughness isn't about the dramatic moments. It lives in something smaller and harder: the choice to show up fully every single morning, regardless of how the morning started.\n\nThe customers who walk through that door today don't know if you're tired. They don't know if it was a hard week. They are counting on you to be present. Mental toughness is the discipline to give them that — not because it's easy, but because it's right." },
  { num:17, title:"Gratitude Changes the Interaction", body:"Before this customer pulled into the lot, they had a choice. They could have gone anywhere. They chose us. That is not a small thing. Start every interaction from that place — not from obligation, not from routine, but from genuine appreciation that this person trusted us with their vehicle and their time.\n\nGratitude is a lens you keep on. It changes the words you choose, the pace you bring, the way you listen. A service advisor who is genuinely grateful communicates something no script could ever produce: that this customer matters." },
  { num:18, title:"The Barrel Shows Up Before They're Called", body:"The difference between a barrel and a bullet isn't talent. It's awareness. Bullets respond to what's in front of them. Barrels see the whole room. They notice the customer who's been waiting quietly. They see the technician who's backed up. They spot the problem before it becomes a crisis.\n\nToday, before you reach for your first repair order, take ten seconds to scan the floor. What does the team need? What is the customer in the waiting area experiencing? Being a barrel isn't a title — it's a habit." },
  { num:19, title:"Own It Completely", body:"When something goes wrong — a miscommunication, a missed promise, a delay — the instinct is to explain, to share context, to share blame. Resist that instinct. The customer in front of you doesn't need an explanation first. They need to feel that someone is accountable.\n\nOwning it completely doesn't mean accepting fault for things outside your control. It means being the person who says 'I'm going to make this right' before they ask for it. Accountability is not weakness. It is the highest form of professionalism." },
  { num:20, title:"Bloom Where You Are Planted", body:"There is no perfect condition waiting around the corner. Not the perfect shift, the perfect customer, the perfect RO. Excellence is built in the conditions in front of you — today, with this team, on this floor.\n\nThe advisors who grow the fastest are the ones who decide to thrive where they are. They don't wait for a better opportunity to start performing at their best. They understand that the best opportunity is the one they're standing in right now. Bloom here. Bloom today." },
  { num:21, title:"All-In Means No Back Door", body:"There is a subtle difference between someone who is doing the job and someone who has decided to master it. The difference is not talent. It's commitment. The all-in advisor has burned the boats. There is no back door, no half-effort held in reserve.\n\nCommitment lives in the small, consistent choices: the road test you don't skip, the follow-up call you make, the repair order you build with precision even when you're tired. Show up today as someone who has already decided. That decision changes everything." },
  { num:22, title:"Stay Restless", body:"Yesterday was a good day. Maybe a great one. Good. Now ask yourself: what can be better today? Complacency doesn't arrive loudly. It slips in on the back of success, disguised as satisfaction.\n\nThe best advisors are the ones who are never fully satisfied. Not because they're unhappy, but because they're curious. They keep asking: what else does this customer need? What part of this interaction could be sharper? Restlessness is not dissatisfaction. It is the engine of growth." },
  { num:23, title:"The Conversation Is the Service", body:"The repair is not the product. The experience is the product. Any shop with the right equipment can perform the repair. What cannot be replicated is the quality of the conversation that surrounds it — the way you welcomed this person, the way you listened, the way you explained without making them feel judged.\n\nHospitality is not a policy — it is a posture. It asks: how can I make this person feel, right now, that they are on the right side of this situation? Answer that question in every interaction today." },
  { num:24, title:"Break the Rule That Limits You", body:"Somewhere along the way, you may have absorbed a rule about what a service advisor does or doesn't do, what is or isn't possible here. Some of those rules are real. Most of them aren't. They exist only because no one has questioned them.\n\nWho wrote the rule that you can't know every customer by name? Who wrote the rule that a neighborhood shop can't be the most innovative in the industry? Today, identify one rule that's been limiting you — and quietly decide not to honor it anymore." },
  { num:25, title:"Look Under the Rock", body:"There is a world of information available in every customer interaction if you are paying attention. The bumper sticker tells you something. The way they check their phone tells you something. The car seat in the back tells you something.\n\nBefore your first customer today, decide to be a collector. Not a processor. Collect the dots. Write them down. Connect them to what you already know about this person. That is hospitality at its highest level." },
  { num:26, title:"The 100% Decision", body:"At some point today, there will be a moment where the easier path is the 98% path. Maybe it's skipping a follow-up call because the day is already busy. Maybe it's presenting findings in a shorter way than the situation calls for. These moments don't feel like decisions. But they are.\n\nThe 100% decision is the one you make before the day gives you permission. Make it now, before the first customer arrives. Take your decision." },
  { num:27, title:"Close the Gap", body:"Every one of us has a gap between where we are and where we know we could be. The gap is not a criticism — it is a map. It shows you exactly where to put your energy.\n\nWhat is one thing, right now, where you know you're performing below your own standard? Name it. Not to judge yourself — but to give yourself direction. Close the gap today, one interaction at a time." },
  { num:28, title:"The Trusted Advisor Standard", body:"The difference between a service advisor and a trusted advisor is a single question the customer is asking themselves: 'Does this person have my best interest at heart?' If they believe the answer is yes, they will follow your recommendations. They will return. They will send their family.\n\nYou earn that trust through consistency — through every call-back you make, every honest assessment you deliver, every time you say 'that can wait' when it actually can. The trusted advisor doesn't need to sell. People buy from people they trust." },
  { num:29, title:"Steadiness Is a Service", body:"When a customer arrives frustrated, the trained response is the opposite of matching their energy. Slow down. Breathe. Let your calm be the thing that changes the room.\n\nMental toughness in customer communication is not about winning. It is about staying steady when everything around you is not. When a customer feels your composure, their nervous system settles. Trust opens. The conversation becomes possible." },
  { num:30, title:"Find What You Are Grateful For Today", body:"Not every day feels like a gift. Some mornings are hard before they begin. The gratitude we talk about is not the easy kind — the kind you feel when things go well. It is the harder kind: the choice to find something real to be grateful for even when the day hasn't earned it yet.\n\nThis morning, find one thing. The team you're about to work alongside. The skills someone spent time teaching you. The fact that people trust us enough to bring us their vehicles and their families. That trust is not a given. It is a gift." },
  { num:31, title:"Pass It Forward", body:"Somewhere in your history here, someone took a few extra minutes for you. They answered the question you were embarrassed to ask. They gave you a piece of knowledge that made the next interaction easier.\n\nToday, look for the opportunity to do that for someone else. Not because it's your job description — because giving back to the middle is what makes this place different. Barrels are made, not born. And they are often made by someone who took the time to show them what was possible." },
  { num:32, title:"Your Name Is on This Work", body:"Every repair order you build, every customer note you write, every recommendation you make — your name is on it. Not metaphorically. Literally. And the quality of that work reflects something real about who you are as a professional.\n\nThis is not pressure. It is an invitation. The invitation to do work you are proud to put your name on, every single time. Your standards are your signature. Make it one worth having." },
  { num:33, title:"The Team Makes the Experience", body:"A customer's experience is not shaped by one person. It is shaped by every handoff, every greeting, every moment behind the scenes they never see. When the team operates well together, the customer feels it — even if they can't name what they're feeling.\n\nYour role today is not just to serve your customers. It is to make the team around you more effective. Cover for each other. Communicate clearly. Lift the people next to you. The team experience becomes the customer experience. Every time." },
  { num:34, title:"Energy Is Contagious", body:"You don't just serve customers with your words. You serve them with your energy. The mood you carry into the building in the morning spreads — to your teammates, to the waiting room, to the customer who is already nervous before they say hello.\n\nBefore you walk in today, take a breath. Decide what energy you're bringing. Choose it deliberately. The people inside are going to feel it either way — you might as well choose something good." },
  { num:35, title:"Keep Asking Better Questions", body:"The complacent advisor has a set of questions they ask every customer, and they ask them the same way, every time. The growing advisor is always looking for the one question they haven't thought to ask yet — the one that surfaces the concern the customer didn't know how to bring up.\n\nAfter your first customer today, ask yourself: is there a question I could have asked that would have given me a better picture? Write it down. Try it tomorrow. This is how you become sharper — through the steady discipline of asking one better question than last time." },
  { num:36, title:"The Feeling Is the Memory", body:"A customer will forget the specifics of today's visit faster than you might think. The mileage, the services performed, the technical findings — these fade quickly. What does not fade is the feeling they carried out the door.\n\nThis is the only scorecard that matters in the long run. Not the repair order total. The feeling they had walking to their car. At the close of every interaction today, ask yourself: what feeling am I sending this person home with? Make sure it's the right one." },
  { num:37, title:"Care for Your Teammates Out Loud", body:"Guests feel the team before they feel anything else. They walk in and sense, within seconds, whether the people here enjoy each other. Whether there is respect in the room. You cannot manufacture that — but you can contribute to it, intentionally, today.\n\nSay something to a teammate this morning before the first customer arrives. Not a work question. Something human. Check in. Express appreciation. The team that takes care of each other out loud creates an environment that guests can feel the moment they walk through the door." },
  { num:38, title:"Review the History", body:"Thirty seconds. That is all it takes to review a customer's history before they arrive. And in those thirty seconds, you transform the interaction from a first meeting into a continuation of a relationship.\n\nIn a world where most people feel like a number, the customer who walks in and is greeted by someone who actually knows their history will not go anywhere else. Make the thirty seconds a habit. It is one of the highest-return investments you will make today." },
  { num:39, title:"Your Potential Has a Deadline", body:"The saddest thing in this industry is not someone who tried and fell short. It is someone with great potential who, years from now, is still described as having great potential — unrealized, unacted upon, waiting for a better moment. The better moment is not coming. The better moment is always now.\n\nWhat is one thing you have been meaning to get better at that you haven't started yet? Name it. Write it down. Take one step toward it today. Not the whole journey. One step. That is how potential becomes something real." },
  { num:40, title:"Share What You Know", body:"You have learned things in this work that someone else on this team doesn't know yet. A technique, a phrase that works with a certain type of customer, an insight about a particular vehicle system. That knowledge has value — not just for you, but for the whole shop.\n\nYou are not a true expert until you can transfer what you know to another person. Teaching is the final step of mastery. Today, look for the chance to share something you know. Because that is how this team gets better together." },
  { num:41, title:"The Walk-In Deserves Your Best", body:"The walk-in customer did not plan to be here. Their morning is already disrupted. They may be frustrated, uncertain, or pressed for time before they even say a word to you. What they need from you in the first sixty seconds is not a process — it is a person.\n\nMake eye contact. Acknowledge them immediately. Let them feel that their arrival mattered. The walk-in who feels welcomed becomes the loyal customer. You decide which one this becomes." },
  { num:42, title:"Words Are Tools", body:"The words you choose are not neutral. 'You need' sounds like a command. 'We recommend' sounds like guidance. 'This is urgent' sounds like pressure. 'This is something worth knowing about' sounds like partnership. Same information — completely different experience.\n\nToday, slow down and listen to your own language. You are not just communicating facts; you are shaping how the customer feels about those facts. Choose words that respect their intelligence and their autonomy. That is the highest form of communication we practice here." },
  { num:43, title:"The Follow-Up Is the Relationship", body:"Most advisors are excellent in the moment. The great ones are excellent after the moment — the follow-up call, the check-in, the simple question: 'How is the vehicle running?' That call takes ninety seconds and communicates something no script can teach: that you actually care what happens after they leave.\n\nFollow-up is not a sales tactic. It is evidence of a relationship. Customers who receive a follow-up call are not just satisfied — they are loyal. And loyalty, built one call at a time, is what sustains a shop like ours for decades." },
  { num:44, title:"Slow Down to Speed Up", body:"When the floor gets busy, the instinct is to move faster — shorter explanations, quicker handoffs, condensed conversations. This instinct costs you more time than it saves. The customer who didn't fully understand calls back and creates more work. The customer who felt rushed returns with doubt.\n\nSlow the key moments down — the greeting, the explanation of findings, the exit conversation. Three extra minutes of quality now prevents fifteen minutes of recovery later. Slowing down is not inefficiency. It is the highest form of operational skill." },
  { num:45, title:"Standards Are Not Optional", body:"Standards exist because every customer deserves the same quality of experience — not just the ones who are easy, not just the ones who are loyal. Every customer. Every visit. Every time.\n\nWhen you hold to the standard on a hard day, when no one is watching, when you're tired — that is when your character is actually being built. The standard is not what you do when things are easy. It is what you do when they aren't. That version of you is the professional you are becoming." },
  { num:46, title:"Curiosity Is a Competitive Advantage", body:"The advisor who stays curious about their craft — about vehicle systems, about customer psychology, about better ways to communicate — will always outperform the one who stops learning. Curiosity is not a personality trait. It is a professional decision.\n\nAsk a technician something you don't know today. Read one article about a vehicle system you encounter often. Ask a teammate how they handle a specific type of customer. Invest ten minutes in learning and you will be better at every interaction that follows." },
  { num:47, title:"Handle the Hard Customer with Grace", body:"The difficult customer is not your adversary. They are your teacher. Every time someone challenges you, tests your patience, or questions your recommendation, you have a choice: react from ego, or respond from confidence. Only one of those builds the relationship.\n\nGrace under pressure is a learnable skill. It begins with a breath, continues with a neutral tone, and arrives at the simple question: 'What does this person actually need right now?' When you answer that question honestly, most difficult conversations find their own resolution." },
  { num:48, title:"The Exit Is as Important as the Entry", body:"You understand the importance of a great first impression. The exit impression is equally powerful — and often overlooked. How a customer feels in their final sixty seconds with you is what they carry home, what they tell their family, what they write in a review.\n\nBefore they leave, make sure they know what was done, what's coming, and when they'll hear from you next. The exit conversation is your last chance to make them feel like a guest — and the first moment of their next visit." },
  { num:49, title:"Silence Is Information", body:"Not everything a customer communicates is verbal. The hesitation before they say 'okay.' The pause after you share a recommendation. The distracted look while you're explaining. These silences are not nothing — they are information. They are telling you where confusion or concern lives.\n\nWhen you notice a silence, don't rush past it. Pause with them. Ask: 'Does that make sense?' The customer who felt heard in their silence becomes the customer who trusts you completely." },
  { num:50, title:"Be the Reason Someone Recommends Us", body:"Every customer who leaves here satisfied is a potential ambassador. They have colleagues, family members, neighbors — all of whom have vehicles, all of whom need a shop they can trust. The referral doesn't come from the oil service. It comes from the experience around it.\n\nBe the reason someone recommends us. Not through a loyalty program. Through the quality of their experience with you — the care, the clarity, the follow-through. One remarkable interaction plants a seed that grows into years of referrals." },
  { num:51, title:"The Small Moments Are the Big Moments", body:"Leadership, hospitality, trust — these things sound large. But they are built entirely out of small moments. The greeting when someone first walks in. The way you handle being interrupted. The note you add to a customer file that means someone will remember them next time.\n\nDon't wait for the big moment to show who you are. The small moments are where character actually lives. And enough small moments, stacked on top of each other with intention, become a career that people remember and respect." },
  { num:52, title:"Know Your Why", body:"On the hardest days, what keeps you grounded is not a process or a script. It is knowing why you're here. Not just the paycheck — the deeper reason. Maybe it's the team. Maybe it's the craft. Maybe it's the knowledge that you are genuinely helping people stay safe on the road.\n\nSpend a moment today reconnecting with your why. Write it down if it helps. When the afternoon gets difficult, your why is what you'll reach for. And when you find it, everything becomes a little clearer." },
  { num:53, title:"The Expert Earns the Right to Recommend", body:"Customers don't want to be sold. They want to be guided — but only by someone they believe knows what they're talking about. Your expertise is not just what you know; it is the confidence with which you communicate it and the care with which you share it.\n\nInvest in your knowledge every single week. The service advisor who understands what a brake fluid exchange actually does — and can explain it simply — earns the right to recommend it. The expert who communicates with warmth is unstoppable." },
  { num:54, title:"Protect the Team's Reputation", body:"Every advisor on this floor is representing more than themselves. They are carrying the reputation of every technician, every person who has ever served a customer well here. When you do your job with excellence, you honor that collective work.\n\nAnd when you notice something that might damage that reputation — a miscommunication, a customer who seems unsatisfied — address it. Don't walk past it. The team's reputation is everyone's responsibility, and protecting it is one of the most important things you will ever do here." },
  { num:55, title:"Deferred Is Not Dismissed", body:"When a customer declines a recommendation, it is not the end of the conversation — it is a chapter break. They said not now. That means later is still possible. The key is how you document it, how you return to it at the next visit, and how you make them feel about the choice they made today.\n\nNever make a customer feel judged for deferring. Respect the decision. Document it clearly. Return to it at the right time with the right tone. That is how trust is maintained through a 'no' — and how the 'yes' eventually comes." },
  { num:56, title:"First, Make Them Feel Safe", body:"Before a customer can hear any recommendation you make, they have to feel safe. Safe that you're not going to take advantage of them. Safe that you understand their situation. Safe that you're on their side.\n\nEverything else — the findings, the recommendations — comes after that feeling is established. Don't rush past it. The customer who feels safe will hear you. The one who doesn't will resist everything that follows, no matter how accurate or reasonable it is. Make safety your first service of the day, every day." },
  { num:57, title:"Precision Is a Form of Respect", body:"When you take the time to get the details right — the customer's name, their vehicle history, the exact symptom they described — you are communicating something without words: that they matter enough to get this right.\n\nIn a world of shortcuts, precision stands out. The customer who notices that you remembered the detail they mentioned six months ago will never question whether this shop cares about them. Precision is the clearest answer you can give." },
  { num:58, title:"Make the Waiting Room Feel Like a Living Room", body:"The waiting room is not a holding area. It is part of the experience. The customer sitting there is forming an opinion in real time — watching how the desk handles pressure, listening to how the phone is answered.\n\nAcknowledge them. Update them proactively. Make them feel like a guest in someone's home, not a number in a queue. The advisor who manages the waiting room with warmth turns wait time into trust-building time." },
  { num:59, title:"Growth Happens at the Edge of Comfort", body:"The skills you have right now were built in uncomfortable moments — the first time you had a difficult conversation, the first time you gave a large recommendation, the first time you handled a customer complaint. Growth doesn't happen in the familiar. It happens at the edge.\n\nToday, look for the moment where you could take the easier path or the better path. Take the better one. Every edge you step to expands what is comfortable for you tomorrow." },
  { num:60, title:"Grateful for Everything, Entitled to Nothing", body:"This is our operating system. Not a rule — a lens. When you look at your work through gratitude, everything shifts. The difficult customer becomes an opportunity. The busy afternoon becomes evidence of trust. The team around you becomes a gift, not a given.\n\nEntitlement closes the mind. Gratitude opens it. The advisor who is genuinely grateful for their work, their team, and their customers will outperform — not through hustle alone, but through the quality of presence that gratitude produces. Begin here, every single day." }
];


let mocCurrentIdx  = -1;
let mocHistory     = [];
let mocLessonText  = '';
let mocInitialized = false;
let mocLastQuestion = '';
let mocLastAnswer   = '';

// ── Navigation helpers ──
function mocShowS1() {
  document.getElementById('moc-s1').classList.add('moc-active');
  document.getElementById('moc-s2').classList.remove('moc-active');
  document.getElementById('moc-s3').classList.remove('moc-active');
}
function mocShowS2() {
  document.getElementById('moc-s1').classList.remove('moc-active');
  document.getElementById('moc-s2').classList.add('moc-active');
  document.getElementById('moc-s3').classList.remove('moc-active');
  document.getElementById('moc-answer-scroll').scrollTop = 0;
}

function mocShowS3() {
  document.getElementById('moc-s1').classList.remove('moc-active');
  document.getElementById('moc-s2').classList.remove('moc-active');
  document.getElementById('moc-s3').classList.add('moc-active');
}

function mocOpenS3() {
  mocRenderHistory();
  mocShowS3();
}

// ── Persistent history helpers ──
const MOC_HISTORY_KEY = 'mocAnswerHistory';
const MOC_HISTORY_MAX = 10;

function mocGetHistory() {
  return new Promise(resolve => {
    chrome.storage.local.get([MOC_HISTORY_KEY], r => {
      resolve(Array.isArray(r[MOC_HISTORY_KEY]) ? r[MOC_HISTORY_KEY] : []);
    });
  });
}

async function mocSaveToHistory(question, answer, lessonNum, lessonTitle) {
  const history = await mocGetHistory();
  history.unshift({ question, answer, lessonNum, lessonTitle, ts: Date.now() });
  if (history.length > MOC_HISTORY_MAX) history.splice(MOC_HISTORY_MAX);
  chrome.storage.local.set({ [MOC_HISTORY_KEY]: history });
}

async function mocClearHistory() {
  chrome.storage.local.remove(MOC_HISTORY_KEY);
  mocRenderHistory();
  // Hide prev answers button since history is now empty
}

async function mocRenderHistory() {
  const scroll = document.getElementById('moc-s3-scroll');
  const history = await mocGetHistory();

  scroll.innerHTML = '';

  if (!history.length) {
    const empty = document.createElement('div');
    empty.className = 'moc-s3-empty';
    empty.textContent = 'No previous answers yet.\nAsk your first culture question to get started.';
    scroll.appendChild(empty);
    return;
  }

  history.forEach((entry, idx) => {
    const card = document.createElement('div');
    card.className = 'moc-hist-card';

    const header = document.createElement('div');
    header.className = 'moc-hist-header';
    header.innerHTML = `
      <div>
        <div class="moc-hist-q">${entry.question}</div>
        <div class="moc-hist-lesson-tag">Lesson #${entry.lessonNum} — ${entry.lessonTitle}</div>
      </div>
      <span class="moc-hist-chevron">▼</span>`;
    header.addEventListener('click', () => card.classList.toggle('open'));

    const body = document.createElement('div');
    body.className = 'moc-hist-body';
    body.innerHTML = `
      <div class="moc-hist-answer">${entry.answer}</div>
      <button class="moc-hist-copy" type="button">Copy</button>`;

    const copyBtn = body.querySelector('.moc-hist-copy');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = `Q: ${entry.question}\n\nA: ${entry.answer}`;
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = '✓ Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 2000);
      });
    });

    card.appendChild(header);
    card.appendChild(body);
    scroll.appendChild(card);
  });
}


function mocGoHub() {
  document.getElementById('screen-moc').classList.remove('active');
  document.getElementById('screen-hub').classList.add('active');
  // Reset all subscreen states so re-entry is always clean S1
  document.getElementById('moc-s1').classList.add('moc-active');
  document.getElementById('moc-s2').classList.remove('moc-active');
  document.getElementById('moc-s3').classList.remove('moc-active');
  mocInitialized = false;
  mocHistory = [];
  mocLastQuestion = '';
  mocLastAnswer = '';
}

// Opens Culture Coach pre-set to a specific lesson index (from teaser)
function mocOpenWithLesson(idx) {
  document.getElementById('screen-hub').classList.remove('active');
  document.getElementById('screen-moc').classList.add('active');
  if (!mocInitialized) {
    mocInitialized = true;
    mocApplyLesson(idx);
    // register listeners same as mocOpen
    document.getElementById('moc-new-btn')  ?.addEventListener('click', mocPickAndRender);
    document.getElementById('moc-send')     ?.addEventListener('click', mocSend);
    document.getElementById('moc-back-btn') ?.addEventListener('click', mocGoHub);
    document.getElementById('moc-prev-btn') ?.addEventListener('click', mocOpenS3);
    document.getElementById('moc-hiw-btn')  ?.addEventListener('click', () => {
      document.getElementById('moc-hiw-modal').classList.add('active');
    });
    document.getElementById('moc-hiw-close')?.addEventListener('click', () => {
      document.getElementById('moc-hiw-modal').classList.remove('active');
    });
    document.getElementById('moc-hiw-modal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('moc-hiw-modal'))
        document.getElementById('moc-hiw-modal').classList.remove('active');
    });
    document.getElementById('moc-suggestions')?.addEventListener('click', function(e) {
      const btn = e.target.closest('.moc-suggest-btn');
      if (btn && !btn.disabled) mocAskSuggestion(btn);
    });
    document.getElementById('moc-input')?.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mocSend(); }
    });
    document.getElementById('moc-input')?.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 72) + 'px';
    });
    document.getElementById('moc-clearq-btn') ?.addEventListener('click', mocGoHome);
  } else {
    mocApplyLesson(idx);
  }
}

function mocOpen() {
  document.getElementById('screen-hub').classList.remove('active');
  document.getElementById('screen-moc').classList.add('active');
  if (!mocInitialized) {
    mocInitialized = true;
    mocPickAndRender();
    // S1 listeners
    document.getElementById('moc-new-btn')  ?.addEventListener('click', mocPickAndRender);
    document.getElementById('moc-send')     ?.addEventListener('click', mocSend);
    document.getElementById('moc-back-btn') ?.addEventListener('click', mocGoHub);
    document.getElementById('moc-prev-btn') ?.addEventListener('click', mocOpenS3);
    document.getElementById('moc-hiw-btn')  ?.addEventListener('click', () => {
      document.getElementById('moc-hiw-modal').classList.add('active');
    });
    document.getElementById('moc-hiw-close')?.addEventListener('click', () => {
      document.getElementById('moc-hiw-modal').classList.remove('active');
    });
    document.getElementById('moc-hiw-modal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('moc-hiw-modal'))
        document.getElementById('moc-hiw-modal').classList.remove('active');
    });
    document.getElementById('moc-suggestions')?.addEventListener('click', function(e) {
      const btn = e.target.closest('.moc-suggest-btn');
      if (btn && !btn.disabled) mocAskSuggestion(btn);
    });
    document.getElementById('moc-input')?.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mocSend(); }
    });
    document.getElementById('moc-input')?.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 72) + 'px';
    });

    // S1 clear button (registered once inside init, safe since mocInitialized guard prevents re-registration)
    document.getElementById('moc-clearq-btn') ?.addEventListener('click', mocGoHome);
  }
}

function mocGoHome() {
  // Return to clean S1 — same lesson, clear input, restore suggestions, hide clear btn
  mocShowS1();
  const input = document.getElementById('moc-input');
  if (input) { input.value = ''; input.style.height = 'auto'; }
  const sugg = document.getElementById('moc-suggestions');
  if (sugg) sugg.style.display = 'flex';
  const clearRow = document.getElementById('moc-clear-row');
  if (clearRow) clearRow.style.display = 'none';
}

function mocNewQuestion() {
  mocGoHome();
}

function mocCopy() {
  const copyText = mocLastQuestion
    ? `Q: ${mocLastQuestion}\n\nA: ${mocLastAnswer}`
    : mocLastAnswer;
  const btn = document.getElementById('moc-copy-btn');
  navigator.clipboard.writeText(copyText).then(() => {
    btn.textContent = '✓ Copied!';
    btn.classList.add('moc-copied');
    setTimeout(() => { btn.textContent = 'Copy Q & A'; btn.classList.remove('moc-copied'); }, 2000);
  });
}

function mocApplyLesson(idx) {
  mocCurrentIdx = idx;
  const lesson = MOC_LESSONS[idx];

  document.getElementById('moc-lesson-num').textContent = `#${lesson.num} of 60`;
  document.getElementById('moc-lesson-intro').textContent =
    'Before we begin today\u2019s work, I want to share something with you to ponder through the day.';

  const bodyEl = document.getElementById('moc-lesson-body');
  bodyEl.innerHTML = '';
  lesson.body.split('\n\n').forEach(para => {
    if (!para.trim()) return;
    const p = document.createElement('p');
    p.textContent = para.trim();
    bodyEl.appendChild(p);
  });

  mocLessonText = `LESSON ${lesson.num} \u2014 ${lesson.title}\n\n${lesson.body}`;
  mocHistory = [];
  mocLastQuestion = '';
  mocLastAnswer   = '';

  mocShowS1();

  const input = document.getElementById('moc-input');
  if (input) { input.value = ''; input.style.height = 'auto'; }

  const sugg = document.getElementById('moc-suggestions');
  if (sugg) sugg.style.display = 'flex';
  mocGenerateSuggestions(lesson);
}

function mocPickAndRender() {
  let idx;
  do { idx = Math.floor(Math.random() * MOC_LESSONS.length); }
  while (idx === mocCurrentIdx);
  mocApplyLesson(idx);
}

async function mocGenerateSuggestions(lesson) {
  const btns = document.querySelectorAll('#moc-suggestions .moc-suggest-btn');
  btns.forEach(b => { b.textContent = '…'; b.disabled = true; });

  const defaults = [
    'I have to give feedback to a teammate who\'s been cutting corners. What\'s the best way to approach that conversation?',
    'A customer is choosing between coming in today vs. scheduling for next week — how should I think about guiding that conversation?',
    'Can you give me three coaching points I can share with a new team member about how to open a conversation with a customer?'
  ];

  try {
    const systemPrompt = `You generate exactly 3 short, practical culture questions for a Cardinal Plaza Shell service advisor to ask their culture coach. The questions must be directly inspired by today's lesson theme. Each question should be one of these types: (1) a real workplace dilemma or decision they face, (2) a choice between two approaches, or (3) a request for coaching points to share with a teammate. Return ONLY a JSON array of 3 strings — no preamble, no markdown, no extra text.`;
    const messages = [{ role: 'user', content: `Today's lesson: "${lesson.title}"\n\n${lesson.body}\n\nGenerate 3 sample questions.` }];
    const response = await fetch(`${ASC_CLOUD_RUN_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'assistant', messages, context: { systemPrompt } })
    });
    const data = await response.json();
    const raw = (data.text || '').trim();
    const questions = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (Array.isArray(questions) && questions.length === 3) {
      btns.forEach((b, i) => { b.textContent = questions[i]; b.disabled = false; });
    } else { throw new Error('bad format'); }
  } catch {
    btns.forEach((b, i) => { b.textContent = defaults[i]; b.disabled = false; });
  }
}

function mocAskSuggestion(btn) {
  const text = btn.textContent;
  document.getElementById('moc-input').value = text;
  const sugg = document.getElementById('moc-suggestions');
  if (sugg) sugg.style.display = 'none';
  mocSend();
}

function mocShowTyping() {
  const scroll = document.getElementById('moc-answer-scroll');
  // Show S2 with typing state
  document.getElementById('moc-question-echo').textContent = mocLastQuestion;
  const answerEl = document.getElementById('moc-answer-text');
  answerEl.innerHTML = '';
  const typing = document.createElement('div');
  typing.className = 'moc-typing';
  typing.id = 'moc-typing-dots';
  const loadImg = document.createElement('img');
  loadImg.src = 'loading.gif';
  loadImg.alt = 'Loading...';
  loadImg.className = 'moc-loading-gif';
  typing.appendChild(loadImg);
  answerEl.appendChild(typing);
  mocShowS2();
}

function mocRemoveTyping() {
  const t = document.getElementById('moc-typing-dots');
  if (t) t.remove();
}

async function mocSend() {
  const input = document.getElementById('moc-input');
  const text = input.value.trim();
  if (!text) return;

  mocLastQuestion = text;
  input.value = '';
  input.style.height = 'auto';

  const sugg = document.getElementById('moc-suggestions');
  if (sugg) sugg.style.display = 'none';

  // Show clear button on S1
  const clearRow = document.getElementById('moc-clear-row');
  if (clearRow) clearRow.style.display = 'block';

  mocHistory.push({ role: 'user', content: text });
  mocShowTyping();
  document.getElementById('moc-send').disabled = true;

  const systemPrompt = `You are the culture coach for Cardinal Plaza Shell, an automotive service center in Springfield, VA. You embody the shop's 14 Fundamentals and serve as a warm, direct, thoughtful advisor to service advisors.

Today's Golden Lesson shared with the team:
---
${mocLessonText}
---

Your role:
- Answer culture questions with warmth, clarity, and grounding in the shop's values
- Help advisors navigate choices between two paths — give clear, practical guidance
- Create specific, actionable coaching points when asked
- Always connect guidance back to CPS values: gratitude, mental toughness, leadership, hospitality, responsibility, expertise
- Use calm, direct language — never preachy, never vague
- Keep responses conversational and practical — 2 to 4 short paragraphs maximum
- Vocabulary: "oil service" not "oil change", "courtesy check" not "inspection", "automotive technician" not just "technician"`;

  try {
    const response = await fetch(`${ASC_CLOUD_RUN_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'assistant', messages: mocHistory, context: { systemPrompt } })
    });
    const data = await response.json();
    const reply = (data.success && data.text) ? data.text : 'Something went wrong. Please try again.';
    mocHistory.push({ role: 'assistant', content: reply });
    mocLastAnswer = reply;
    mocRemoveTyping();
    document.getElementById('moc-answer-text').textContent = reply;
    // Save to persistent history
    const lesson = MOC_LESSONS[mocCurrentIdx];
    mocSaveToHistory(mocLastQuestion, reply, lesson.num, lesson.title);
  } catch {
    mocRemoveTyping();
    const fallback = 'Connection error. Please check your network and try again.';
    mocLastAnswer = fallback;
    document.getElementById('moc-answer-text').textContent = fallback;
  }

  document.getElementById('moc-send').disabled = false;
}


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

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
  document.getElementById('roc-phone-save-btn')         ?.addEventListener('click', rocSavePhone);
  document.getElementById('roc-phone-primary-save-btn') ?.addEventListener('click', rocSavePrimaryPhone);
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

  // Phone — check phone ONLY; do not substitute email.
  // The spec requires a phone number specifically (for the Call/Text preference selector).
  const hasPhone = !!s.hasPhone;
  rocState.intakeVerification.phone = hasPhone;
  rocSetVerify('phone', hasPhone, 'On file', 'Tap to add', hasPhone ? null : 'phone');

  // Multi-phone management (shown when 2+ phones on file)
  const phones = s.phones || [];
  rocRenderPhoneList(phones);

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

function rocRenderPhoneList(phones) {
  const mgmt = document.getElementById('roc-phone-mgmt');
  const list  = document.getElementById('roc-phone-list');
  if (!mgmt || !list) return;

  if (!phones || phones.length < 2) {
    mgmt.style.display = 'none';
    return;
  }

  mgmt.style.display = 'block';

  // Determine initial selected index (primary phone, or first)
  if (rocState.intakeVerification.selectedPhoneIdx == null) {
    rocState.intakeVerification.selectedPhoneIdx = phones.findIndex(p => p.primary) ?? 0;
    if (rocState.intakeVerification.selectedPhoneIdx < 0) rocState.intakeVerification.selectedPhoneIdx = 0;
  }

  list.innerHTML = '';
  phones.forEach((ph, idx) => {
    const item = document.createElement('div');
    item.className = 'roc-phone-item' + (idx === rocState.intakeVerification.selectedPhoneIdx ? ' selected' : '');
    item.dataset.idx = idx;

    const star = document.createElement('span');
    star.className = 'roc-phone-star';
    star.textContent = '★';

    const num = document.createElement('span');
    num.className = 'roc-phone-num';
    num.textContent = ph.number || ph.phoneNumber || '';

    const type = document.createElement('span');
    type.className = 'roc-phone-type-lbl';
    type.textContent = (ph.type || 'Mobile').toLowerCase();

    item.appendChild(star);
    item.appendChild(num);
    item.appendChild(type);
    item.addEventListener('click', () => {
      rocState.intakeVerification.selectedPhoneIdx = idx;
      rocSaveState();
      // Re-render selection state
      list.querySelectorAll('.roc-phone-item').forEach((el, i) => el.classList.toggle('selected', i === idx));
    });
    list.appendChild(item);
  });
}

async function rocSavePrimaryPhone() {
  const phones = tmLoadedData?.summary?.phones;
  if (!phones || phones.length < 2) return;
  const selectedIdx = rocState.intakeVerification.selectedPhoneIdx ?? 0;
  const customerId  = tmLoadedData?.summary?.customerId;
  if (!customerId) {
    showRocError('Could not find customer ID. Update manually in TekMetric.');
    return;
  }
  const btn = document.getElementById('roc-phone-primary-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const updatedPhones = phones.map((ph, i) => ({ ...ph, primary: i === selectedIdx }));
    await rocSend({ action: 'asc_rocUpdateCustomer', customerId, fields: { phones: updatedPhones } });
    if (btn) { btn.disabled = false; btn.textContent = 'Saved'; setTimeout(() => { if (btn) btn.textContent = 'Save Primary to TekMetric'; }, 2000); }
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Primary to TekMetric'; }
    showRocError(`Could not save primary phone: ${err.message}`);
  }
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
  if (!btn) return;
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
    const prefRowEl = document.getElementById('roc-contact-pref-row');
    if (prefRowEl) prefRowEl.style.display = 'block';
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
  if (!btn) return;
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
        <div style="font-size:11px; font-weight:700; color:#9A3412;">${escapeHtml(item.item)}</div>
        <div style="font-size:12px; color:#3a3a3a; line-height:1.5;">${escapeHtml(item.detail)}</div>
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
        <span class="roc-service-name">${escapeHtml(svc.name)}</span>
        <span class="roc-on-ro-badge">On RO</span>
      </div>`;
    }
    // NOTE: No inline onclick — MV3 Content Security Policy blocks inline handlers.
    // The click is handled by event delegation on #roc-intel-services in initRocWizard().
    return `<div class="roc-service-row" id="roc-svc-row-${idx}">
      <span class="roc-service-name">${escapeHtml(svc.name)}</span>
      <button class="roc-add-ro-btn" id="roc-add-ro-${idx}" type="button"
        data-idx="${idx}" data-name="${escapeHtml(svc.name)}">Add to RO</button>
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
    `<div class="roc-chat-bubble ${m.role}">${escapeHtml(m.content).replace(/\n/g, '<br>')}</div>`
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
    rocSaveState();
  }

  typing.remove();
  rocRenderExhaustChat();
  rocExhaustLoading = false;
  if (sendBtn) sendBtn.disabled = false;
}
