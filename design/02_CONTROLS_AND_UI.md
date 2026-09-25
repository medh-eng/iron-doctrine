# Iron Doctrine: controls and UI

## 1. Principles

- **Landscape, full screen.** The world fills the whole screen. The HUD and controls float on top as translucent "acetate" layers, so the world always shows through.
- **Transparent thumb controls** sit in the bottom corners and brighten only when touched.
- **Touch the world directly.** Anything a button does can also be done by touching the world, where that makes sense: tap, drag, long-press, pinch.
- **Sizes:**
  - text: sentence case, 12 CSS px minimum; primary labels 14–16 px
  - touch targets: at least 44 px
  - thumb buttons: 64–88 px (size setting)

## 2. Screen map

- **Title** → Proving Ground, Campaign, Drafting Office, Blueprints, Settings
- **Proving Ground:** Workshop ↔ Battle → Level clear, Life lost or Game over
- **Campaign:** Map ↔ region, force and production drawers ↔ Drafting Office ↔ Battle → After-action report
- **Overlays anywhere:** Pause card, Settings, Rotate card

## 3. Battle screen

```
+--------------------------------------------------------------------+
| [sq1][sq2][sq3]  Destroy the trucks  ====---- 3/5  [minimap] T P S |
|                                                          (Follow)  |
|                                                          (Escort)  |
|                     world, full screen                   (Hold)    |
|                                                          (Attack)  |
|                                                          (Back)    |
|      (^)                                         (Alt)   (Swap)    |
|  (<)     (>)                                         (FIRE)        |
|      (v)                                    (Special)              |
+--------------------------------------------------------------------+
T = Start/Stop time   P = Pause   S = Settings
```

### 3.1 Top bar

About 34 px tall, translucent. Left to right:

- **Squad cards:** 3 small silhouettes with health, fuel and ammo bars. The vehicle you control is outlined. Tap a card to take control of that vehicle.
- **Objective:** text plus a progress bar. In the ladder this area also shows the level, score and lives (lives drawn as dog tags).
- **Minimap strip:** the terrain line, spotted units as dots, and the camera window.
- **Start/Stop time:** tactical freeze. The simulation stops, but you can still pan, zoom, pick targets and give orders. Tap again to resume.
- **Pause:** opens the pause card.
- **Settings.**

### 3.2 Left thumb: drive pad

Translucent discs. ◀ and ▶ are large; ▲ and ▼ appear only for vehicles that climb or dive.

| Vehicle | ◀ ▶ | ▲ ▼ |
|---|---|---|
| Ground, ship | Drive back / forward | Hidden |
| Helicopter | Move | Altitude |
| Submarine | Move | Depth |
| Aircraft | ▶ throttle up; ◀ throttle down (hold at low speed to turn around) | Pitch |

Pressing ◀ and ▶ together is the **halt/brake**. When stopped, a small crosshair tightens to show the stationary accuracy bonus.

### 3.3 Right thumb: action cluster

- **FIRE** (largest):
  - Tap: fire the main weapon at the current target using the fire-control solution.
  - Press and drag: manual aim. A dotted trajectory preview follows your thumb; release to fire. Drag back onto the button to cancel.
  - A ring around the button shows reload progress.
- **Alt:**
  - Tap: fire the secondary weapon (missiles, rockets, torpedoes, bombs).
  - Long-press: cycle secondary weapons.
  - Machine guns and AA guns fire automatically.
- **Swap:** take control of the next squad vehicle.
- **Special:** a context action, such as smoke, deploy stabiliser spades, drop cargo, field repair, or emergency surface/dive.

### 3.4 Order chips

A vertical column on the right edge, above the action cluster: **Follow, Escort, Hold, Attack, Back.** The active order is lit.

In campaign battles an extra **Command** chip opens a radial menu of force orders: Advance, Hold line, Flank, Bombard (then tap an area), Air strike (tap an area), Air cover, Smoke, Withdraw.

