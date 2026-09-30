# P8 自動化回歸結果

基準：`next-v3` P7 commit `b4117d0dc242ac413fbf7a6c75c79a513b941d84`

## 已通過

- P0/P1 unit tests
- P3 unit tests
- P4 unit tests
- P5 unit tests
- P6 unit tests
- P7 unit tests
- 所有 `src/` / `tests/` JavaScript syntax check
- `service-worker.js` syntax check
- Service Worker App Shell：46 個資源全部存在
- 相對 ES module import：無缺失
- `v3.html`：無重複 ID
- Manifest icon：路徑完整
- v3 CSS custom properties：無未定義引用

## 尚需實機完成

目前自動測試環境的 Chromium 被平台政策禁止載入 localhost / file URL，因此未把瀏覽器互動測試冒充成已完成。

仍需用真實瀏覽器完成：

- IndexedDB 匯入 / 還原
- Service Worker install / offline reload
- PWA 安裝
- 手機與平板 RWD
- 模擬考倒數與重新載入恢復
- 實際圖片 Blob 顯示
- 深色模式視覺對比

請依 `docs/P8_RELEASE_CHECKLIST.md` 驗收。
