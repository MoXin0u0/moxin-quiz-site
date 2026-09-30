# RC2：深色模式恢復卡片對比修補

實機 RC 驗收發現，在深色模式下：

- Practice 的未完成 Session 恢復卡片
- Exam 的未完成模擬考恢復卡片

仍沿用淺色模式固定背景與邊框，造成文字對比不一致。

RC2 在 dark theme 下統一改用：

- `background: var(--surface-soft)`
- `border-color: var(--line)`
- 主要文字：`var(--text)`
- 次要文字：`var(--muted)`

另外：

- Service Worker cache 升級為 `moxin-quiz-v3-rc2-1`
- RC1 regression test 改為接受後續 RC cache 版本，避免未來正常升版時產生假失敗
