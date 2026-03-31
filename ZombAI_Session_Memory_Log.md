# ZombAI - TouchLess | Session Memory Log
**Last Updated:** March 31, 2026 — Session 24 (S4 complete — full AI conversation flow live)
**Project Codename:** ZombAI - TouchLess (Cluster Particle Interface)

---

## 1. PROJECT OVERVIEW & ORIGINAL VISION

ZombAI is a **touchless interaction system** built entirely on gesture + voice control using a browser-based particle cluster as its visual interface. There is no physical touch — the user controls everything via hand gestures (via webcam + MediaPipe) and voice commands (Web Speech API).

### Full Roadmap (from ZombAI_-_TouchLess file):
| # | Module | Status |
|---|--------|--------|
| 1 | Basic Prototype — Sphere + Gestures + Shape Morphing | 🔄 In Progress (gestures stable — 1E Voice next) |
| 2 | Particle shaping with Voice command → Numbers / Digits | ⏳ Pending |
| 3 | Particle shaping into ALPHABETS by Tap / Speech | ⏳ Pending |
| 4 | Mobile Screen Prototype with Dial Pad | ⏳ Pending |
| 5 | Mobile Screen Prototype with SMS / WhatsApp API | ⏳ Pending |
| 6 | Shopping Cart with local shop API — Gesture-based Add to Cart | ⏳ Pending |

---

## 2. MODULE 1 — PARTICLE SPHERE (Current Focus)

### File Target: `zombai-particle-sphere.html`

### Tech Stack Confirmed:
- **Renderer:** Three.js r128 (CDN pinned)
- **Hand Tracking:** MediaPipe Hands (up to 2 hands, versioned CDN)
- **Voice:** Web Speech API (SpeechSynthesis + SpeechRecognition)
- **Shaders:** Custom GLSL (vertex + fragment)
- **Platform:** Single-file HTML (no build tools)

### Particle System Specs:
- **Count:** 200,000 GPU particles
- **Buffer Attributes:**
  - `aBasePos` — current interpolated position (starting point of each morph)
  - `aTargetPos` — destination shape position
  - `aExpVel` — explosion velocity (random spherical, pre-generated)
  - `aGroup` — left (0) / right (1) for rip effect, based on target X
  - `aSize` — per-particle size variation
- **Shader Uniforms:**
  - `uMorphT` — morph progress 0→1 over ~1.5s
  - `uExpT` — explosion timer
  - `uScale` — global scale (open palm = expand, pinch = shrink)
  - `uStretchY` — vertical stretch (two-hand vertical spread)
  - `uRipX` — horizontal rip offset (two-hand horizontal pull)
  - `uTime` — elapsed time (for ripple/noise effects)
  - `uColor1`, `uColor2` — current color preset (lerped smoothly)

### Rendering Details:
- `THREE.Points` with `AdditiveBlending` (particles glow, no depth fighting)
- Frustum culling **disabled** (bounding sphere inaccurate with zero-origin dummy positions)
- Background: dark (black) — not transparent
- 2D canvas overlay on top for hand skeleton (separate `<canvas>`)

---

## 3. SHAPE GENERATORS (7 shapes)

| Shape | Generator Logic |
|-------|----------------|
| Sphere | Spherical coordinates → Cartesian |
| Circle | 2D disc, uniform polar sampling |
| Square | 2D flat square, uniform XY |
| Rectangle | Wider in one dimension |
| Cube | 3D uniform random in cube bounds |
| Cuboid | Non-uniform 3D scaling |
| Line | Linear distribution along one axis |

Shape is changed by:
- **Footer button click** (mouse handler)
- **Voice command** ("sphere", "circle", etc.)

---

## 4. GESTURE SYSTEM

