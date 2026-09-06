# ZERO DIVISION V14

Three.js FPS prototype update.

## Changes
- Larger first-person M4A1 view model.
- Correct GLB barrel-axis conversion: source +X -> camera-forward -Z.
- JSON socket positions remain in source-model coordinates.
- Default attachments remain hidden unless selected.
- ADS uses the `optic` socket as the rear/iron-sight anchor and moves the view model toward the eye so the anchor is centered.
- Crosshair hides while ADS, reloading, or inspecting.
- Gameplay yaw is synchronized from the actual pointer-lock camera every frame, so WASD follows the current view direction instead of the initial heading.
- Socket attachment rotation/scale no longer gets an incorrect extra transform.
- Muzzle flash is placed directly on the JSON `muzzle` socket.
- Hands stay socket-driven and are kept visually smaller.

Run with VS Code Live Server or:

```bash
python -m http.server 8000
```
