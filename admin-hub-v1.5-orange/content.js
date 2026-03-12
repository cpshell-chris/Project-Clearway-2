// Administrative Hub — Content Script
// Injects a floating launch button into TekMetric pages

(function () {
  console.log('[Admin Hub] Content script loaded on:', window.location.href);

  if (document.getElementById('cps-admin-launcher')) {
    console.log('[Admin Hub] Button already present, skipping');
    return;
  }

  const btn = document.createElement('button');
  btn.id   = 'cps-admin-launcher';
  btn.type = 'button';
  btn.title = 'Open / Close Administrative Hub';

  btn.innerHTML = `
    <span class="cps-admin-icon">🏢</span>
    <span class="cps-admin-label">Admin</span>
  `;

  const style = document.createElement('style');
  style.id = 'cps-admin-launcher-style';
  style.textContent = `
    #cps-admin-launcher {
      position: fixed;
      bottom: 80px;
      right: 24px;
      z-index: 999998;
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
    #cps-admin-launcher:hover {
      background: #EA6C0A;
      box-shadow: 0 6px 20px rgba(249, 115, 22, 0.55);
      transform: translateY(-1px);
    }
    #cps-admin-launcher:active {
      background: #D45F05;
      transform: translateY(0px);
      box-shadow: 0 3px 10px rgba(249, 115, 22, 0.35);
    }
    .cps-admin-icon  { font-size: 15px; line-height: 1; }
    .cps-admin-label { font-size: 13px; font-weight: 700; letter-spacing: 0.3px; }
    @keyframes cps-admin-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.55); }
      70%  { box-shadow: 0 0 0 12px rgba(249, 115, 22, 0); }
      100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
    }
    #cps-admin-launcher.pulsing { animation: cps-admin-pulse 1.2s ease-out 2; }
  `;

  document.head.appendChild(style);
  document.body.appendChild(btn);
  console.log('[Admin Hub] Button injected');

  setTimeout(() => btn.classList.add('pulsing'),    600);
  setTimeout(() => btn.classList.remove('pulsing'), 3400);

  btn.addEventListener('click', () => {
    console.log('[Admin Hub] Button clicked');
    chrome.runtime.sendMessage({ action: 'adm_openSidePanel' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Admin Hub] Error:', chrome.runtime.lastError.message);
      } else {
        console.log('[Admin Hub] Response:', response);
      }
    });
  });
})();
