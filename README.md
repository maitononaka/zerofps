# ZERO DIVISION v0.9.4

- Menu UI is fully self-contained in `index.html`.
- The menu no longer depends on `main.js` or `ui.js` loading successfully.
- Three.js/game code is loaded only after pressing Deploy.
- `game.js` reads the shared state from `window.ZERO_DIVISION_STATE`.
- Favicon request is replaced with an inline data icon to avoid favicon 404 noise.

Run with Live Server or:

```bash
python -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.


## v0.7 audio update
- Added `assets/m4a1.ogg` as the primary firearm firing sound.
- Other firearm types reuse the same sample with different playback rates: M4A1 1.00x, AKM 0.86x, SMG45 1.16x, P320 1.07x, G18 1.30x.
- Melee keeps the synthetic impact tone.
- Audio is triggered only by in-game user interaction and gracefully ignores blocked playback.
