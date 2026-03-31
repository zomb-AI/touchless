// ═══════════════════════════════════════════════════════════════
//  ZombAI — Popup Script
// ═══════════════════════════════════════════════════════════════

const $toggle    = document.getElementById('toggle');
const $statusDot = document.getElementById('status-dot');
const $statusTxt = document.getElementById('status-text');
const $siteUrl   = document.getElementById('site-url');
const $favicon   = document.getElementById('favicon');
const $toggleDesc = document.getElementById('toggle-desc');

let currentTabId = null;

// ── Boot ──────────────────────────────────────────────────────
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  currentTabId = tab.id;

  // Show site info
  try {
    const url = new URL(tab.url);
    $siteUrl.textContent = url.hostname;
    $favicon.src = `https://www.google.com/s2/favicons?sz=16&domain=${url.hostname}`;
  } catch {
    $siteUrl.textContent = 'Unknown page';
  }

  // Check current state
  chrome.runtime.sendMessage({ type: 'STATUS', tabId: tab.id }, (res) => {
    if (chrome.runtime.lastError) return;
    setUI(res?.active ?? false);
  });
})();

// ── Toggle ────────────────────────────────────────────────────
$toggle.addEventListener('change', () => {
  const enable = $toggle.checked;
  chrome.runtime.sendMessage(
    { type: enable ? 'ENABLE' : 'DISABLE', tabId: currentTabId },
    (res) => {
      if (chrome.runtime.lastError) {
        setUI(false);
        return;
      }
      setUI(res?.active ?? enable);
    }
  );
});

// ── Update UI ─────────────────────────────────────────────────
function setUI(active) {
  $toggle.checked = active;

  $statusDot.classList.toggle('active', active);
  $statusTxt.classList.toggle('active', active);
  $statusTxt.textContent = active
    ? '● ZombAI active on this tab'
    : 'Inactive on this tab';

  $toggleDesc.textContent = active
    ? 'Gesture overlay is running'
    : 'Enable on this tab';
}
