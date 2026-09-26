# Iron Doctrine: controls and UI (v2)

## 1. Principles

- **Landscape, full screen.** The HUD and controls are translucent overlays (smoked acetate), so the world always shows through.
- **Thumb controls** sit in the bottom corners. They are transparent until touched.
- **Touch the world directly:** tap, drag, long-press and pinch anywhere.
- **Text:** sentence case. At least 12 CSS px; primary labels 14–16 px.
- **Sizes:** touch targets at least 44 px. Thumb buttons 64–88 px, set by the size setting.
- **Safe areas** on all four sides.
- **Portrait** shows the rotate card and pauses the game.

## 2. Screen map

- **Title** → Continue campaign, New campaign (pick a faction), Battle Simulator, Drafting Office, Blueprint gallery, Settings.
- **Campaign:** World map ↔ fleet panel, settlement panel, logistics view, research and perks, Drafting Office, war journal.
- **Battle:** pre-battle card → battle → result card (salvage, XP, losses).
- **Overlays anywhere:** Pause card, Settings, Rotate card.

## 3. Battle screen

```
+------------------------------------------------------------------------+
| [ship1][ship2][ship3] [Reserve 5 >]  Objective ===---  [minimap] T P S |
|                                                                        |
|                        world (full screen)                             |
|                                                                        |
|      (^)                                            (Group)  (Swap)    |
|  (<)     (>)                                               (FIRE)      |
|      (v)                                       (Utility)               |
+------------------------------------------------------------------------+
T = Start/Stop time (tactical freeze)   P = Pause   S = Settings
```

### 3.1 Top bar

- **Ship cards:** your 3 on-field ships, showing silhouette, captain level, and bars for hull, fuel, ammo and heat.
  - The ship you drive is outlined.
  - Tap a card: drive that ship.
  - Long-press a card: open that ship's command wheel (§3.4).
- **Reserve button:** opens the line-up drawer.
  - Reserve ships are listed in order, with condition.
  - Drag to reorder.
  - "Send in" swaps the selected reserve ship for a chosen on-field ship, which then pulls back.
- **Objective and minimap:** the minimap strip shows the whole battlefield, including incoming reserves.
- **Start/Stop time:** tactical freeze. The simulation stops, but the camera and orders still work.

### 3.2 Left thumb: drive pad

| Ship type | ◀ ▶ | ▲ ▼ |
|---|---|---|
| Land, sea | Drive back / forward | Hidden |
| Airship | Move | Climb / descend |

Pressing ◀ and ▶ together is the **halt/brake**. When stopped, a small crosshair tightens to show the stationary accuracy bonus.

### 3.3 Right thumb: action cluster

- **FIRE:**
  - Tap: fire the selected weapon group at the current target, using the fire-control solution.
  - Press and drag: manual aim with a trajectory preview; release to fire.
  - A ring around the button shows the reload.
- **Group:** cycle weapon groups (guns, missiles, flamethrowers, energy). The icon shows the group; a small bar shows ammo or heat.
- **Swap:** drive the next on-field ship.
- **Utility:** quick flares or smoke for the ship you're driving. Long-press for the full utility list: flares, smoke, launch drones, release clamp.

### 3.4 Command wheel

Opened by long-pressing a ship card or a ship in the world.

| Order | How |
|---|---|
| Move to | Tap a point |
| Fire at | Tap a target or point |
| Hold | Stay put |
| Pull back | Return to reserve |
| Flares | |
| Smoke | |
| Launch drones | Then tap a target or point |
| Release | Detach a clamped section |

- Orders confirm with a radio blip and a small grease-pencil marker in the world.

### 3.5 World gestures

| Gesture | What it does |
|---|---|
| Tap enemy | Set the target |
| Tap own ship | Drive it |
| Long-press own ship | Command wheel |
| One-finger drag | Pan the camera (a Recenter chip appears) |
| Pinch | Zoom 0.5×–2× |
| Double-tap | Reset zoom |

**Arbitration rules:**
- A touch that starts on a control belongs to that control until it is released.
- Two world touches at once are a pinch.
- Touches within 24 px of a screen edge are ignored, to avoid Android's back gesture.
- Timing uses `event.timeStamp`.

### 3.6 Pre-battle and result cards

- **Pre-battle card:**
  - forces on both sides (enemy shown as far as spotted)
  - battlefield type and weather
  - line-up editor (drag to order)
  - buttons: Fight, Auto-resolve, Retreat (with its cost shown)
- **Result card:**
  - win or loss stamp
  - losses, damage and XP bars
  - salvage reveal (items flip in one by one)
  - "Load salvage" (limited by cargo space)

## 4. World map

```
+------------------------------------------------------------------------+
| Day 12, 06:00 | Treasury 4,820 | [fleet cargo strip]          | R P S  |
|                                                   +------------------+ |
|                                                   | fleet/settlement | |
|        map: drag to pan, pinch to zoom            | panel (tabs)     | |
|                                                   +------------------+ |
|  (< fleet)  (fleet >)                         (1x)(3x)(10x) (> Start)  |
+------------------------------------------------------------------------+
R = Research and perks   P = Pause   S = Settings
```

### 4.1 Top bar and thumbs

- **Top bar:**
  - date and time
  - **treasury** (money is global)
  - the **selected fleet's cargo strip**: fuel, ammo, wood, metal, electronics, scrap, parts, with capacity used
  - Research, Pause, Settings
- **Thumb buttons:**
  - ◀ ▶ cycle your fleets; the camera flies to each.
  - The **Start/Stop** clock sits with speed chips (1×, 3×, 10×).
  - When the clock stops on its own, a toast says why.

### 4.2 Touching the map

