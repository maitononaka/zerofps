# ZERO DIVISION v0.9

Browser FPS prototype built with Three.js.

## Launch
```bash
python -m http.server 8000
```
Open http://127.0.0.1:8000/

## Controls
WASD move / Mouse look / CTRL sprint / SHIFT crouch / Q,E lean / SPACE jump
1 main / 2 secondary / 3 melee / 4 med kit / R reload / H inspect / 0 debug / ESC pause

## v0.9
- Sprint drops to walk when movement stops
- Sliding ends in standing state
- Higher jump
- Mountain map uses a real height-field style forest terrain and terrain-aware player height
- Human-shaped training targets with damage and timed respawn
- Visible tracers and temporary impact marks
- Reload and inspection animations
- Dot / holo / standard sight selection
- Muzzle and stock attachment selection
- 1/2/3 weapon switching; 4 keeps the med kit
- No gameplay hotbar
- ESC pause can resume by clicking the pause panel