### Per-Gesture Actions:
| Gesture | Detection Method | Action |
|---------|-----------------|--------|
| Open Palm | All 4 fingers extended | Expand scale (`uScale` target ↑) |
| Pinch | Thumb-index tip distance < threshold | Shrink scale (`uScale` target ↓) |
| Fist | All finger tips below PIP joints | **Explosion** effect (`uExpT` trigger) |
| Peace ✌️ | Index + middle extended, ring + pinky curled | Cycle color preset |
| Point ☝️ | Only index extended | Rotation via wrist velocity |
| Two-hands horizontal spread | Wrist X spread > 0.5 normalized, held 5s | **Rip** effect with progress bar |
| Two-hands vertical spread | Wrist Y delta | Stretch / compress (`uStretchY`) |

### Gesture Implementation Notes:
- MediaPipe y-axis increases **downward** — extended finger has smaller Y at tip vs PIP
- Front camera is **mirrored** — skeleton X is flipped for visual match, gesture math uses relative delta
- Cooldown frames prevent rapid re-triggering of one-shot gestures (FIST, PEACE)
- Gesture label shown in HUD, visible for 90 frames

### Rotation:
- Wrist position delta between frames → rotational velocity
- Velocity decays with damping factor each frame
- Small constant keeps idle auto-rotation alive

---

## 5. COLOR PRESETS (4 presets)

| Preset | Style |
|--------|-------|
| 1 | Sci-fi Neon (cyan/magenta) |
| 2 | Variant 2 |
| 3 | Variant 3 |
| 4 | White / clean |

- Colors interpolated smoothly each frame (lerp toward target)
- Preset name shown in header when cycling
- Hand skeleton: **Cyan** (left hand), **Magenta** (right hand)

---

## 6. SPECIAL EFFECTS

### Explosion:
- Triggered by FIST gesture
- `aExpVel` (pre-generated random spherical velocities) applied via `uExpT`
- Particles fly outward, then reform

### Rip Effect:
- Triggered by holding two-hand horizontal spread for 5s
- Progress bar fills over 5s
- Particles split into Group 0 (left) and Group 1 (right) via `uRipX`
- **Auto-reforms** after 3 seconds
- Reform has progress indicator

### Birth Animation:
- Triggered by voice command ("birth" / shape command resets)
- Scale tweens from 0 → full size

---

## 7. VOICE SYSTEM

### Speech Synthesis (Output):
- Low-pitched greeting on startup (after `Start` button click, brief delay)
- Feedback on shape changes ("Morphing to sphere...")
- `speechSynthesis.cancel()` before each new utterance

### Speech Recognition (Input):
- Continuous listening
- Shape commands: "sphere", "circle", "cube", "line", etc.
- "birth" → birth animation + reset
- Graceful fallback if API unsupported

---

## 8. UI LAYOUT

```
┌─────────────────────────────────────────┐
│  ZombAI         [Color Preset Name]     │  ← Header
│                                         │
│         [Three.js WebGL Canvas]         │  ← Full screen
│         [2D Skeleton Overlay]           │  ← Layered on top
│         [Camera Feed - hidden]          │  ← Off-screen video
│                                         │
│  Gesture: OPEN PALM    [Status HUD]     │  ← Overlay HUD
│                                         │
│  [●Sphere] [○Circle] [○Cube] [○Line]   │  ← Footer shape buttons
└─────────────────────────────────────────┘
```

- Start overlay (fullscreen) → hidden on click
- Resize listener → updates camera aspect + renderer size

---

## 9. ARCHITECTURE DECISIONS

