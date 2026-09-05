# ZERO DIVISION v9

Zero Division FPS prototype with a custom M4A1 GLB view-model.

## Run

Open the folder with VS Code Live Server or run `python -m http.server 8000`.

## Controls

- WASD: move
- Mouse: look
- CTRL: dash
- SHIFT: hold crouch / slide when sprinting
- SPACE: jump / slide-jump
- RMB: ADS
- Q / E: lean
- R: reload
- H: inspect
- 1 / 2 / 3: primary / secondary / melee
- 4: medkit
- 0: debug overlay

## v9 changes

- Rebuilt first-person M4A1 pose around the imported GLB sockets.
- Removed the old side-view reset that made the rifle render horizontally across the screen.
- Normalized the M4A1 forward axis to -Z and tuned normal/ADS poses.
- Repositioned left/right hands around the handguard and pistol grip.
- Movement now uses the camera world-space forward/right vectors, so W/A/S/D remain consistent at every heading.
- Slide direction uses the same camera-space movement basis.
- ADS, lean, weapon bob and recoil continue to move the view-model as one assembly.
- Debug overlay shows pressed keys only while debug is open.
