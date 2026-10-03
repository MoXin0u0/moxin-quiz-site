# v4.0 R2K.4 — Responsive Scene Runtime

## Scope

R2K.4 stops producing visual mockups and continues the implementation work behind the learning Hero scene system.

The current R2K artwork remains the active production asset set for this patch. R2K.4 does **not** claim that the existing 1600×900 assets have become high fidelity. Instead it makes the runtime ready for the final production asset drop without another loader rewrite.

## Changes

### 1. Responsive art-direction contract

`src/ui/scene-assets.js` now treats every scene/theme entry as an asset descriptor instead of a single URL.

Supported candidate slots:

- `desktop`
- `desktop2x`
- `mobile`
- `mobile2x`

The current assets occupy the `desktop` slot. If a mobile or 2x asset is not present, the loader falls back safely to the desktop asset.

This means the final asset refresh can add files without changing the learning-page DOM.

### 2. Per-scene focal positioning

Academy and Epic now have explicit focal positions for:

- Library
- Review
- Exam
- Stats

Desktop and mobile positions are separate. This prevents every Hero from using the same generic `76% center` crop.

### 3. Style/theme switching without blank flashes

When a different scene asset is needed, the currently visible scene remains on screen while the next image loads and decodes.

State flow:

`ready -> swapping -> ready`

The existing `loading` state is only used when no previous scene is available.

### 4. Data-saver behavior

Runtime scene loading now checks:

- `navigator.connection.saveData`
- `prefers-reduced-data: reduce`

When either is active, scene artwork is not requested by the runtime loader.

`sceneIntensity=off` and `learningStyle=focus` continue to request no scene artwork.

### 5. High-DPI readiness

The resolver now checks device pixel ratio and supports `desktop2x` / `mobile2x` candidates when those production files are added.

No low-resolution asset is artificially sharpened or upscaled in this patch.

### 6. Scene audit upgraded

`npm run audit:scenes` now reports:

- actual WebP dimensions
- file size
- desktop target: at least 2560×1440
- optional mobile target: at least 1080×1440

The audit remains informational rather than blocking CI because visual quality cannot be determined from dimensions or byte size alone.

## Cache behavior

Core App Shell cache:

`moxin-quiz-v3-4.0.0-r2k.4-1`

Scene runtime cache intentionally remains:

`moxin-quiz-scenes-r2k.3-1`

The active scene files did not change in this patch, so retaining the scene cache avoids unnecessary downloads. A later production asset replacement should bump the scene cache version.

## Next production step

The next asset drop should replace the current Academy / Epic source artwork with genuinely high-detail production scenes and then add mobile-specific crops where needed. The runtime contract introduced here already supports that structure.
