// Auto Shop Copilot — content.js
// Injects the floating Copilot launcher + contextual Appointment Copilot button on payment pages.

(function () {
  'use strict';

  if (document.getElementById('asc-copilot-launcher')) return;

  const PAYMENT_RE = /\/repair-orders\/\d+\/payment(?:[/?#]|$)/i;

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
    }
    // Retry injection every tick while on payment page (handles React re-renders)
    if (PAYMENT_RE.test(url)) injectApptBtn();
  }, 400);

  // Initial injection attempt
  if (PAYMENT_RE.test(window.location.href)) injectApptBtn();
})();