| Decision | Rationale |
|----------|-----------|
| Single HTML file | No build tools, portable, easy to demo |
| Three.js r128 | Stable, CDN available, confirmed API compat |
| Custom GLSL (no shader library) | Full control over particle behavior |
| aBasePos captures mid-morph state | Prevents jump when morphing mid-transition |
| aGroup based on target X | Ensures rip cleanly splits any shape |
| THREE.Clock for delta time | Frame-rate independent animation |
| Frustum culling OFF | Positions computed in shader, bounding sphere invalid |
| Footer = click only (no gesture mapping to UI) | Simplicity first; gesture-to-UI can be added later |
| getUserMedia over camera_utils CDN | `Camera` class global not reliably exposed by jsdelivr CDN; native API always available |
| var over const/let in late script blocks | const/let can cause cross-block scope conflicts in classic scripts; var safely hoists to window |
| No immediate-running code in script blocks | All side effects in named init functions called from initApp(); prevents load-order race conditions |
| typeof guards on cross-block calls | All cross-script-block function calls wrapped with typeof check; prevents ReferenceError if load order shifts |
| aBasePos seeded near-zero at init | Prevents sphere flashing visible before birth animation fires |
| Birth animation isolated from morph | `birthActive` flag blocks `morphToShape()` and `morphActive` during blast sequence |
| SPHERE_RADIUS = 0.9, camera z = 3.5 | Halved from 1.8 per user feedback; camera adjusted to keep sphere well-framed |
| hands.js not hands.min.js | Minified bundle strips UMD global exports; full build required for `Hands` global |
| Guard + retry pattern for CDN scripts | MediaPipe WASM loads async; 1.5s retry prevents race condition crash |

---

## 10. WORKING STYLE & COLLABORATION RULES (CRITICAL)

### ⚠️ Key Instructions from User:
1. **Do NOT build the entire project in one go** — rate limits will break it
2. **Divide work into modules** — one module at a time
3. **Save each module as an artifact/file**
4. **PAUSE after each module** — wait for user confirmation before proceeding
5. **Keep context of previous work** always

### Collaboration Pattern:
- User provides direction + approves each step
- AI implements one module, saves it, pauses
- User reviews → confirms → AI proceeds to next module

---

## 11. MODULAR BUILD PLAN (Proposed)

### Module 1A — HTML Shell + CSS + UI Layout ✅ DONE
> Start overlay, header, footer buttons, HUD elements, canvas stacking, responsive layout
> File: `zombai-particle-sphere.html` (shell)

### Module 1B — Three.js Scene + Particle System ✅ DONE
> Breaking into sub-steps per user instruction (confirm each before proceeding):
> - **1B-i**: Three.js r128 CDN import ✅ DONE
> - **1B-ii**: 200,000 GPU particle BufferGeometry setup ✅ DONE
> - **1B-iii**: GLSL vertex + fragment shaders ✅ DONE
> - **1B-iv**: 7 shape generators + morphToShape() ✅ DONE
> - **1B-v**: Animation loop + shape button wiring ✅ DONE (added during blank-screen bugfix)

### USER COLLABORATION NOTE (added Session 2):
> User explicitly said: break Module 1B into smaller sub-steps. Confirm after each sub-step before proceeding. Do NOT batch multiple steps.

### Module 1C — MediaPipe Hand Tracking + Skeleton Overlay ✅ DONE
> - **1C-i**: MediaPipe Hands CDN ✅ FIXED (hands.js not hands.min.js; camera_utils dropped)
> - **1C-ii**: getUserMedia camera + rAF loop + onResults + handData + HUD badges ✅ CONFIRMED WORKING BY USER
>   - Bug 1: `hands.min.js` does NOT expose Hands global — fixed to `hands.js`
>   - Bug 2: `new Camera()` from camera_utils unreliable as global — replaced with `getUserMedia` + `requestAnimationFrame`
>   - Bug 3: No error handling — added guard for undefined Hands, retry after 1.5s, toast notifications, camera error messages
> - **1C-iii**: 2D skeleton drawing ✅ DONE (bones, dots, fingertip cursor, mirrored X, canvas pixel sizing)

**Key implementation notes:**
> - `handData = { left, right }` global — holds 21-landmark arrays, null when not detected
> - `HAND_CONNECTIONS` array (22 bone pairs) defined for manual skeleton drawing
> - `onHandResults()` fires every camera frame → updates handData → calls drawSkeleton() + processGestures()
> - Front camera mirror fix: MediaPipe 'Right' label = visual LEFT (cyan badge); 'Left' = visual RIGHT (magenta badge)
> - Skeleton X flip: `drawX = (1 - lm.x) * canvasWidth` applied in 1C-iii
> - processGestures() hook already wired → will be filled by Module 1D

