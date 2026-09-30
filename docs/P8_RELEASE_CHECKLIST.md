# P8 Release Candidate 驗收表

P8 不新增大型功能，目標是把 v3 從「功能已完成」推進到「可升格正式入口」。

## A. 自動化品質閘門

每次 push 到 `next-v3`，GitHub Actions 的 `V3 Regression` 會執行：

1. `npm test`
   - P0/P1 schema / migration / validator / scoring / path
   - P3 practice
   - P4 learning lists / session resume
   - P5 review / mastery
   - P6 exam
   - P7 backup / settings

2. `npm run preflight`
   - v3.html 資源是否存在
   - HTML ID 是否重複
   - Manifest 是否可解析
   - PWA icon 是否存在且 PNG 尺寸正確
   - Service Worker App Shell 是否有缺檔
   - 所有相對 ES module import 是否可解析
   - 全部 JS / MJS syntax check
   - v3 CSS custom property 是否有未定義引用
   - v3 是否誤引用舊版 `script.js` / `style.css`
   - App Shell 是否引入遠端 runtime dependency

只有 Actions 綠燈，才進入實機驗收。

## B. 桌機驗收

建議 Chrome / Edge 最新版各測一次。

- [ ] v3 首頁可正常載入，Console 無紅色錯誤
- [ ] IndexedDB 顯示已就緒
- [ ] 匯入 `examples/sample-v2` ZIP 成功
- [ ] 匯入舊格式 JSON 可自動 migration
- [ ] 題庫搜尋 / 題型 / 難度 / 章節篩選
- [ ] 單選、複選、是非、填空判分
- [ ] 答錯回 queue
- [ ] 收藏 / 不熟 / 筆記
- [ ] 離開後恢復 Practice Session
- [ ] 今日複習
- [ ] 學習統計
- [ ] 模擬考題號導覽
- [ ] 模擬考重新整理後可恢復
- [ ] 模擬考交卷與分析
- [ ] 深色模式
- [ ] 字體 / 選項間距 / 減少動畫

## C. 手機驗收

至少測一支實體手機；寬度以 360–430 px 為主。

- [ ] 頂部導覽不造成頁面水平溢位
- [ ] 題庫卡片文字不截斷重要操作
- [ ] 所有按鈕可單手點擊
- [ ] 題目選項沒有過小 touch target
- [ ] 長題幹與長選項正常換行
- [ ] 題目圖片不超出畫面
- [ ] 模擬考題號導覽可操作
- [ ] 虛擬鍵盤開啟時填空 / 筆記可正常輸入
- [ ] 深色模式文字對比清楚
- [ ] PWA 可加入主畫面 / 安裝
- [ ] 關閉網路後，曾載入過的 v3 仍可開啟
- [ ] 離線時已匯入題庫仍可作答

## D. 平板驗收

建議約 768–1024 px 寬。

- [ ] 題庫 grid 不過密
- [ ] 題庫詳情 filter 排版正常
- [ ] Practice / Exam 主內容寬度適中
- [ ] 旋轉直向 / 橫向後不破版

## E. 備份 / 還原驗收

使用一份包含圖片、筆記、收藏與作答紀錄的題庫。

- [ ] 下載完整備份 JSON 成功
- [ ] 備份後再新增一筆學習資料
- [ ] 執行完整還原
- [ ] 還原後題庫數量正確
- [ ] 題庫圖片仍可顯示
- [ ] 收藏 / 不熟 / 筆記存在
- [ ] attempts / progress / reviewSchedule 存在
- [ ] Practice / Exam Session 狀態符合備份當時
- [ ] 外觀設定恢復

## F. PWA / 離線驗收

- [ ] Manifest 可在 DevTools Application 中讀取
- [ ] Service Worker 為 Activated and running
- [ ] App Shell 無 install error
- [ ] 第一次在線載入完成後切 Offline
- [ ] Offline reload `v3.html` 成功
- [ ] IndexedDB 題庫離線可用
- [ ] 回到 Online 後頁面仍正常
- [ ] Service Worker 更新後會提示新版資源

## G. 升格 index.html 前的門檻

以下全部成立才切換正式入口：

- [ ] `V3 Regression` GitHub Actions 綠燈
- [ ] 桌機驗收完成
- [ ] 手機驗收完成
- [ ] 平板至少完成一種尺寸
- [ ] 備份 / 還原完成一次
- [ ] PWA 離線完成一次
- [ ] 沒有 P0 / P1 級阻塞 bug
- [ ] 舊版 `main` 保留可回退的 commit / tag

通過後再做「Release Cutover」：
1. 保留舊版 release tag。
2. 將 v3 入口升格為 `index.html`。
3. 再跑一次完整 CI。
4. GitHub Pages 實站 smoke test。
