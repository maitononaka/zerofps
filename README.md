# Zero Division V16

Fixes the M4A1 first-person view using the supplied GLB and socket JSON as a single coordinate system.

- M4A1 source model: assets/m4a1.glb
- Socket data: assets/m4a1_sockets.json
- M4 local X axis is treated as the barrel axis; the exported mesh is rotated +90deg around Y so the muzzle points forward (-Z) in the FPS camera.
- The socket JSON controls optic, muzzle, foregrip, stock, hands and iron-sight anchors.
- ADS uses the optic socket only when an optic is equipped; otherwise it uses the iron_rear socket.
- Socket scale values are used directly; no hidden x10 multiplier.
