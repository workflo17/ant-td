// ===== Board camera: a zoomable window onto the fixed 960x640 world =====
// Phones view the battlefield through this; desktop plays at 1x and never notices.
import { WORLD_W, WORLD_H } from '../data/maps.js';

// map bakes are DPR<=2 — past ~2.5x the baked art goes soft, so stop there
export const CAM_MAX = 2.5;

export const cam = { x: 0, y: 0, z: 1 }; // x/y = world coords of the view's top-left

export function resetCam() { cam.x = 0; cam.y = 0; cam.z = 1; }

// keep the view window inside the world (at z=1 this pins x=y=0)
export function clampCam() {
  cam.z = Math.max(1, Math.min(CAM_MAX, cam.z));
  cam.x = Math.max(0, Math.min(WORLD_W - WORLD_W / cam.z, cam.x));
  cam.y = Math.max(0, Math.min(WORLD_H - WORLD_H / cam.z, cam.y));
}
