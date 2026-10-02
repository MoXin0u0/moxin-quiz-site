MoXin Quiz v4.0 — R2K.5 Production Scene Asset Drop

Target branch:
v4.0-learning-studio

What this patch does:
- Replaces all 16 Academy/Epic desktop scenes with 2560x1440 production WebP assets.
- Adds 16 dedicated 1080x1440 mobile scene assets.
- Wires every mobile asset into src/ui/scene-assets.js.
- Bumps both APP and scene runtime cache versions to R2K.5 so old cache-first artwork is purged.
- Adds R2K.5 regression coverage and loosens the R2K.4 milestone version assertion.
- Keeps Full / Reduced / Off behavior unchanged.

Important:
This is a real asset replacement, not a UI mockup.
The art direction intentionally uses crisp, high-resolution illustration and a quiet left content-safe area so Full mode no longer depends on a soft atmospheric background.

Local targeted validation completed:
- node --check: PASS
- R2K.5 production asset test: PASS
- npm run audit:scenes equivalent: 0 warnings
- 32/32 scene assets meet dimension and file-size targets

Suggested commit:
style(v4.0): replace learning scenes with production art assets

After upload:
V3 Regression should start automatically on v4.0-learning-studio.

Manual review:
Check Academy/Epic x Library/Review/Exam/Stats x Light/Dark in Full mode first.
Then verify Reduced and Off, plus desktop/mobile crops.
