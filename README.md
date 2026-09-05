# Zero Division V12

Fixes the root cause of the fixed-world WASD bug and the M4A1 view-model/socket placement.

- Live pointer-lock yaw is synchronized into gameplay every frame.
- M4A1 sockets are transformed from source GLB space into weapon-view space exactly once.
- Hands are siblings of the weapon model, avoiding inherited transform drift.
- Weapon position is anchored to the authored right-hand socket.
- ADS is anchored to the authored optic socket.
- Muzzle flash uses the authored muzzle socket.
