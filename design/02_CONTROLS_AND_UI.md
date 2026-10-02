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
| Submarine (built in v1) | Drive back / forward | Depth order, with a depth readout |
| Airship | Move | Climb / descend (the v1 helicopter controls) |
| Aircraft (built in v1) | Throttle | Pitch (level flight on release, hold ▲ to loop) |
| Helicopter (built in v1) | Move | Height |

Pressing ◀ and ▶ together is the **halt/brake**. When stopped, a small crosshair tightens to show the stationary accuracy bonus.

### 3.3 Right thumb: action cluster

- **FIRE:**
  - Tap: fire the selected weapon group at the current target, using the fire-control solution.
  - Press and drag: manual aim with a trajectory preview; release to fire.
  - A ring around the button shows the reload.
- **Group:** cycle weapon groups (guns, missiles, flamethrowers, energy). This is the v1 Alt button, which already fires torpedoes, depth charges and bombs. The icon shows the group; a small bar shows ammo or heat.
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
  - **Drone** (built in 5c, a Drones button beside Missiles): the same card, with sizes set by the drone computer (I 8×4, II 10×5, III 12×6), drone parts, and numbers (mass, lift and lift ÷ weight, speed, HP, weapons, camera reach, cost). Use in this ship's hangars sets the ship's drone. The ship's stats show drones carried and how many fly at once. In battle, long-pressing a carrier adds Drones (aboard + flying) to the command wheel: Attack, Defend, Scout, Recall.
  - **Missile** (built in 5b, a card opened from the Missiles button): size chips (small 6×1, medium 10×2, large 16×3), the designs to start from, the missile grid (tap a cell to place the chosen part, tap a part to remove it), the missile parts, the numbers (mass, speed, range, guidance and turn rate, warhead, space, cost) and plain rule problems. Save as new keeps it with your designs; Carry on this ship sets the missile this ship's racks and VLS carry. The Ship tab's stats show the missile carried and how many each launcher holds.
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
- **As built (v0.5.0):** the Research button in the map's top bar opens a card (the clock waits while it's open): Grand Admiral level, XP to the next level and Command Points free of earned; tabs Tech tree and Perks; a Drafting Office button. The tree scrolls both ways with branch and tier labels kept in view; a node shows its state (known, researching, or its CP). Tapping it lists tier, CP, money, electronics, scrap, days, prerequisites and unlocks, with a Research button for each of your cities or metropolises that can do it, or the reason it can't. The campaign Drafting Office palette shows researched parts only, and placing a locked part is refused with the node it needs.
- **As built (v0.6.3):** the Relations button beside Research opens a card (the clock waits): for each other faction, at war or truce, your reputation, its settlements, contested-border days (in truce) and the day of your last battle with it; at war an Offer truce button with the tribute, or the reason they won't talk; in truce Declare war, which asks to confirm. Below, which other factions are in truce. A neutral village's Info tab shows its charter price and the reputation it costs with nearby factions, and a Buy charter button when a fleet of yours is docked there. Another faction's settlement shows your reputation with it.

## 8. Other screens

- **Title:** logo, tagline, menu, and a live AI-vs-AI battle behind it.
- **Pause card:** Resume, Settings, Save and quit.
  - The game also pauses automatically when the app goes to the background or the phone turns to portrait.
- **War journal:** automatic entries for battles, captures, new marks, medals and lost captains.
- **Blueprint gallery:** captured enemy designs and parts.
- **Help (v0.7.1), in Settings → Help so it takes no screen space:**
  - **How to play:** short pages: Basics, Battle controls, Vehicles and damage, Campaign map, Fleets and officers, Economy and logistics, Drafting Office and research.
  - **Objectives:** what the battle under way asks (level goal and progress, campaign battle or siege, Simulator, tutorial step), or the campaign's victory conditions and progress, or an overview from the title.
  - **Glossary:** Vehicles (every design: domain, class, faction, mass, speed, weapons, picture), Parts (every part and material: category, tier, size, numbers, faction-only), Factions (identity, strengths, weaknesses, signature parts, AI build weights), Places (settlement types, goods and prices), Terms; read from the game's data, with a search box.
  - **Hints (v0.7.2):** a toggle (on by default) for a Hint button on the campaign map with ideas for what to do next, from the situation. How to play has a search box over every page and the glossary terms.
  - **Garrison (v0.7.2):** a settlement's Info tab lists buttons to take garrison ships out: an admiral or the Grand Admiral there forms a fleet; with none, Appoint an admiral (600).
  - **Tutorial:** a guided practice battle (two of yours against an armoured car that holds fire until the last step): drive, fire, aim by hand, swap, give an order, stop time, then win; a banner shows one step at a time and moves on when it's done; Skip leaves. Offered once on the title screen to a player with no battles yet, and from Help on the title screen. The campaign map shows four first-time tips once.

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
  - text size: S, M, L, XL (90%, 100%, 115%, 130%); scales every menu and the battle and map labels. The battle's top bar and the map's button bars stop at 115% and 110%, because they have no room to grow (6f)
  - reduced motion: no screen shake, flashes at 60% size and under half brightness, no pulsing warnings or popping numbers, every menu animation ends at once
  - show FPS
- **Colour is never the only sign (6f):**
  - each faction has a mark shape beside its colour: League ● circle, Directorate ■ square, Skyreach ▲ triangle, Clans ✚ cross, Lumen ◆ diamond. It shows on the map (settlement pennants and fleet counters), in the War room and on the faction picker
  - battle minimap: yours are squares, theirs are triangles; flagship pennants are a triangle for yours and a square flag for theirs
  - map fuel rings: solid red ring when stranded or out of fuel, dashed amber ring when low; a planned move that would strand is dotted, not dashed, and its line says "strands on the way"
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
