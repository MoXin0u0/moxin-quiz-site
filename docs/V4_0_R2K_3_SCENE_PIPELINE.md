# v4.0 R2K.3 — High-Fidelity Scene Pipeline

## Why this exists

R2K.2 proved that CSS was no longer the primary cause of the soft-looking scenes. The current 1600×900 WebP files are only roughly 30–90 KB and the source artwork itself is soft. R2K.3 therefore separates **scene delivery** from **scene artwork quality** so future high-detail assets can be dropped in without another architecture rewrite.

## Runtime loading

- Hero scene URLs are now assigned by `src/ui/scene-assets.js`.
- Only the selected `learningStyle + theme + scene` is requested.
- `sceneIntensity=off` and `learningStyle=focus` assign no artwork URL.
- Images are decoded before the background swaps in, reducing flash during style/theme changes.
- Root attribute changes are observed so settings apply immediately.
- Newly rendered review/exam/stats heroes are picked up automatically.

## Initial LCP

When the initial page uses `sceneIntensity=full`, the selected library Hero is preloaded from the inline settings bootstrap before CSS. Reduced/off do not receive this high-priority preload.

## PWA cache

Large scene assets are no longer part of `APP_SHELL`.

They use a dedicated runtime cache:

`moxin-quiz-scenes-r2k.3-1`

This prevents every Style Pack and theme variant from being downloaded during installation.

## Visual behavior

R2K.2 Full / Reduced / Off semantics remain intact. R2K.3 additionally removes the tiny full-mode transform scale to avoid unnecessary resampling softness.

## Asset quality

Run:

`npm run audit:scenes`

The audit reports current scene file sizes. It is informational because byte size is not a substitute for visual quality. The current R2K assets remain below the intended final quality target and should be replaced with genuinely high-detail source artwork rather than artificially sharpened/upscaled copies.

## Next asset drop

Final high-fidelity assets can preserve the existing filenames, or later add desktop/mobile variants to `SCENE_ASSETS`. No learning-page DOM rewrite is required.
