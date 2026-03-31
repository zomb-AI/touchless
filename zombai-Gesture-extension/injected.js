// ═══════════════════════════════════════════════════════════════
//  ZombAI Gesture Engine — injected.js
//  Runs in the host page's MAIN world.
//  Creates a transparent canvas overlay + camera + ZombAI HUD,
//  then translates hand gestures into real pointer events on
//  whatever element the cursor is pointing at.
//
//  Gestures:
//   ☝  Index tip      → cursor (blue)
//   🤌  Pinch          → click / tap element under cursor
//   🤞  Index + Middle → two-finger mode
//      · near HUD      → drag the HUD badge
//      · elsewhere     → scroll the page
// ═══════════════════════════════════════════════════════════════

(function zombaiInit() {
  // Prevent double-injection on re-navigations
  if (window.__ZOMBAI_ACTIVE__) return;
  window.__ZOMBAI_ACTIVE__ = true;

  // ── Cleanup registry ──────────────────────────────────────
  const cleanupFns = [];
  function onCleanup(fn) { cleanupFns.push(fn); }

  function destroyZombAI() {
    cleanupFns.forEach(fn => { try { fn(); } catch (_) {} });
    window.__ZOMBAI_ACTIVE__ = false;
    window.__ZOMBAI_STOP = null;
  }

  window.__ZOMBAI_STOP = destroyZombAI;
  window.addEventListener('__zombai_stop__', destroyZombAI, { once: true });

  // ── Brand colors ──────────────────────────────────────────
  const C1 = '#00d4ff'; // primary  — index cursor
  const C2 = '#7b2ff7'; // secondary — middle cursor / drag
  const CG = '#00ff88'; // brand green — pinch confirm

  // ── Gesture thresholds ────────────────────────────────────
  const PINCH_THRESH  = 0.057;
  const DRAG_RADIUS   = 70;
  const SCROLL_SPEED  = 2.2;
  const COOLDOWN_MS   = 860;

  // ── Landmark indices ──────────────────────────────────────
  const THUMB_TIP  = 4;
  const INDEX_TIP  = 8;
  const INDEX_MCP  = 5;
  const MIDDLE_TIP = 12;
  const MIDDLE_MCP = 9;

  // ═══════════════════════════════════════════════════════════
  //  BUILD OVERLAY DOM
  // ═══════════════════════════════════════════════════════════

  // Root container (pointer-events none so host page stays interactive)
  const $root = document.createElement('div');
  $root.id = 'zombai-root';
  Object.assign($root.style, {
    position: 'fixed', inset: '0',
    pointerEvents: 'none',
    zIndex: '2147483646',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  });
  document.documentElement.appendChild($root);
  onCleanup(() => $root.remove());

  // Canvas
  const $canvas = document.createElement('canvas');
  $canvas.id = 'zombai-canvas';
  Object.assign($canvas.style, {
    position: 'fixed', inset: '0',
    width: '100%', height: '100%',
    pointerEvents: 'none',
  });
  $root.appendChild($canvas);
  const ctx = $canvas.getContext('2d');

  // Hidden video
  const $video = document.createElement('video');
  Object.assign($video, { autoplay: true, muted: true, playsInline: true });
  Object.assign($video.style, {
    position: 'fixed', opacity: '0',
    width: '1px', height: '1px',
    pointerEvents: 'none',
  });
  $root.appendChild($video);

  // ── ZombAI HUD badge (pointer-events: auto so it's draggable) ──
  const $hud = document.createElement('div');
  $hud.id = 'zombai-hud';
  Object.assign($hud.style, {
    position: 'fixed',
    top: '16px', right: '16px',
    background: 'rgba(13,13,13,0.88)',
    backdropFilter: 'blur(14px)',
    webkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(0,212,255,0.25)',
    borderRadius: '14px',
    padding: '8px 12px',
    display: 'flex', alignItems: 'center', gap: '8px',
    zIndex: '2147483647',
    pointerEvents: 'auto',
    cursor: 'move',
    userSelect: 'none',
    boxShadow: '0 4px 24px rgba(0,212,255,0.18)',
    minWidth: '130px',
    transition: 'box-shadow 0.2s',
  });

  // Z logo
  const $logo = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  $logo.setAttribute('viewBox', '0 0 24 24');
  $logo.setAttribute('width', '18');
  $logo.setAttribute('height', '18');
  $logo.innerHTML = `
    <defs>
      <linearGradient id="zg_hud" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#00d4ff"/>
        <stop offset="100%" stop-color="#7b2ff7"/>
      </linearGradient>
    </defs>
    <path d="M4 6h16L4 18h16" stroke="url(#zg_hud)" stroke-width="2.4"
      stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  `;
  $hud.appendChild($logo);

  const $hudText = document.createElement('div');
  Object.assign($hudText.style, { display: 'flex', flexDirection: 'column', gap: '1px' });
  $hudText.innerHTML = `
    <span style="font-size:12px;font-weight:700;color:#fff;letter-spacing:-.01em">
      Zomb<span style="background:linear-gradient(90deg,#00d4ff,#7b2ff7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">AI</span>
    </span>
    <span id="zombai-status" style="font-size:10px;color:#00d4ff;letter-spacing:.02em">Active</span>
  `;
  $hud.appendChild($hudText);

  const $closeBtn = document.createElement('button');
  Object.assign($closeBtn.style, {
    marginLeft: 'auto',
    background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.35)',
    cursor: 'pointer', fontSize: '15px',
    padding: '0 0 0 6px',
    lineHeight: '1',
  });
  $closeBtn.textContent = '×';
  $closeBtn.title = 'Disable ZombAI (Alt+G)';
  $closeBtn.addEventListener('click', () => {
    // Notify background to disable this tab
    window.dispatchEvent(new CustomEvent('__zombai_stop__'));
  });
  $hud.appendChild($closeBtn);

  document.documentElement.appendChild($hud);
  onCleanup(() => $hud.remove());

  // HUD drag (physical mouse)
  let hudDragging = false, hudDx = 0, hudDy = 0;
  $hud.addEventListener('mousedown', e => {
    if (e.target === $closeBtn) return;
    hudDragging = true;
    const r = $hud.getBoundingClientRect();
    hudDx = e.clientX - r.left;
    hudDy = e.clientY - r.top;
    $hud.style.right = 'auto';
    $hud.style.bottom = 'auto';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!hudDragging) return;
    $hud.style.left = (e.clientX - hudDx) + 'px';
    $hud.style.top  = (e.clientY - hudDy) + 'px';
  });
  document.addEventListener('mouseup', () => { hudDragging = false; });

  function setStatus(msg) {
    const el = document.getElementById('zombai-status');
    if (el) el.textContent = msg;
  }

  // ═══════════════════════════════════════════════════════════
  //  CANVAS SIZING
  // ═══════════════════════════════════════════════════════════
  function resize() {
    $canvas.width  = window.innerWidth;
    $canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  onCleanup(() => window.removeEventListener('resize', resize));

  // ═══════════════════════════════════════════════════════════
  //  CURSOR DRAWING
  // ═══════════════════════════════════════════════════════════
  const cur1 = { x: -300, y: -300, visible: false };
  const cur2 = { x: -300, y: -300, visible: false };

  function drawFrame(pinching, dragMode) {
    ctx.clearRect(0, 0, $canvas.width, $canvas.height);

    // Connector line + midpoint when both cursors active
    if (cur1.visible && cur2.visible) {
      const mx = (cur1.x + cur2.x) / 2;
      const my = (cur1.y + cur2.y) / 2;

      ctx.beginPath();
      ctx.moveTo(cur1.x, cur1.y);
      ctx.lineTo(cur2.x, cur2.y);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = dragMode ? C2 + '88' : C1 + '44';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Midpoint
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 18);
      mg.addColorStop(0, (dragMode ? C2 : C1) + '55');
      mg.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(mx, my, 18, 0, Math.PI * 2);
      ctx.fillStyle = mg; ctx.fill();
      ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2);
      ctx.fillStyle = dragMode ? C2 : C1;
      ctx.globalAlpha = .85; ctx.fill(); ctx.globalAlpha = 1;
    }

    if (cur1.visible) drawCursor(cur1.x, cur1.y, pinching, C1, false);
    if (cur2.visible) drawCursor(cur2.x, cur2.y, false,    C2, true);
  }

  function drawCursor(x, y, pinching, color, secondary) {
    const oR = secondary ? 10  : (pinching ? 11 : 14);
    const iR = secondary ? 3.5 : (pinching ? 5  : 6);
    const gR = secondary ? 18  : (pinching ? 22 : 30);
    ctx.globalAlpha = secondary ? 0.62 : 1;

    const g = ctx.createRadialGradient(x, y, 0, x, y, gR);
    g.addColorStop(0, color + (secondary ? '28' : '22'));
    g.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(x, y, gR, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();

    ctx.beginPath(); ctx.arc(x, y, oR, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = pinching ? 2.5 : 1.8;
    ctx.globalAlpha = secondary ? .5 : (pinching ? 1 : .85);
    ctx.stroke();

    ctx.beginPath(); ctx.arc(x, y, iR, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = secondary ? .65 : 1;
    ctx.fill();

    // Pinch confirm ring (green flash)
    if (pinching && !secondary) {
      ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.strokeStyle = CG + '88';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ═══════════════════════════════════════════════════════════
  //  HOVER & TAP
  // ═══════════════════════════════════════════════════════════
  let lastHovered = null;
  const HOVER_STYLE = '2px solid rgba(0,212,255,0.65)';

  function getClickableAt(x, y) {
    const el = document.elementFromPoint(x, y);
    // Skip ZombAI's own overlay elements
    if (el?.closest('#zombai-root, #zombai-hud')) return null;
    return el?.closest('a, button, input, textarea, select, [role="button"], [tabindex], [onclick], label') || null;
  }

  function updateHover(el) {
    if (el === lastHovered) return;
    if (lastHovered && lastHovered._zombaiOrigOutline !== undefined) {
      lastHovered.style.outline = lastHovered._zombaiOrigOutline;
      delete lastHovered._zombaiOrigOutline;
    }
    if (el) {
      el._zombaiOrigOutline = el.style.outline;
      el.style.outline = HOVER_STYLE;
      el.style.outlineOffset = '2px';
    }
    lastHovered = el;
  }

  function fireTap(el, x, y) {
    if (!el) return;
    // Restore outline briefly for visual feedback
    el.style.outline = '2px solid ' + CG;
    setTimeout(() => {
      if (el._zombaiOrigOutline !== undefined) {
        el.style.outline = el._zombaiOrigOutline;
      }
    }, 180);

    // Dispatch synthetic pointer + click events
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y,
                   screenX: x, screenY: y, view: window };
    el.dispatchEvent(new PointerEvent('pointerover',  { ...opts }));
    el.dispatchEvent(new PointerEvent('pointerenter', { ...opts, bubbles: false }));
    el.dispatchEvent(new MouseEvent('mouseover',  opts));
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown',  opts));
    el.dispatchEvent(new PointerEvent('pointerup',   opts));
    el.dispatchEvent(new MouseEvent('mouseup',    opts));
    el.dispatchEvent(new MouseEvent('click',      opts));

    // Focus inputs (opens keyboard on mobile, enables typing on desktop)
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
      el.focus();
    }

    // ContentEditable (WhatsApp Web, Gmail compose)
    if (el.contentEditable === 'true' || el.getAttribute('contenteditable')) {
      el.focus();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  HUD DRAG — two-finger gesture
  // ═══════════════════════════════════════════════════════════
  let isDragging = false, dragStartMid = { x: 0, y: 0 }, dragStartHud = { x: 0, y: 0 };

  function startHudDrag(midX, midY) {
    if (isDragging) return;
    isDragging = true;
    const r = $hud.getBoundingClientRect();
    dragStartMid = { x: midX, y: midY };
    dragStartHud = { x: r.left, y: r.top };
    $hud.style.right = 'auto'; $hud.style.bottom = 'auto';
    $hud.style.boxShadow = '0 8px 40px rgba(123,47,247,0.55)';
  }
  function updateHudDrag(midX, midY) {
    const dx = midX - dragStartMid.x, dy = midY - dragStartMid.y;
    const W = window.innerWidth, H = window.innerHeight;
    const r = $hud.getBoundingClientRect();
    $hud.style.left = Math.max(0, Math.min(W - r.width,  dragStartHud.x + dx)) + 'px';
    $hud.style.top  = Math.max(0, Math.min(H - r.height, dragStartHud.y + dy)) + 'px';
  }
  function endHudDrag() {
    isDragging = false;
    $hud.style.boxShadow = '0 4px 24px rgba(0,212,255,0.18)';
  }

  // ═══════════════════════════════════════════════════════════
  //  GESTURE PROCESSOR
  // ═══════════════════════════════════════════════════════════
  let isPinching  = false;
  let lastClickAt = 0;
  let lastMidY    = null;

  function processLandmarks(lm) {
    const W = $canvas.width, H = $canvas.height;
    const mx = lx => (1 - lx) * W;
    const my = ly => ly * H;

    const thumb  = lm[THUMB_TIP];
    const idx    = lm[INDEX_TIP];
    const idxB   = lm[INDEX_MCP];
    const mid    = lm[MIDDLE_TIP];
    const midB   = lm[MIDDLE_MCP];

    // Cursor 1 (index)
    cur1.x = mx(idx.x); cur1.y = my(idx.y); cur1.visible = true;

    // Cursor 2 (middle — only if extended)
    const midExt = (mid.y - midB.y) < -0.03;
    cur2.visible = midExt;
    if (midExt) { cur2.x = mx(mid.x); cur2.y = my(mid.y); }

    // Pinch
    const pd = Math.hypot(idx.x - thumb.x, idx.y - thumb.y);
    const wasPinching = isPinching;
    isPinching = pd < PINCH_THRESH;

    // ── Two-finger logic ────────────────────────────────────
    let dragMode = false;
    if (cur1.visible && cur2.visible) {
      const midX = (cur1.x + cur2.x) / 2;
      const midY = (cur1.y + cur2.y) / 2;
      const hudR = $hud.getBoundingClientRect();
      const hudCX = hudR.left + hudR.width  / 2;
      const hudCY = hudR.top  + hudR.height / 2;
      const distToHud = Math.hypot(midX - hudCX, midY - hudCY);

      if (distToHud < DRAG_RADIUS || isDragging) {
        dragMode = true;
        if (!isDragging) startHudDrag(midX, midY);
        else             updateHudDrag(midX, midY);
        lastMidY = null;
        setStatus('dragging HUD 🟣');
      } else {
        endHudDrag();
        if (lastMidY !== null) {
          const delta = midY - lastMidY;
          if (Math.abs(delta) > 0.8) window.scrollBy(0, delta * SCROLL_SPEED);
        }
        lastMidY = midY;
        setStatus('↕ scrolling');
      }
    } else {
      if (isDragging) endHudDrag();
      lastMidY = null;
    }

    drawFrame(isPinching, dragMode);

    // Hover primary cursor
    const tappable = getClickableAt(cur1.x, cur1.y);
    updateHover(tappable);

    if (tappable && !dragMode) {
      const label = tappable.getAttribute('aria-label')
                 || tappable.textContent?.trim().slice(0, 20)
                 || tappable.tagName.toLowerCase();
      setStatus(`→ ${label}`);
    } else if (!dragMode && !cur2.visible) {
      setStatus('Active');
    }

    // Tap on pinch leading edge
    const now = Date.now();
    if (isPinching && !wasPinching && now - lastClickAt > COOLDOWN_MS) {
      lastClickAt = now;
      fireTap(tappable, cur1.x, cur1.y);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  MEDIAPIPE + CAMERA
  // ═══════════════════════════════════════════════════════════
  async function startTracking() {
    if (typeof Hands === 'undefined') {
      setStatus('⚠ model not loaded');
      return;
    }

    const hands = new Hands({
      locateFile: f =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${f}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.70,
      minTrackingConfidence: 0.63,
    });

    hands.onResults(results => {
      if (results.multiHandLandmarks?.length > 0) {
        processLandmarks(results.multiHandLandmarks[0]);
      } else {
        cur1.visible = false; cur2.visible = false;
        updateHover(null); endHudDrag(); lastMidY = null;
        drawFrame(false, false);
        setStatus('Waiting for hand…');
      }
    });

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    onCleanup(() => stream.getTracks().forEach(t => t.stop()));

    $video.srcObject = stream;
    await new Promise(res => { $video.onloadeddata = res; });
    await $video.play();

    setStatus('Active ✓');

    let running = false;
    let rafId;
    const tick = async () => {
      if (!running) {
        running = true;
        try { await hands.send({ image: $video }); } catch (_) {}
        running = false;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    onCleanup(() => cancelAnimationFrame(rafId));
  }

  startTracking().catch(err => {
    setStatus('⚠ Camera denied');
    console.warn('[ZombAI] Camera error:', err);
  });

})(); // IIFE — prevents polluting global scope
