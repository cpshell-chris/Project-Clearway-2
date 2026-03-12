// Service Advisor Hub — Content Script
// Injects a floating launch button into TekMetric pages

(function () {
  console.log('[CPS Hub] Content script loaded on:', window.location.href);

  if (document.getElementById('cps-hub-launcher')) {
    console.log('[CPS Hub] Button already present, skipping');
    return;
  }

  const btn = document.createElement('button');
  btn.id   = 'cps-hub-launcher';
  btn.type = 'button';
  btn.title = 'Open / Close Service Advisor Hub';

  btn.innerHTML = `
    <span class="cps-hub-icon">🚗</span>
    <span class="cps-hub-label">SA's</span>
  `;

  const style = document.createElement('style');
  style.id = 'cps-hub-launcher-style';
  style.textContent = `
    #cps-hub-launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 10px 20px;
      background: #F97316;
      color: white;
      border: none;
      border-radius: 28px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.3px;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(249, 115, 22, 0.45);
      transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
      user-select: none;
      min-width: 110px;
      width: 110px;
      justify-content: center;
    }
    #cps-hub-launcher:hover {
      background: #EA6C0A;
      box-shadow: 0 6px 20px rgba(249, 115, 22, 0.55);
      transform: translateY(-1px);
    }
    #cps-hub-launcher:active {
      background: #D45F05;
      transform: translateY(0px);
      box-shadow: 0 3px 10px rgba(249, 115, 22, 0.35);
    }
    .cps-hub-icon  { font-size: 15px; line-height: 1; }
    .cps-hub-label { font-size: 13px; font-weight: 700; letter-spacing: 0.3px; }
    @keyframes cps-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.55); }
      70%  { box-shadow: 0 0 0 12px rgba(249, 115, 22, 0); }
      100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
    }
    #cps-hub-launcher.pulsing { animation: cps-pulse 1.2s ease-out 2; }
  `;

  document.head.appendChild(style);
  document.body.appendChild(btn);
  console.log('[CPS Hub] Button injected');

  setTimeout(() => btn.classList.add('pulsing'),    400);
  setTimeout(() => btn.classList.remove('pulsing'), 3200);

  btn.addEventListener('click', () => {
    console.log('[CPS Hub] Button clicked');
    // Use tabId-based open — required for user-gesture routing in MV3
    chrome.runtime.sendMessage({ action: 'sah_openSidePanel' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[CPS Hub] Error:', chrome.runtime.lastError.message);
      } else {
        console.log('[CPS Hub] Response:', response);
      }
    });
  });
})();