- **Tap a fleet:** fleet panel. With a fleet selected, tap a destination: the path preview shows travel time, **fuel needed vs fuel held**, and a warning if you'll be stranded.
- **Tap a settlement:** settlement panel.
- **Long-press:** a quick-order radial menu (Move, Follow, Intercept, Siege, Patrol).
- **Layer toggles:** Supply routes, Terrain, Territory, Weather, Fog.

### 4.3 Fleet panel tabs

- **Ships:** list with class, captain and level, condition and fuel.
  - Detach captain here.
  - Transfer ships to another fleet in the same place.
- **Cargo:** the hold contents, and transfers to a docked settlement or a nearby fleet.
- **Orders:** stance and route. Convoys get **supply route** editing here.
- **Admiral:** level, fleet-size cap, flagship class cap, XP.

### 4.4 Settlement panel tabs

Only the services that type has are shown (01 §7.1).

| Tab | What's there |
|---|---|
| Overview | Owner, type, production, warehouse, garrison, walls |
| Market | Buy and sell fuel, ammo and resources, with the docked fleet's hold |
| Warehouse | Move goods between the warehouse and the docked fleet |
| Workshop | Craft parts, upgrade parts (Mk II and III), crafting queue |
| Refinery | Scrap → electronics |
| Yard | Build ships from designs, refit and swap parts, repair |
| Barracks | Recruit captains with ships, admirals, quartermasters |
| Walls | Emplacement slots: install weapon parts |
| Upgrade | Village → city or fort, and so on; shows costs vs warehouse stock |

## 5. Logistics view

- A map layer showing:
  - every convoy route, with arrows
  - each fleet's fuel days and ammo
  - warehouse stock levels as small bars on settlements
- Fleets or convoys running low glow amber; stranded ones glow red.

## 6. Drafting Office

```
+------------------------------------------------------------------------+
| < Back  [Ship|Missile|Drone]  Land: Tank ▾  "Ironside" Mk II    ...  S |
| +--------+                                            +--------------+ |
| |Struct. |                                            | Stats        | |
| |Mobil.  |            blueprint grid                  | per terrain  | |
| |Weapon  |      (pinch zoom, 2-finger pan)            | costs        | |
| |System  |                                            | warnings     | |
| |Logist. |                                            | vs last Mk   | |
| +--------+                                            +--------------+ |
|  (Undo) (Redo)                          (Paint) (Simulate) (Save)      |
+------------------------------------------------------------------------+
```

- **Tabs:** Ship, Missile, Drone.
- **Selectors:** domain and class set the grid and part limit. The part counter shows used / allowed.
- **Palette:**
  - Unlocked parts only, filtered by domain.
  - Items **in stock** at the current settlement or fleet show a count.
  - Parts not in stock can still be placed. The Yard crafts them when building, if they're unlocked.
- **Stats drawer:**
  - numbers only
  - changes vs the previous mark in neutral amber, never green or red
  - factual warnings
- **Paint:** faction scheme or custom primary, secondary and accent colours from the paint-shop palette, plus a camouflage pattern (07 §3).
- **Simulate:** opens the Battle Simulator with this design.

## 7. Research and perks

- **Tech tree:** pannable and zoomable; branches run left to right, tiers run top to bottom.
  - Each node shows its unlocks, Command Point cost, money and electronics cost, where it can be researched, and research time.
- **Perk tree:** 3 branches (Command, Logistics, Engineering), plus Trade.
- **Grand Admiral card:** level, XP, and unspent Command Points.

## 8. Other screens

- **Title:** logo, tagline, menu, and a live AI-vs-AI battle behind it.
- **Pause card:** Resume, Settings, Save and quit.
  - The game also pauses automatically when the app goes to the background or the phone turns to portrait.
- **War journal:** automatic entries for battles, captures, new marks, medals and lost captains.
- **Blueprint gallery:** captured enemy designs and parts.

## 9. Settings

- **Audio:** Music on/off and volume, Sound on/off and volume, Vibration.
- **Controls:**
  - button opacity (10–80%, default 30%)
  - button size (S, M, L)
  - left-handed swap
  - auto-recenter camera
  - aim line
- **Display:**

  | Quality | Pixel ratio | Particles |
  |---|---|---|
  | Low | 1 | 120 |
  | Medium | 1.5 | 200 |
  | High | 2 | 300 |

  - fullscreen
  - reduced motion
  - show FPS
- **Gameplay:** clock auto-stop events, auto-resolve default, difficulty (set at campaign start).
- **Data:** Export save (copy a code), Import save (paste a code), Reset (confirm twice), version number.

## 10. Transparent controls, keyboard, haptics

**Control look**

| State | Look |
|---|---|
| Idle | Acetate disc: staff-ink fill at 18% × the opacity setting; grease-pencil outline at 50%; glyph at 70% |
| Pressed | Fill warms toward amber at 45%, glyph at 100%, scale 0.94, amber glow |
| Ghost | After 4 s untouched, fades to 60% of idle opacity |

**Keyboard and mouse**

| Action | Input |
|---|---|
| Drive | A / D or ← / → |
| Climb / descend | W / S or ↑ / ↓ |
| Fire | Space, or click an enemy (hold right mouse button to aim manually) |
| Weapon group | F |
| Swap | E or Tab |
| Utility | Q |
| Command wheel | Right-click a ship |
| Reserve drawer | R |
| Start/Stop time | T (on the map: Space) |
| Pause | P or Esc |
| Zoom / pan | Mouse wheel / drag |

**Haptics** (only when Vibration is on)

| Moment | Pattern |
|---|---|
| Fire | 12 ms |
| Hit taken | 35 ms |
| Part destroyed | 20-30-20 |
| Ship lost | 80-40-80 |
| Victory | 30-40-30-40-120 |