### 3.5 World gestures

| Gesture | What it does |
|---|---|
| Tap enemy | Set as target (for you and for the Attack order) |
| Tap own vehicle | Take control (if in your squad) or select its platoon to see its orders |
| Long-press ground | Squad-mates move there and hold |
| One-finger drag on empty world | Pan the camera; it stops following your vehicle and a Recenter chip appears |
| Pinch | Zoom 0.5×–2× |
| Double-tap | Reset zoom |

After 4 s without touching the world, the camera recenters on its own (this can be turned off in Settings).

### 3.6 Gesture arbitration

- A touch that **starts inside a control** belongs to that control until it is released (pointer capture). Every other touch goes to the world.
- Two world touches at once are a pinch.
- Touches that start within 24 px of a screen edge are ignored for world gestures, to avoid Android's back gesture.
- Tap timing is judged from the `pointerdown` event's `event.timeStamp`.

## 4. Map screen (campaign)

```
+--------------------------------------------------------------------+
| Day 12, 06:00 | wood 820+ metal 1.2k+ fuel 640- elec 90 ... | P S  |
|                                                 +---------------+  |
|                                                 | region/force  |  |
|        map: drag to pan, pinch to zoom          | drawer (tabs) |  |
|                                                 +---------------+  |
|                                                                    |
|  (< force)  (force >)                    (1x)(3x)(10x) ( > Start ) |
+--------------------------------------------------------------------+
```

### 4.1 Time and forces

- **Start/Stop:** a big translucent button at bottom right, labelled ▶ Start when stopped and ■ Stop when running, with speed chips beside it. When the clock stops automatically, a toast says why.
- **Force cycling:** ◀ ▶ at bottom left cycle through your forces; the camera flies to each one.

### 4.2 Touching the map

- **Tap a region:** opens the region drawer with terrain, features, settlement, buildings, stockpile, supply status and the build menu.
- **Tap a force:** opens the force drawer with its units, supply days left, stance and orders.
- **Move a force:** with a force selected, tap a destination. A path preview shows travel time and fuel; tap Confirm (or tap the destination again).
- **Long-press a region:** opens a quick-build radial menu.

### 4.3 Map information

- **Layer toggles** (under the top bar, right): Supply, Terrain, Resources, Fog.
- **Resource strip:** each resource shows an icon drawn in code (not emoji), the amount and a trend arrow. Tap it for a breakdown.

## 5. Drafting Office

```
+--------------------------------------------------------------------+
| < Back   Medium tank Mk.II (rename)   24.1 t  310/420 kW  ...    S |
| +--------+                                         +------------+  |
| | Struct |                                         | Stats      |  |
| | Mobil. |          blueprint grid                 | terrain    |  |
| | Weapon |       (pinch zoom, 2-finger pan)        | costs      |  |
| | System |                                         | warnings   |  |
| | Logist.|                                         | vs Mk.I    |  |
| +--------+                                         +------------+  |
|  (Undo) (Redo)                              (Test drive) (Save)    |
+--------------------------------------------------------------------+
```

- **Placing parts:** drag a part from the palette onto the grid. A ghost preview shows valid (light blue) or invalid (red); if invalid, a one-line reason appears.
- **Placed parts:** tap to select, then drag to move, or use Flip, Delete or Info.
- **Grid view:** two-finger pinch zooms, two-finger drag pans.
- **Thumb corners:** bottom left is Undo/Redo; bottom right is Test drive and Save. Save creates the next mark.
- **Stats drawer:**
  - numbers only
  - speed per terrain table
  - costs
  - factual warnings
  - changes compared with the previous mark
- **Palette and stats drawers** collapse so the grid can use the whole screen.

## 6. Other screens

**Title**
- Stencil logo and tagline.
- Proving Ground: "Continue at level N" and "Play from level 1".
- Campaign (appears in Part 3), Drafting Office, Blueprints gallery, Settings.
- Best score and highest level.
- A small fullscreen button.
- Behind it all, a live AI-vs-AI battle with the camera slowly tracking.