### Module 1D — Gesture Recognition + Particle Effects ✅ REVISED (Session 10) — v2 gesture system live
> Old gestures REPLACED: OPEN_PALM, POINT, FIST-expand, two-hand vertical stretch
> Old gestures KEPT: FIST→explosion, PEACE→color cycle
> New gesture system:
> - **EXPAND** — two-hand distance increasing → uScale up (lerp)
> - **SQUEEZE** — two-hand distance decreasing → uScale down (lerp)
> - **ROTATE** — two-hand twist angle delta → rotation + inertia
> - **CLICK** — single pinch < 200ms → glow pulse
> - **PINCH→DRAG** — pinch held > 100ms → cluster follows hand XY
> - **DROP** — pinch release → momentum coast
> - **RIP** — sudden velocity spike in hand separation → bifurcate
> - **FIST** — kept → explosion (uExpT bell curve)
> - **PEACE** — kept → color cycle (4 presets)
>
> State machine: IDLE → PINCH_START → [CLICK | DRAG_ACTIVE] → DROP → IDLE
> Build order: 1D-rev-i (state machine + tracking) → 1D-rev-ii (EXPAND/SQUEEZE/ROTATE) → 1D-rev-iii (PINCH/DRAG/DROP) → 1D-rev-iv (RIP + FIST + PEACE)
> Sub-steps (confirm each):
> - **1D-i**: Finger extension + gesture classifier ✅ DONE
> - **1D-ii**: Single-hand actions (scale, explosion, color cycle, rotation) ✅ DONE
> - **1D-iii**: Two-hand gestures (uStretchY vertical + uRipX horizontal rip) ✅ DONE


> - **1D-iv**: Cooldowns (55 frames), gesture HUD label, rotation damping (0.97 decay) ✅ DONE

### Module 1D-footer — Footer Gesture Tap ✅ DONE
> - Detect "footer zone" = bottom ~15% of screen height
> - When index fingertip enters footer zone → suppress pinch/drag/drop
> - Map fingertip X → one of 7 shape buttons
> - Pinch in footer zone → trigger morphToShape() for that button
> - Visual: glow highlight on skeleton canvas showing hovered button
> - Ensure zero interference with particle gestures while in footer zone

### Swipe Gestures ✅ DONE (finalised session 15)
> **Direction:** SWIPE RIGHT (dX>0) = next shape | SWIPE LEFT (dX<0) = previous shape (wraps)
> **Shape cycle:** sphere→circle→cube→cuboid→square→rectangle→line
> **Detection:** rolling wrist buffer, 300ms window, 0.22 min displacement, 1.8× horizontal dominance
> **Carousel animation (swipe only — NOT on button click):**
>   - Phase 0 (280ms): cluster slides OUT in swipe direction + shrinks to 55% (ease-in quad)
>   - Phase boundary: morphToShape() + UNI.uMorphT=1.0 + morphActive=false → shape snaps instantly, NO blast
>   - Phase 1 (380ms): cluster slides IN from opposite side + settles at 50% scale (ease-out cubic)
>   - Resting scale = 0.50 → scaleTarget = 0.50 → user expands with EXPAND gesture
>   - carousel owns both scale and position; normal lerp-back suppressed during carousel
> **Key design decision:** shape must appear fully formed before sliding in (no morph tween during carousel)
> **Key design decision:** shape arrives at 50% scale — intentional entry state, not a bug
> **Guards:** disabled in footer zone, during pinch/drag, during birth animation, during carousel
> **Implementation notes:**
>   - var declarations (not const/let) — safely hoisted to window across script blocks
>   - initSwipe() called from initApp() — no immediate side effects on load
>   - runCarousel() called from updateGestureAnimations() via typeof guard
>   - CRITICAL LESSON: never use const/let or immediate code at top level of late-loading script blocks

