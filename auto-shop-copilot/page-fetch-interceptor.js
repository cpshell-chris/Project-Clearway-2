// Runs in page context (MAIN world) — wraps window.fetch to capture TekMetric API calls
(function () {
  if (window.__ascFetchPatched) return;
  window.__ascFetchPatched = true;
  const _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const p = _fetch(input, init);
    if (/\/api\/v1\/(jobs|inspections|inspection|repair-order)/i.test(url)) {
      p.then(res => res.clone().json().then(data => {
        window.postMessage({ type: 'ASC_API_CAPTURE', url, data }, '*');
      }).catch(() => {})).catch(() => {});
    }
    return p;
  };
})();
