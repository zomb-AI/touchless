// ═══════════════════════════════════════════════════════════════
//  ZombAI — Content Script
//  Lightweight bridge: listens for stop signals forwarded from
//  the background worker and relays keyboard shortcuts.
//  The heavy gesture engine lives in injected.js (MAIN world).
// ═══════════════════════════════════════════════════════════════

// Forward STOP signal from background → page context
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'ZOMBAI_STOP') {
    window.dispatchEvent(new CustomEvent('__zombai_stop__'));
  }
});

// Keyboard shortcut: Alt+G toggles gesture overlay
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'g') {
    chrome.runtime.sendMessage({ type: 'TOGGLE' }, (res) => {
      if (chrome.runtime.lastError) return;
      window.dispatchEvent(new CustomEvent('__zombai_badge_update__',
        { detail: { active: res?.active } }));
    });
  }
});
