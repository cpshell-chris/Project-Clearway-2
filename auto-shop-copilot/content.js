// Auto Shop Copilot — content.js
// Injects the floating Copilot launcher button on TekMetric pages.

(function () {
  'use strict';

  if (document.getElementById('asc-copilot-launcher')) return;

  const btn = document.createElement('button');
  btn.id = 'asc-copilot-launcher';
  btn.textContent = 'Copilot';

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
    transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
  });

  btn.addEventListener('mouseenter', () => {
    btn.style.background = '#ea6d0f';
    btn.style.boxShadow = '0 6px 20px rgba(249,115,22,0.55)';
    btn.style.transform = 'translateY(-1px)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = '#F97316';
    btn.style.boxShadow = '0 4px 16px rgba(249,115,22,0.45)';
    btn.style.transform = 'translateY(0)';
  });

  btn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'asc_openSidePanel' });
  });

  document.body.appendChild(btn);
})();
