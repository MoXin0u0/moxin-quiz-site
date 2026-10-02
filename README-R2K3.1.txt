MoXin Quiz v4.0 — R2K.3.1 Regression Hotfix

Target branch:
v4.0-learning-studio

Purpose:
1. Update stale R2G/R2H tests so they accept the R2K.3 runtime scene cache architecture.
2. Keep scene WebP assets out of APP_SHELL as intended by R2K.3.
3. Make V3 Regression auto-run on v4.* branches.
4. Include v4 CSS, learning assets, and scene audit script in workflow path filters.

Suggested commit:
test(v4.0): align scene regressions with runtime cache

After upload:
Actions -> V3 Regression
The push should now trigger automatically on v4.0-learning-studio.
