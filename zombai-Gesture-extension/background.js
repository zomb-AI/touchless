// ═══════════════════════════════════════════════════════════════
//  ZombAI Gesture Control — Background Service Worker
//  Manages per-tab enable/disable state and script injection.
//  chrome.scripting.executeScript bypasses host-page CSP,
//  so MediaPipe loads even on Gmail / WhatsApp Web.
// ═══════════════════════════════════════════════════════════════

const MEDIAPIPE_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js';

// ── State helpers ─────────────────────────────────────────────
async function getEnabledTabs() {
  const { enabledTabs = [] } = await chrome.storage.local.get('enabledTabs');
  return enabledTabs;
}
async function setEnabledTabs(tabs) {
  await chrome.storage.local.set({ enabledTabs: tabs });
}
async function isTabEnabled(tabId) {
  const tabs = await getEnabledTabs();
  return tabs.includes(tabId);
}

// ── Inject ZombAI onto a tab ──────────────────────────────────
async function enableOnTab(tabId) {
  // Step 1 — inject MediaPipe from CDN (bypasses page CSP via scripting API)
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    world: 'MAIN',
    func: (cdnUrl) => {
      return new Promise((resolve, reject) => {
        if (window.__ZOMBAI_MP_LOADED__) { resolve(); return; }
        const s = document.createElement('script');
        s.src = cdnUrl;
        s.crossOrigin = 'anonymous';
        s.onload  = () => { window.__ZOMBAI_MP_LOADED__ = true; resolve(); };
        s.onerror = reject;
        document.documentElement.appendChild(s);
      });
    },
    args: [MEDIAPIPE_CDN],
  });

  // Step 2 — inject ZombAI gesture engine (web_accessible_resource)
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    world: 'MAIN',
    files: ['injected.js'],
  });

  // Track state
  const tabs = await getEnabledTabs();
  if (!tabs.includes(tabId)) {
    await setEnabledTabs([...tabs, tabId]);
  }
  updateIcon(tabId, true);
}

// ── Remove ZombAI from a tab ──────────────────────────────────
async function disableOnTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => { window.__ZOMBAI_STOP?.(); },
    });
  } catch (_) {}

  const tabs = await getEnabledTabs();
  await setEnabledTabs(tabs.filter(id => id !== tabId));
  updateIcon(tabId, false);
}

// ── Toolbar icon badge ────────────────────────────────────────
function updateIcon(tabId, active) {
  chrome.action.setBadgeText({ tabId, text: active ? 'ON' : '' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: active ? '#00d4ff' : '#555' });
}

// ── Message bus (from popup & content script) ─────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const tabId = msg.tabId ?? sender.tab?.id;
    if (!tabId) { sendResponse({ error: 'no tabId' }); return; }

    switch (msg.type) {
      case 'ENABLE':
        await enableOnTab(tabId);
        sendResponse({ ok: true, active: true });
        break;

      case 'DISABLE':
        await disableOnTab(tabId);
        sendResponse({ ok: true, active: false });
        break;

      case 'TOGGLE':
        const enabled = await isTabEnabled(tabId);
        if (enabled) await disableOnTab(tabId);
        else          await enableOnTab(tabId);
        sendResponse({ ok: true, active: !enabled });
        break;

      case 'STATUS':
        sendResponse({ active: await isTabEnabled(tabId) });
        break;

      default:
        sendResponse({ error: 'unknown message' });
    }
  })();
  return true; // keep channel open for async response
});

// ── Clean up when tab is closed / navigated ───────────────────
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const tabs = await getEnabledTabs();
  await setEnabledTabs(tabs.filter(id => id !== tabId));
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  // Re-inject on navigation if tab was active
  if (changeInfo.status === 'complete' && await isTabEnabled(tabId)) {
    try { await enableOnTab(tabId); } catch (_) {}
  }
  // Clear badge on navigation start
  if (changeInfo.status === 'loading') {
    updateIcon(tabId, await isTabEnabled(tabId));
  }
});