**Pause card**
- Resume, Settings, Restart level (ladder), Quit to title (campaign: Save and quit).
- The game also pauses automatically when the app goes to the background, when the window loses focus, and in portrait.

**Level clear**
- Stamp animation and score breakdown.
- Reward: blueprint or medal.
- Next level, or Workshop.

**Life lost:** a short card with a Retry button.

**Game over**
- Score, level reached, best.
- "Continue at level N", "Play from level 1", Title.

**After-action report** (campaign), facts only:
- losses and kills
- damage per unit
- supplies spent
- experience gained
- captured wrecks
- highlights of what happened

**Rotate card:** in portrait, a phone outline turns sideways with the text "Turn your phone sideways to play." The game pauses.

## 7. Settings

- **Audio:** Music on/off and volume, Sound on/off and volume, Vibration on/off.
- **Controls:**
  - button opacity: 10–80%, default 30%
  - button size: S, M, L
  - left-handed swap
  - auto-recenter camera
  - aim assist line
- **Display:**
  - fullscreen
  - graphics quality:

    | Quality | Pixel ratio | Particles |
    |---|---|---|
    | Low | 1 | 120 |
    | Medium | 1.5 | 200 |
    | High | 2 | 300 |

  - reduced motion (no shake, fewer flashes)
  - show FPS
- **Gameplay:** campaign auto-stop events (checkboxes), auto-resolve default, difficulty (set at campaign start).
- **Data:**
  - Export save (copy a code)
  - Import save (paste a code)
  - Reset progress (confirm twice)
  - version number

## 8. Look of the transparent controls

| State | Look |
|---|---|
| Idle | Smoked acetate disc. Fill is staff ink at 18% × the opacity setting; grease-pencil outline at 50%; glyph at 70% |
| Pressed | Fill warms toward tracer amber at 45%, glyph at 100%, scale 0.94, soft amber glow ring. Eases back over 120 ms on release |
| Ghost mode | After 4 s untouched, fades to 60% of idle opacity |
| Disabled | Dashed outline |

Glyphs are drawn as grease-pencil strokes: slightly wobbly, seeded so they don't shimmer.

The opacity setting scales every value in the table: the default 30% gives exactly the values shown, 80% is about 2.7× stronger and 10% a third as strong. Outlines and glyphs also get a thin dark under-stroke, so they stay visible over bright skies as well as dark ground.

## 9. Keyboard and mouse (desktop)

| Action | Input |
|---|---|
| Drive | A / D or ← / → |
| Climb / dive | W / S or ↑ / ↓ |
| Fire | Space, or click an enemy; hold right mouse button to aim manually |
| Alt weapon | F |
| Swap | E or Tab |
| Special | Q |
| Squad orders | 1–5 |
| Start / Stop time | T (on the map: Space) |
| Pause | P or Esc |
| Zoom / pan | Mouse wheel / drag |
| Recenter | C |
| Map speed | + / − |

## 10. Haptics

Vibration only runs when the Vibration setting is on.

| Moment | Pattern |
|---|---|
| UI tap | 8 ms |
| Fire | 12 ms |
| Hit taken | 35 ms |
| Part destroyed | 20-30-20 |
| Vehicle lost | 80-40-80 |
| Level clear | 30-40-30-40-120 |

## 11. Safe areas, fullscreen and orientation

- `viewport-fit=cover`. Pad the HUD and controls by `env(safe-area-inset-*)` on all sides; in landscape the notch is on the left or right.
- On the first tap from the title screen (if the Fullscreen setting is on): call `requestFullscreen()`, then `screen.orientation.lock('landscape')`. Ignore errors. This happens on touch devices only; on desktop the title's small full-screen button does it.
- Desktop: letterbox to 16:9, at most 1280 px wide, centred.
