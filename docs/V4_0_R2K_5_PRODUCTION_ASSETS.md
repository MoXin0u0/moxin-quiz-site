# v4.0 R2K.5 — Production Scene Asset Drop

## Scope

R2K.5 replaces the soft R2K scene artwork with a complete production set:

- 16 desktop WebP scene assets at 2560×1440.
- 16 dedicated mobile WebP crops at 1080×1440.
- Academy and Epic retain separate object language.
- Library / Review / Exam / Stats each have separate compositions.
- Light and Dark use separate palettes and lighting.
- The left side intentionally remains quieter for Hero text; the primary artwork lives in the right/content-safe region.

## Runtime integration

`src/ui/scene-assets.js` now declares `mobile` variants for every Academy/Epic scene.
Desktop keeps the 2560×1440 source; mobile switches to the 1080×1440 art-directed crop instead of forcing a desktop crop.

## Cache invalidation

Because the asset URLs are intentionally stable, both Service Worker cache versions are advanced to R2K.5.
This is required so existing users do not keep the old R2K artwork in the cache-first scene cache.

## Quality contract

The R2K.5 regression test requires:

- desktop assets >= 2560×1440
- mobile assets >= 1080×1440
- each production file >= 160 KB
- all files wired through the runtime scene loader
- scene cache version = R2K.5

The existing `npm run audit:scenes` remains useful as an independent asset audit.

## Manual acceptance

Check all 16 combinations in Full mode first, then Reduced and Off:

1. Academy and Epic should be visually distinct without relying only on color.
2. Main objects should remain sharp at desktop Hero size.
3. Mobile should keep the intended focal object in frame.
4. Left-side learning text must stay readable.
5. Reduced must visibly recede; Off must issue no runtime scene request.