### Auto-Hide Footer Tray ✅ DONE (Session 17)
> - Approach zone: fingertip or wrist y > 0.70 (bottom 30% of screen)
> - Reveal: 18 frames (~300ms) dwell in approach zone → `showFooterTray()`
> - Hide: 60 frames (~1s) outside approach zone → `hideFooterTray()`
> - CSS: `transition: transform 0.45s cubic-bezier(0.4,0,0.2,1)` + `.tray-hidden { transform: translateY(100%) }`
> - Startup: 3s grace (visible) via `initTray()` called from `initApp()`
> - `isInFooterZone()` uses `getBoundingClientRect()` → naturally deactivates when tray off-screen
> - Fingertip cursor draw suppressed via `footerTrayVisible` check in `drawFooterCursor()`
> - `clearFooterHover()` called automatically on hide to prevent stuck hover states
> - No conflicts with: swipe, carousel, birth animation, expand/squeeze/rotate/rip

### Module 1E — Voice System ✅ DONE (Session 18)
> **Part A — Speech Synthesis (ZombAI speaks on major events only):**
> - Startup: "ZombAI online. Gesture or speak to control." (800ms after init, pitch=0.55, rate=0.88)
> - Shape change: speaks shape name (called from morphToShape)
> - Explosion: "Boom" (called from triggerExplosion)
> - RIP: "Ripping" (called from triggerRip)
> - speechSynthesis.cancel() before each utterance — no overlap
>
> **Part B — Speech Recognition (continuous, auto-restarts):**
> - Shape commands: sphere/ball, circle/disc, cube/box, cuboid/brick, square/flat, rectangle/rect, line/stick/rod
> - Effect commands: explode/boom, rip/split/tear, expand/bigger, shrink/smaller/squeeze, reset, next, previous/back
> - Parses transcript word-by-word — first match wins
> - SpeechRecognition.continuous=true + onend auto-restart after 400ms
> - setVoiceStatus() wired — cyan pulsing dot in header when listening
> - Graceful fallback: mic denied or unsupported → voice disabled, no crash
>
> **Voice speech triggers (zombaiSpeak — updated session 23):**
> - ✅ Shape change → speaks shape name (from morphToShape)
> - ✅ Welcome greeting → "ZombAI online..." (from initVoice after 800ms)
> - ❌ Explosion → REMOVED (was "Boom")
> - ❌ RIP → REMOVED (was "Ripping")
> - No pitch change — pitch=1.0, rate=1.0, volume=1.0 (normal human voice)
> - Voice selected from settings modal dropdown or auto-picked (_pickBestVoice)

### Module 1F — Integration + Polish
> Wire all modules together, color preset cycling, morph capture mid-transition, auto-reform, resize handling, final QA

---

## 12. BUGS FIXED (All Sessions)

| Session | Bug | Symptom | Root Cause | Fix Applied |
|---------|-----|---------|-----------|-------------|
| 3 | Blank screen | Particle sphere invisible after Initialize | `renderer.render()` never called; `canvas.clientWidth` = 0 at init | Added `animate()` loop; switched to `window.innerWidth/Height` |
| 3 | Shape buttons broken | Clicking showed toast but no morph | `morphToShape()` missing; `uMorphT` never driven | Added 7 shape generators, `morphToShape()`, morph driver in loop |
| 5 | Camera not starting | Camera silent, no badges lit | `hands.min.js` strips globals; `Camera` class from `camera_utils` not reliably global | Switched to `hands.js`; replaced `Camera` with native `getUserMedia` + `rAF` loop |
| 11a | Drag inverted | Cluster moved opposite to hand | `dx` multiplier was `-3.5` — double-negated mirror flip | Changed to `+3.5` |
| 11b | RIP not triggering | Threshold 0.045 impossible to reach | Too high + 3-frame sustain too strict | Reduced to 0.028, sustain to 2 frames, init dist to 0.65 |
| 11c | Rotation too fast | Cluster spins uncontrollably | `wrappedDelta * 0.6` accumulated too aggressively | Reduced to 0.12, capped per-frame contribution ±0.025 |
| 14a | Camera not initialising | Camera silent after swipe added | const/let in swipe script block conflicting with browser lexical env across script blocks; immediate querySelectorAll running on load causing timing issue | Rewrote swipe block: var instead of const/let; all code inside functions; initSwipe() called from initApp() |
| 14b | Swipe hook in wrong place | trackSwipe called inside processSingleHandGestures (block 7) but defined in block 9 | Cross-script-block function reference before definition | Moved call to processGestures dispatcher with typeof guard |
| 12a | RIP never triggered | Per-frame velocity unreliable due to camera latency jitter | Replaced with charge-window: total dist change ≥ 0.18 within 700ms after arming at ≤ 0.42 apart |
| 11d | Rotation fires during EXPAND | Both use same two-hand tracking | No separation between gestures | Added `distChanging` gate — rotation disabled when |distDelta|>0.006 |
| 5 | Silent MediaPipe crash | No feedback when CDN still loading | No guard on `Hands` global, no error handling | Added `typeof Hands` guard, 1.5s retry, toast notifications, HUD error status |
| 8 | Sphere visible before blast | Sphere appeared immediately on Initialize click | `aBasePosArr` seeded with sphere positions; rendered before `triggerBirthAnimation()` fired | `aBasePosArr` now seeded to near-zero (0.008 jitter); `aTargPosArr` holds sphere; particles invisible until blast |

