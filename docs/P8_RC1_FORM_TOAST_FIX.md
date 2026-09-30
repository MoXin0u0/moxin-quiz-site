# RC1：表單提交與 Toast 修補

本修補針對實機 RC 測試發現的兩個問題：

1. Practice / Exam 的表單未攔截瀏覽器原生 submit。
   - 填空題按 Enter 時可能把答案寫進 URL query，例如 `?answer=0`。
   - Practice 現在攔截 submit，阻止頁面 GET navigation，並走既有 `submitPracticeAnswer()`。
   - Exam 現在攔截 submit，阻止 navigation，並先保存目前答案。

2. 重複操作會產生大量相同 Toast。
   - 同訊息 / 同類型 Toast 現在去重。
   - 非 sticky Toast 同時最多保留 4 個。

另外：
- 啟動時會清除歷史殘留的 `answer` / `exam-answer` query，但保留其他 query 參數。
- Service Worker cache version 已升級，確保 RC1 資源可更新。
