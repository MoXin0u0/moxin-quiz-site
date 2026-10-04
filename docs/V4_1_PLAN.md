# 墨忻刷題網 v4.1 — Public Landing & App Entry

## 版本定位

v4.1 不擴張 Learning Studio 核心功能，而是補上正式的「網站入口層」。

```text
index.html  → 公開首頁
app.html    → 學習大廳
v3.html     → 舊網址相容入口（與 app.html 相同）
```

PWA `start_url` 使用 `./app.html`，讓已安裝 App 的使用者直接進入學習大廳。

## 目標

- 第一次造訪者可以先理解網站用途，再決定是否進入。
- 公開首頁不初始化 IndexedDB，不載入完整 Learning Studio runtime。
- 核心學習大廳保持 Local-first / Offline。
- 舊 `v3.html` 連結不失效。
- 手機、平板、桌面與 Light / Dark 都可正常使用。

## 公開首頁內容

1. Hero + 開始使用
2. 核心功能
3. 如何開始
4. 更新日誌
5. 資料與隱私說明
6. 最終 CTA

## 版本邊界

v4.1 不實作：

- Google 登入
- 跨裝置雲端同步
- 多人房間
- Realtime backend

上述大型方向分別保留給後續主版本。

## Release Gates

- `npm run ci`
- Landing structural regression
- 5 viewport × Light/Dark Chromium audit
- axe serious/critical accessibility gate
- horizontal overflow gate
- Landing → App 真實點擊
- IndexedDB 大廳初始化成功
- `app.html === v3.html`
- Offline App Shell 包含 Landing + App
