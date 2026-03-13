// Auto Shop Copilot — content.js
// Injects the floating Copilot launcher button on TekMetric pages.
// On payment pages, transforms into a contextual scheduler prompt.

(function () {
  'use strict';

  if (document.getElementById('asc-copilot-launcher')) return;

  const PAYMENT_RE = /\/repair-orders\/\d+\/payment(?:[/?#]|$)/i;

  // ── Inject keyframe animation ──────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    @keyframes asc-pulse {
      0%   { box-shadow: 0 4px 16px rgba(154,52,18,0.5), 0 0 0 0 rgba(154,52,18,0.4); }
      70%  { box-shadow: 0 4px 16px rgba(154,52,18,0.5), 0 0 0 10px rgba(154,52,18,0); }
      100% { box-shadow: 0 4px 16px rgba(154,52,18,0.5), 0 0 0 0 rgba(154,52,18,0); }
    }
    @keyframes asc-pulse-default {
      0%   { box-shadow: 0 4px 16px rgba(249,115,22,0.45); }
      100% { box-shadow: 0 4px 16px rgba(249,115,22,0.45); }
    }
  `;
  document.head.appendChild(style);

  // ── Create button ──────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = 'asc-copilot-launcher';

  Object.assign(btn.style, {
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
    transition: 'background 0.2s ease, transform 0.15s ease',
  });

  // ── Update appearance based on current URL ─────────────────────
  function updateButton() {
    const isPayment = PAYMENT_RE.test(window.location.href);
    if (isPayment) {
      btn.textContent = '📅 Open Scheduler';
      btn.style.background = '#9A3412';
      btn.style.animation = 'asc-pulse 1.8s ease-out infinite';
      btn.style.padding = '13px 26px';
      btn.style.fontSize = '14px';
    } else {
      btn.textContent = 'Copilot';
      btn.style.background = '#F97316';
      btn.style.animation = '';
      btn.style.boxShadow = '0 4px 16px rgba(249,115,22,0.45)';
      btn.style.padding = '12px 22px';
      btn.style.fontSize = '14px';
    }
  }

  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'translateY(-2px)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'translateY(0)';
  });

  btn.addEventListener('click', () => {
    try {
      chrome.runtime.sendMessage({ action: 'asc_openSidePanel' });
    } catch (e) {
      // Extension was reloaded — remove stale button so fresh one can inject
      btn.remove();
    }
  });

  document.body.appendChild(btn);
  updateButton();

  // ── Watch for SPA navigation (Tekmetric uses React / history API) ──
  let lastUrl = window.location.href;
  setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      updateButton();
    }
  }, 400);
})();
