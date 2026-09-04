# ZERO DIVISION v0.6.1

v0.6.1 is a bug-fix release for the v0.6 browser prototype.

## Important fix
Three.js 0.185.1 PointerLockControls no longer provides `getObject()`. The old call caused:

`TypeError: this.controls.getObject is not a function`

The game now keeps the camera directly controlled by PointerLockControls.

## Run

```bash
python -m http.server 8000
```

Open `http://localhost:8000/`.