---

## 13. USER CONFIRMATIONS LOG

| Session | What was confirmed |
|---------|-------------------|
| 1 | Module-by-module approach approved |
| 2 | 1B approach (3 CDN + geometry) approved |
| 3 | Blank screen fixed — sphere visible ✅ |
| 3 | Shape morph buttons working ✅ |
| 5 | Camera confirmed working — hand badges lighting up ✅ |
| 6 | User logged memory before proceeding to 1C-iii |
| 7 | Skeleton drawing confirmed working ✅ |
| 8 | Birth animation (nuclear blast) confirmed working ✅ |
| 8 | Sphere size halved (SPHERE_RADIUS 1.8→0.9, camera z 5→3.5) confirmed ✅ |
| 9 | User tested 1D gestures and has specific change requests — pending discussion |
| 10 | Gesture revision spec confirmed. Keep FIST+PEACE. Proceed with 1D-rev plan. |
| 11 | 4 gesture bugs fixed: drag inverted, RIP broken (0.045 too high), rotation too fast, rotation conflicting with EXPAND |
| 12 | RIP redesigned — charge-window approach (total distance change in time window) |
| 12 | New feature requested: gesture tap on footer shape buttons; suppress pinch/drag in footer zone |
| 13 | Footer tap fixed: DOM-based button detection, tighter pinch threshold (0.038), rectangle removed, gap increased |
| 13 | Swipe LEFT/RIGHT added: cycles SHAPES_ORDER, 300ms window, 0.22 min displacement, position nudge + lerp back |
| 14 | Camera stopped initialising after swipe was added — fixed (see bugs log) |
| 14 | Swipe module rewritten: var declarations, no immediate code, initSwipe() called from initApp() |
| 15 | Swipe direction corrected (was inverted) — dX>0 = SWIPE RIGHT = next shape |
| 15 | Carousel animation added for swipe only — button clicks retain instant morph |
| 16 | Carousel Phase 1 end scale corrected: 100% → 50% (shape arrives smaller, user expands via gesture) |
| 16 | Blast animation suppressed during swipe: morphToShape() + uMorphT=1.0 + morphActive=false at phase boundary |
| 17 | Auto-hide footer tray implemented — hand approaches bottom 30% → 300ms dwell → slide up; away 1s → slide down |
| 17 | 3s startup grace period — tray visible on load, then auto-hides |
| 17 | Fingertip cursor suppressed on skeleton canvas when tray is hidden |
| 18 | Module 1E Voice System built — synthesis + recognition + command parser |
| 20-S2 | Settings gear button + modal HTML/CSS added (Cloud: Anthropic key, Local: endpoint+model dropdown, mode toggle, status, save) |
| 21-S3 | Settings JS: zombaiConfig store, openSettings/closeSettings, mode switch, validate (key format check), save to zombaiConfig, _prefillSettings, Escape+backdrop close |
| 21-FIX | Speech synthesis voice normalised: pitch 0.55→1.0, rate 0.88→1.0, volume 0.9→1.0 |
| 22-VOICE | Voice dropdown added to settings modal — shows all browser voices with lang + cloud indicator; auto-picks best English (Samantha > Google US > en-US > en) if none selected; onvoiceschanged fires on Chrome async load |
| 23-A | Explosion (Boom) and RIP (Ripping) speech removed — zombaiSpeak() now fires only on shape change + welcome greeting |
| 23-B | Voice command catalog added to start overlay — 19 command pills in 3 rows (Shapes / Colors / Effects), styled as dim cyan pills matching gesture guide aesthetic |
| 23-C | Swipe guide item added to gesture guide on overlay (👈👉 Swipe) |
| 24-S4-i | onresult now captures parseVoiceCommand return value → routes false to routeToAI() |
| 24-S4-ii | routeToAI(): aiCallActive debounce, zombaiConfig.ready guard, Cloud/Local branch |
| 24-S4-iii | ZOMBAI_SYSTEM_PROMPT: brief ZombAI context, 1-2 sentence replies, plain text, lang detect |
| 24-S4-iv | _handleAIResponse + _handleAIError: speaks response, HUD thinking indicator, 5 error cases |
| 24-S4-v | Welcome greeting: "Welcome to ZombAI Hub. Start with Voice or Gestures." |
| 19-S1 | Voice commands expanded: VOICE_COLORS table (16 keywords, 4 presets), setVoicePreset(), 10+ new VOICE_EFFECTS aliases, parseVoiceCommand now returns true/false for AI fallback routing |

