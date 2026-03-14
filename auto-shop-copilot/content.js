// Auto Shop Copilot — content.js
// Injects the floating Copilot launcher + contextual Appointment Copilot button on payment pages.

(function () {
  'use strict';

  if (document.getElementById('asc-copilot-launcher')) return;

  const PAYMENT_RE = /\/repair-orders\/\d+\/payment(?:[/?#]|$)/i;
  const INSPECTIONS_RE = /\/repair-orders\/(\d+)\/inspections?(?:[/?#]|$)/i;

  // ── Styles ─────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.id = 'asc-styles';
  style.textContent = `
    @keyframes asc-appt-glow {
      0%   { box-shadow: 0 3px 10px rgba(249,115,22,0.5), 0 0 0 0 rgba(249,115,22,0.45); }
      65%  { box-shadow: 0 3px 10px rgba(249,115,22,0.5), 0 0 0 12px rgba(249,115,22,0); }
      100% { box-shadow: 0 3px 10px rgba(249,115,22,0.5), 0 0 0 0 rgba(249,115,22,0); }
    }
    #asc-appt-btn {
      width: 100%;
      margin-top: 8px;
      padding: 11px 16px;
      background: #F97316;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      letter-spacing: 0.02em;
      animation: asc-appt-glow 2s ease-out infinite;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      transition: transform 0.15s ease, background 0.15s ease;
      box-sizing: border-box;
    }
    #asc-appt-btn:hover {
      background: #EA6D0F;
      transform: translateY(-1px);
    }
    #asc-appt-btn:active {
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);

  // ── Floating Copilot button (original, unchanged) ───────────────
  const floatBtn = document.createElement('button');
  floatBtn.id = 'asc-copilot-launcher';
  floatBtn.textContent = 'Copilot';
  Object.assign(floatBtn.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '999999',
    background: '#F97316',
    color: '#ffffff',
    border: 'none',
    borderRadius: '50px',
    padding: '12px 22px',
    fontSize: '14px',
    fontWeight: '600',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(249,115,22,0.45)',
    letterSpacing: '0.02em',
    transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
  });
  floatBtn.addEventListener('mouseenter', () => {
    floatBtn.style.background = '#ea6d0f';
    floatBtn.style.boxShadow = '0 6px 20px rgba(249,115,22,0.55)';
    floatBtn.style.transform = 'translateY(-1px)';
  });
  floatBtn.addEventListener('mouseleave', () => {
    floatBtn.style.background = '#F97316';
    floatBtn.style.boxShadow = '0 4px 16px rgba(249,115,22,0.45)';
    floatBtn.style.transform = 'translateY(0)';
  });
  floatBtn.addEventListener('click', () => {
    try {
      chrome.runtime.sendMessage({ action: 'asc_openSidePanel' });
    } catch (e) {
      floatBtn.remove();
    }
  });
  document.body.appendChild(floatBtn);

  // ── Appointment Copilot button (injected into Tekmetric UI) ────
  const CALENDAR_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

  function findViewShareBtn() {
    for (const el of document.querySelectorAll('button, a, [role="button"]')) {
      const text = el.textContent.trim();
      if (text.includes('View & Share Invoice') || text.includes('View and Share Invoice')) {
        return el;
      }
    }
    return null;
  }

  function injectApptBtn() {
    if (document.getElementById('asc-appt-btn')) return;
    if (!PAYMENT_RE.test(window.location.href)) return;

    const anchor = findViewShareBtn();
    if (!anchor) return;

    const apptBtn = document.createElement('button');
    apptBtn.id = 'asc-appt-btn';
    apptBtn.innerHTML = CALENDAR_ICON + ' Appointment Copilot';
    apptBtn.addEventListener('click', () => {
      try {
        chrome.runtime.sendMessage({ action: 'asc_openSidePanel' });
      } catch (e) {
        apptBtn.remove();
      }
    });

    const parent = anchor.parentNode;
    if (anchor.nextSibling) {
      parent.insertBefore(apptBtn, anchor.nextSibling);
    } else {
      parent.appendChild(apptBtn);
    }
  }

  function removeApptBtn() {
    document.getElementById('asc-appt-btn')?.remove();
  }

  // ── SPA URL monitoring + DOM retry loop ────────────────────────
  let lastUrl = window.location.href;
  setInterval(() => {
    const url = window.location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      if (!PAYMENT_RE.test(url)) removeApptBtn();
      if (INSPECTIONS_RE.test(url)) scheduleInspectionsScrape(url);
    }
    // Retry injection every tick while on payment page (handles React re-renders)
    if (PAYMENT_RE.test(url)) injectApptBtn();
  }, 400);

  // Initial injection attempt
  if (PAYMENT_RE.test(window.location.href)) injectApptBtn();
  if (INSPECTIONS_RE.test(window.location.href)) scheduleInspectionsScrape(window.location.href);

  // ── DVI / Inspections capture ───────────────────────────────────

  // Inject fetch interceptor into page context so we capture TekMetric's own
  // internal API calls (runs in page world, bypassing content script isolation).
  (function injectFetchInterceptor() {
    if (document.getElementById('asc-fetch-interceptor')) return;
    const s = document.createElement('script');
    s.id = 'asc-fetch-interceptor';
    s.textContent = `
      (function() {
        if (window.__ascFetchPatched) return;
        window.__ascFetchPatched = true;
        const _fetch = window.fetch.bind(window);
        window.fetch = function(input, init) {
          const url = typeof input === 'string' ? input : (input?.url || '');
          const p = _fetch(input, init);
          if (/\\/api\\/v1\\/(jobs|inspections|inspection|repair-order)/i.test(url)) {
            p.then(res => res.clone().json().then(data => {
              window.postMessage({ type: 'ASC_API_CAPTURE', url, data }, '*');
            }).catch(() => {})).catch(() => {});
          }
          return p;
        };
      })();
    `;
    (document.head || document.documentElement).appendChild(s);
  })();

  // Listen for intercepted API responses posted from page context
  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.type !== 'ASC_API_CAPTURE') return;
    const url = e.data.url || '';
    const data = e.data.data;
    if (!data) return;

    // TekMetric jobs API — contains inspection items alongside regular jobs
    if (/\/api\/v1\/jobs/i.test(url) && (data.content || Array.isArray(data))) {
      const jobs = Array.isArray(data) ? data : (data.content || []);
      const inspectionJobs = jobs.filter(j =>
        j.laborType?.name?.toLowerCase().includes('inspect') ||
        j.categoryName?.toLowerCase().includes('inspect') ||
        j.categoryName?.toLowerCase().includes('dvi') ||
        j.type?.toLowerCase().includes('inspect') ||
        j.jobType?.toLowerCase().includes('inspect')
      );
      // Also capture all jobs — the sidebar can filter further
      if (jobs.length > 0) {
        try {
          chrome.runtime.sendMessage({
            action: 'asc_dviCapture',
            source: 'api',
            roId: new URLSearchParams(url.split('?')[1] || '').get('repairOrderId'),
            allJobs: jobs,
            inspectionJobs
          });
        } catch (_) {}
      }
    }

    // TekMetric inspections endpoint (if it exists separately)
    if (/\/api\/v1\/inspection/i.test(url)) {
      const items = Array.isArray(data) ? data : (data.content || data.items || data.data || []);
      if (items.length > 0) {
        try {
          chrome.runtime.sendMessage({
            action: 'asc_dviCapture',
            source: 'api',
            roId: new URLSearchParams(url.split('?')[1] || '').get('repairOrderId'),
            inspectionItems: items
          });
        } catch (_) {}
      }
    }
  });

  // DOM scraper — fallback when fetch interception doesn't yield inspection data
  function scrapeInspectionsDom(roId) {
    // Give React time to render (2s initial, 5s max)
    const items = [];

    // Common TekMetric inspection DOM patterns
    const statusMap = {
      red:    ['red', 'fail', 'danger', 'critical', 'urgent', '#e53e3e', '#f56565', '#c53030', 'rgb(229', 'rgb(245'],
      yellow: ['yellow', 'warn', 'caution', 'amber', 'advisory', '#d69e2e', '#f6ad55', '#dd6b20', 'rgb(214', 'rgb(246', 'rgb(221'],
      green:  ['green', 'pass', 'ok', 'good', 'success', '#38a169', '#68d391', '#2f855a', 'rgb(56', 'rgb(104', 'rgb(47']
    };

    function getStatusFromEl(el) {
      const html = el.innerHTML.toLowerCase() + ' ' + el.className.toLowerCase();
      const style = el.getAttribute('style') || '';
      const combined = html + style;
      if (statusMap.red.some(s => combined.includes(s))) return 'red';
      if (statusMap.yellow.some(s => combined.includes(s))) return 'yellow';
      if (statusMap.green.some(s => combined.includes(s))) return 'green';
      return 'unknown';
    }

    // Strategy 1 — find rows/items in the inspections page
    const rows = document.querySelectorAll(
      '[class*="inspection-item"], [class*="InspectionItem"], [class*="inspection_item"], ' +
      '[data-testid*="inspection"], [class*="checklist-item"], [class*="ChecklistItem"]'
    );
    rows.forEach(row => {
      const name = row.querySelector('[class*="name"], [class*="label"], [class*="title"]')?.textContent?.trim()
                || row.querySelector('span, p')?.textContent?.trim()
                || row.textContent?.trim().split('\n')[0]?.trim();
      const noteEl = row.querySelector('[class*="note"], [class*="comment"], [class*="tech"], textarea');
      const note = noteEl?.textContent?.trim() || noteEl?.value?.trim() || '';
      const status = getStatusFromEl(row);
      if (name && name.length < 120) items.push({ name, status, note });
    });

    // Strategy 2 — look for any list-like structure on the page if strategy 1 found nothing
    if (items.length === 0) {
      const allText = document.body.innerText;
      // Return raw text so Claude can interpret it
      try {
        chrome.runtime.sendMessage({
          action: 'asc_dviCapture',
          source: 'dom-text',
          roId,
          rawText: allText.substring(0, 8000)
        });
      } catch (_) {}
      return;
    }

    try {
      chrome.runtime.sendMessage({
        action: 'asc_dviCapture',
        source: 'dom',
        roId,
        inspectionItems: items
      });
    } catch (_) {}
  }

  // Listen for sidebar-initiated scrape requests
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'asc_doScrapeInspections') {
      const match = window.location.href.match(INSPECTIONS_RE);
      if (match) {
        scrapeInspectionsDom(match[1]);
        sendResponse({ success: true, onPage: true });
      } else {
        sendResponse({ success: false, onPage: false });
      }
    }
    return true;
  });

  // Auto-trigger when navigating to inspections tab
  let scrapeTimer = null;
  function scheduleInspectionsScrape(url) {
    if (scrapeTimer) clearTimeout(scrapeTimer);
    const match = url.match(INSPECTIONS_RE);
    if (!match) return;
    const roId = match[1];
    // Wait 2.5s for React to render inspection items
    scrapeTimer = setTimeout(() => scrapeInspectionsDom(roId), 2500);
  }
})();
