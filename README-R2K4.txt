MoXin Quiz v4.0 — R2K.4 Responsive Scene Runtime

Target branch:
v4.0-learning-studio

This is an implementation patch, not a visual mockup.

Files to overwrite/add:
- src/ui/scene-assets.js
- service-worker.js
- package.json
- scripts/audit-scene-assets.mjs
- tests/v40-r2k3-scene-pipeline-run.mjs
- tests/v40-r2k4-responsive-scene-runtime-run.mjs
- docs/V4_0_R2K_4_RESPONSIVE_SCENE_RUNTIME.md

Suggested commit:
refactor(v4.0): add responsive scene art direction runtime

Expected behavior:
- Existing Academy/Epic production scenes continue to work.
- Style/theme changes keep the previous scene visible until the next image decodes.
- Data Saver / prefers-reduced-data stops runtime scene downloads.
- Mobile and high-DPI asset slots are supported with safe desktop fallback.
- Each scene has its own desktop/mobile focal point.
- The core Service Worker cache bumps to r2k.4; scene cache remains r2k.3 because image files are unchanged.

Validation:
1. Upload all files to v4.0-learning-studio.
2. V3 Regression should trigger automatically.
3. Run `npm run audit:scenes` locally if desired.
   The current artwork is expected to produce quality warnings because the final high-fidelity asset replacement has not happened yet.
