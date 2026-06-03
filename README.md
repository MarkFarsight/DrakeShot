# Drakeshot — a browser voxel sandbox ("Minecraft with guns")

Single-player, offline, built with **Three.js + vanilla JavaScript**. Everything
is vendored locally (`lib/three.min.js`), so nothing is downloaded at runtime.

## How to run

**Just double-click `index.html`.** It opens in your default browser and runs —
no server, no terminal, no setup. (You can also right-click → Open With → Chrome/Safari.)

> Click the page to capture the mouse for first-person look. Press **Esc** to release it.

The game uses plain `<script>` tags (not ES modules) specifically so it runs from
a `file://` path by double-clicking.

**Saving note:** progress is saved to your browser's `localStorage`. Most browsers
persist this for a double-clicked file; if yours blocks storage for local files
you'll see a small warning, and you can enable saving by serving the folder
(`python3 -m http.server` then open `http://localhost:8000`) or using Chrome.

## Controls

| Action | Key |
|---|---|
| Move | **W A S D** |
| Look | mouse |
| Jump | **Space** |
| Hotbar slots | **1**–**7** (1 = gun, 2–7 = blocks) or mouse wheel |
| Fire gun | **left-click** (gun slot selected) |
| Break block | **left-click** (block slot selected) |
| Place block | **right-click** (block slot selected) |
| Inventory + crafting | **E** |
| Force field on/off | **F** |
| Charge dragon egg | **C** (stand by the egg) |
| Respawn (after death) | **R** |

### Dragon quest

Mobs drop **Energy Stones**. Find the **dragon egg** in the valley (under the beam of
light), craft a **Crafting Block** and place it next to the egg, then press **C** to pour
in stones. **10** hatches a purple dragon that flies, perches on peaks, and swoops at you —
it takes **60 Heavy-Gun hits** to bring down.

## Project layout

```
Drakeshot/
├─ index.html            # the page + HUD; loads the scripts below in order
├─ css/style.css         # all HUD / overlay / inventory styling
├─ lib/
│  └─ three.min.js       # vendored Three.js, global build (offline)
└─ src/
   ├─ main.js            # boots everything + game loop + save/load wiring
   ├─ world.js           # voxel terrain, merged mesh, collision, edits
   ├─ player.js          # first-person movement, physics, health
   ├─ input.js           # keyboard / mouse / pointer-lock
   ├─ interaction.js     # block targeting outline + break/place
   ├─ weapons.js         # equip / fire / ammo / muzzle flash / tracer
   ├─ enemies.js         # blocky mobs: spawn, chase, bite, take damage
   ├─ inventory.js       # counts + hotbar model
   ├─ crafting.js        # the crafting engine
   ├─ ui.js              # HUD + the "E" inventory/craft screen
   ├─ save.js            # robust localStorage wrapper
   ├─ noise.js           # seedable noise + PRNG for terrain
   └─ data/              # << simple data files meant for editing >>
      ├─ blocks.js       #    block types (colours)
      ├─ terrain.js      #    world size / hill settings
      ├─ guns.js         #    3 gun tiers: stats + viewmodels
      └─ recipes.js      #    the 5 crafting recipes
```

Each `src` file defines globals used by the files loaded after it (see the script
order in `index.html`). The four files in `data/` are the simple knobs to tweak.

## Milestones — all complete

- [x] **M1 — World + movement**
- [x] **M2 — Breaking + placing blocks**
- [x] **M3 — The gun** (3 tiers, procedural viewmodels, muzzle flash + tracer)
- [x] **M4 — Enemies + HUD + health**
- [x] **M5 — Inventory + crafting + gun upgrades**
- [x] **M6 — Saving / loading** (auto-save + New World)

## Tuning cheat-sheet

- Enemies: `src/enemies.js` → `ENEMY` (speed, HP, damage, spawn rate/count/distance).
- Guns: `src/data/guns.js` → damage / magazine / colours / model shapes.
- Recipes: `src/data/recipes.js` → ingredients & outputs (keep it to these 5).
- World: `src/data/terrain.js` → size, hill height, seed.

_Multiplayer is intentionally out of scope for v1 — a possible future addition._