---

## 14. NEXT STEP

**➡ Module 1D — Gesture Recognition + Particle Effects**

Sub-steps to confirm one at a time:
- **1D-i**: Finger extension detection utility (tip vs PIP joint comparison)
- **1D-ii**: Gesture classifier — OPEN_PALM, PINCH, FIST, PEACE, POINT
- **1D-iii**: Gesture → particle action mapping (scale, explosion, color cycle, rotation)
- **1D-iv**: Two-hand gestures — vertical stretch + horizontal rip with progress bar

**✅ DONE — All 1D-rev steps complete (1D-rev-i through 1D-rev-iv)**

---

## 15. COMPLETE VOICE FLOW (as of Session 24)

```
User speaks
  ↓ SpeechRecognition.onresult
  ↓ transcript extracted
  ↓ parseVoiceCommand(transcript)
      → keyword matched (shape/color/effect)
          → execute command
          → if shape change → zombaiSpeak(shapeName)
          → return true
      → no match → return false
          ↓ routeToAI(transcript)
              → zombaiConfig.ready === false
                  → showToast('Configure AI in ⚙ settings first')
                  → stop
              → zombaiConfig.mode === 'cloud'
                  → fetch Anthropic API (anthropicKey, claude-sonnet-4-20250514, max_tokens:120)
                  → success → _handleAIResponse(text)
                      → zombaiSpeak(text) [selected/auto voice]
                      → showToast('AI: preview...')
                  → error → _handleAIError → spoken error + toast
              → zombaiConfig.mode === 'local'
                  → fetch localEndpoint/chat/completions (localModel, stream:false)
                  → success → _handleAIResponse(text)
                  → error (CORS/network/empty) → _handleAIError → spoken error + toast
```

### Error fallback chain:
| Error | Toast | Spoken |
|-------|-------|--------|
| Config not saved | Configure AI in ⚙ settings first | (none) |
| 401 Anthropic | Invalid API key — check ⚙ settings | "API key is invalid. Please check your settings." |
| CORS / Ollama down | Local AI unreachable — is Ollama running? | "Cannot reach local AI. Make sure Ollama is running." |
| Empty response | AI returned empty response | "No response from AI." |
| Other | AI error: [first 40 chars] | "AI is unavailable right now." |

### Single-turn — no conversation history stored
