# Zero Division V12

V12 fixes the FPS view-model transform and movement-axis desynchronization.

Key changes:
- M4A1 is rendered from the authored GLB socket coordinate system.
- Hands are siblings of the weapon model and are positioned from the JSON sockets after the model transform.
- Optic/muzzle/stock sockets are transformed into the weapon-view coordinate space instead of being placed in source-model space.
- Weapon view is anchored to the right-hand socket; ADS is anchored to the optic socket.
- Horizontal movement reads the live Pointer Lock yaw every frame, so W/A/S/D follows the current view rather than the initial spawn direction.
- Sliding uses the live view yaw when starting.
- Compass follows the same yaw source.
