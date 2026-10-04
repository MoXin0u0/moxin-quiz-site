const LANDING_HTML = "<!doctype html>\n<html lang=\"zh-Hant\">\n<head>\n  <meta charset=\"utf-8\" />\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n  <meta name=\"description\" content=\"墨忻刷題網 v4.1｜本機優先、可離線使用的個人學習與刷題平台。\" />\n  <meta name=\"theme-color\" content=\"#3559d9\" />\n  <meta name=\"apple-mobile-web-app-capable\" content=\"yes\" />\n  <meta name=\"apple-mobile-web-app-status-bar-style\" content=\"default\" />\n  <meta name=\"apple-mobile-web-app-title\" content=\"墨忻刷題\" />\n  <title>墨忻刷題網｜首頁</title>\n\n  <link rel=\"manifest\" href=\"manifest.webmanifest\" />\n  <link rel=\"icon\" href=\"assets/pwa/icon-192.png\" sizes=\"192x192\" />\n  <link rel=\"apple-touch-icon\" href=\"assets/pwa/icon-192.png\" />\n\n  <script>\n    try {\n      const raw = localStorage.getItem('moxin.v3.settings');\n      const settings = raw ? JSON.parse(raw) : {};\n      const preference = ['system', 'light', 'dark'].includes(settings.theme) ? settings.theme : 'system';\n      const theme = preference === 'system'\n        ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')\n        : preference;\n      document.documentElement.dataset.themePreference = preference;\n      document.documentElement.dataset.theme = theme;\n      document.documentElement.dataset.reduceMotion = settings.reduceMotion === true ? 'true' : 'false';\n    } catch {}\n  </script>\n\n  <link rel=\"stylesheet\" href=\"styles/v41-landing.css\" />\n</head>\n<body class=\"landing-body\">\n  <a class=\"skip-link\" href=\"#mainContent\">跳到主要內容</a>\n\n  <header class=\"landing-header\">\n    <a class=\"landing-brand\" href=\"./\" aria-label=\"墨忻刷題網首頁\">\n      <span class=\"landing-brand-mark\" aria-hidden=\"true\">墨</span>\n      <span>\n        <strong>墨忻刷題網</strong>\n        <small>MoXin Quiz</small>\n      </span>\n    </a>\n\n    <nav class=\"landing-nav\" aria-label=\"首頁導覽\">\n      <a href=\"#features\">功能</a>\n      <a href=\"#howToStart\">如何開始</a>\n      <a href=\"#updates\">更新</a>\n      <a href=\"#data\">資料說明</a>\n    </nav>\n\n    <a class=\"landing-header-cta\" href=\"./app.html\">開始使用</a>\n  </header>\n\n  <main id=\"mainContent\">\n    <section class=\"landing-hero\" aria-labelledby=\"landingHeroTitle\">\n      <div class=\"landing-hero-copy\">\n        <div class=\"landing-eyebrow\">\n          <span>Local-first</span>\n          <span>PWA</span>\n          <span>v4.1</span>\n        </div>\n\n        <h1 id=\"landingHeroTitle\">把每一次練習，<br />都留在自己的學習節奏裡。</h1>\n        <p class=\"landing-hero-lead\">\n          從題庫、練習、複習到學習統計，墨忻刷題網把個人刷題流程整理在同一個本機優先的學習空間。\n          不強迫登入；已加入的題庫可離線繼續使用。\n        </p>\n\n        <div class=\"landing-hero-actions\">\n          <a class=\"landing-button primary\" href=\"./app.html\">開始使用</a>\n          <a class=\"landing-button secondary\" href=\"#features\">先看看功能</a>\n        </div>\n\n        <div class=\"landing-trust-row\" aria-label=\"平台特性\">\n          <span><i aria-hidden=\"true\"></i> 不強迫登入</span>\n          <span><i aria-hidden=\"true\"></i> 本機保存學習資料</span>\n          <span><i aria-hidden=\"true\"></i> 支援離線使用</span>\n        </div>\n      </div>\n\n      <div class=\"landing-hero-preview\" aria-label=\"學習大廳功能示意\">\n        <div class=\"preview-window\">\n          <div class=\"preview-topbar\">\n            <span class=\"preview-brand-dot\" aria-hidden=\"true\">墨</span>\n            <div>\n              <strong>你的學習空間</strong>\n              <small>從今天最值得做的下一步開始</small>\n            </div>\n          </div>\n\n          <div class=\"preview-focus-card\">\n            <span>今日學習</span>\n            <strong>練習 · 複習 · 目標 · 衝刺</strong>\n            <div class=\"preview-progress\" aria-hidden=\"true\"><i></i></div>\n          </div>\n\n          <div class=\"preview-grid\">\n            <article>\n              <span>題庫工作室</span>\n              <strong>建立自己的題庫</strong>\n              <small>單題編輯、圖片、批次建題</small>\n            </article>\n            <article>\n              <span>學習統計</span>\n              <strong>看見練習軌跡</strong>\n              <small>趨勢、弱點、題庫分析</small>\n            </article>\n            <article class=\"wide\">\n              <span>考前衝刺</span>\n              <strong>把錯題、不熟題與到期題排進今天</strong>\n            </article>\n          </div>\n        </div>\n        <div class=\"preview-orbit orbit-one\" aria-hidden=\"true\"></div>\n        <div class=\"preview-orbit orbit-two\" aria-hidden=\"true\"></div>\n      </div>\n    </section>\n\n    <section class=\"landing-strip\" aria-label=\"產品定位\">\n      <div><strong>本機優先</strong><span>核心資料保存在目前瀏覽器</span></div>\n      <div><strong>跨裝置自由</strong><span>可用完整備份自行轉移資料</span></div>\n      <div><strong>離線可用</strong><span>PWA App Shell 支援離線學習</span></div>\n      <div><strong>題庫自主</strong><span>匯入、製作、匯出自己的題庫</span></div>\n    </section>\n\n    <section class=\"landing-section\" id=\"features\" aria-labelledby=\"featuresTitle\">\n      <div class=\"landing-section-heading reveal\">\n        <span>功能總覽</span>\n        <h2 id=\"featuresTitle\">不是只有「答題」，而是一套完整的個人學習流程。</h2>\n        <p>題庫內容與個人學習資料分離；你可以專心練習，也可以逐步建立自己的學習系統。</p>\n      </div>\n\n      <div class=\"landing-feature-grid\">\n        <article class=\"landing-feature-card reveal\">\n          <span class=\"feature-index\">01</span>\n          <h3>題庫與練習</h3>\n          <p>加入作者題庫或自己的 ZIP / JSON / 資料夾題庫，支援單選、複選、是非與填空。</p>\n        </article>\n        <article class=\"landing-feature-card reveal\">\n          <span class=\"feature-index\">02</span>\n          <h3>今日學習</h3>\n          <p>把複習、學習目標與考前衝刺集中到 Learning Hub，減少每天重新決定下一步的成本。</p>\n        </article>\n        <article class=\"landing-feature-card reveal\">\n          <span class=\"feature-index\">03</span>\n          <h3>錯題與間隔複習</h3>\n          <p>保留錯題、不熟題、收藏、筆記與到期複習，讓一次作答能延續成之後的學習線索。</p>\n        </article>\n        <article class=\"landing-feature-card reveal\">\n          <span class=\"feature-index\">04</span>\n          <h3>模擬考</h3>\n          <p>設定題數與時間，支援未完成考試恢復、題號導覽、倒數與交卷後分析。</p>\n        </article>\n        <article class=\"landing-feature-card reveal\">\n          <span class=\"feature-index\">05</span>\n          <h3>學習統計</h3>\n          <p>查看 7 / 30 日趨勢、正確率、弱點章節、題型表現與單題庫分析。</p>\n        </article>\n        <article class=\"landing-feature-card reveal\">\n          <span class=\"feature-index\">06</span>\n          <h3>題庫工作室</h3>\n          <p>建立、編輯與批次整理題目，管理圖片素材，並輸出可分享的 Schema 2.0 題庫 Package。</p>\n        </article>\n      </div>\n    </section>\n\n    <section class=\"landing-section landing-how\" id=\"howToStart\" aria-labelledby=\"howTitle\">\n      <div class=\"landing-section-heading reveal\">\n        <span>如何開始</span>\n        <h2 id=\"howTitle\">不需要先設定一堆東西。</h2>\n      </div>\n\n      <ol class=\"landing-steps\">\n        <li class=\"reveal\">\n          <span>1</span>\n          <div><strong>進入學習大廳</strong><p>按下「開始使用」，直接進入個人學習空間。</p></div>\n        </li>\n        <li class=\"reveal\">\n          <span>2</span>\n          <div><strong>選擇或加入題庫</strong><p>可使用作者題庫，也能匯入自己整理的題庫。</p></div>\n        </li>\n        <li class=\"reveal\">\n          <span>3</span>\n          <div><strong>開始練習</strong><p>作答結果會保存在本機，並逐步形成錯題、熟練度與複習排程。</p></div>\n        </li>\n        <li class=\"reveal\">\n          <span>4</span>\n          <div><strong>回到複習與統計</strong><p>利用今日學習與統計頁面決定接下來最值得處理的內容。</p></div>\n        </li>\n      </ol>\n\n      <div class=\"landing-center-action reveal\">\n        <a class=\"landing-button primary\" href=\"./app.html\">進入學習大廳</a>\n      </div>\n    </section>\n\n    <section class=\"landing-section landing-updates\" id=\"updates\" aria-labelledby=\"updatesTitle\">\n      <div class=\"landing-section-heading reveal\">\n        <span>更新日誌</span>\n        <h2 id=\"updatesTitle\">目前版本與最近更新。</h2>\n      </div>\n\n      <div class=\"update-timeline\">\n        <article class=\"update-item current reveal\">\n          <div class=\"update-marker\" aria-hidden=\"true\"></div>\n          <div>\n            <div class=\"update-meta\"><strong>v4.1</strong><time datetime=\"2026-10-04\">2026-10-04</time><span>目前版本</span></div>\n            <h3>Public Landing &amp; App Entry</h3>\n            <p>新增正式網站首頁，將「認識網站」與「進入學習大廳」分層；PWA 仍直接進入 App。</p>\n          </div>\n        </article>\n\n        <article class=\"update-item reveal\">\n          <div class=\"update-marker\" aria-hidden=\"true\"></div>\n          <div>\n            <div class=\"update-meta\"><strong>v4.0</strong><span>Learning Studio</span></div>\n            <h3>個人學習系統完成</h3>\n            <p>題庫工作室、學習目標、考前衝刺、統計與首頁快捷操作，以及完整的 RWD / Theme / Offline Release Readiness。</p>\n          </div>\n        </article>\n      </div>\n    </section>\n\n    <section class=\"landing-section\" id=\"data\" aria-labelledby=\"dataTitle\">\n      <div class=\"landing-data-card reveal\">\n        <div>\n          <span class=\"landing-kicker\">資料與隱私</span>\n          <h2 id=\"dataTitle\">核心學習資料，預設留在你的瀏覽器。</h2>\n          <p>\n            墨忻刷題網目前採 Local-first 設計。題庫、作答紀錄、錯題、收藏、筆記、熟練度、學習目標與工作室草稿，\n            主要保存在目前裝置的 IndexedDB。網站不要求登入才能使用核心功能。\n          </p>\n        </div>\n\n        <div class=\"data-points\">\n          <div><strong>換裝置前</strong><span>建議先下載完整備份</span></div>\n          <div><strong>清除網站資料前</strong><span>先確認已有可還原備份</span></div>\n          <div><strong>跨裝置雲端同步</strong><span>規劃於後續主版本獨立處理</span></div>\n        </div>\n      </div>\n    </section>\n\n    <section class=\"landing-final-cta reveal\" aria-labelledby=\"finalCtaTitle\">\n      <span>準備好了嗎？</span>\n      <h2 id=\"finalCtaTitle\">進入自己的學習空間。</h2>\n      <p>不需要建立帳號。先選一個題庫，就可以開始。</p>\n      <a class=\"landing-button primary\" href=\"./app.html\">開始使用墨忻刷題網</a>\n    </section>\n  </main>\n\n  <footer class=\"landing-footer\">\n    <div class=\"landing-brand compact\">\n      <span class=\"landing-brand-mark\" aria-hidden=\"true\">墨</span>\n      <span><strong>墨忻刷題網</strong><small>個人學習與刷題平台</small></span>\n    </div>\n    <p>v4.1 · 最後更新 2026-10-04</p>\n    <a href=\"./app.html\">進入學習大廳</a>\n  </footer>\n\n  <script type=\"module\" src=\"src/app/landing.js\"></script>\n</body>\n</html>\n";
const LANDING_CSS = "/* v4.1 — Public Landing & App Entry */\n\n:root {\n  color-scheme: light;\n  --landing-bg: #f5f7fc;\n  --landing-surface: rgba(255, 255, 255, .9);\n  --landing-surface-strong: #ffffff;\n  --landing-text: #172034;\n  --landing-muted: #667085;\n  --landing-line: rgba(30, 47, 79, .12);\n  --landing-primary: #3559d9;\n  --landing-primary-strong: #2546bd;\n  --landing-primary-soft: #e9edff;\n  --landing-accent: #0c8c88;\n  --landing-gold: #b97817;\n  --landing-shadow: 0 18px 55px rgba(45, 64, 107, .12);\n  --landing-shadow-soft: 0 10px 30px rgba(45, 64, 107, .08);\n  --landing-radius-xl: 32px;\n  --landing-radius-lg: 22px;\n  --landing-radius-md: 16px;\n  --landing-max: 1180px;\n}\n\nhtml[data-theme=\"dark\"] {\n  color-scheme: dark;\n  --landing-bg: #0e1320;\n  --landing-surface: rgba(21, 29, 47, .88);\n  --landing-surface-strong: #171f31;\n  --landing-text: #f5f7ff;\n  --landing-muted: #aeb8cc;\n  --landing-line: rgba(207, 220, 255, .14);\n  --landing-primary: #8ea4ff;\n  --landing-primary-strong: #aebdff;\n  --landing-primary-soft: rgba(93, 119, 238, .16);\n  --landing-accent: #66d7d0;\n  --landing-gold: #f0bd68;\n  --landing-shadow: 0 18px 60px rgba(0, 0, 0, .32);\n  --landing-shadow-soft: 0 10px 32px rgba(0, 0, 0, .22);\n}\n\n* {\n  box-sizing: border-box;\n}\n\nhtml {\n  scroll-behavior: smooth;\n}\n\nbody.landing-body {\n  margin: 0;\n  min-width: 0;\n  background:\n    radial-gradient(circle at 8% 4%, color-mix(in srgb, var(--landing-primary) 9%, transparent), transparent 27rem),\n    radial-gradient(circle at 92% 14%, color-mix(in srgb, var(--landing-accent) 9%, transparent), transparent 30rem),\n    var(--landing-bg);\n  color: var(--landing-text);\n  font-family:\n    Inter, \"Noto Sans TC\", \"Microsoft JhengHei\", \"PingFang TC\",\n    system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n  line-height: 1.6;\n}\n\na {\n  color: inherit;\n}\n\n.skip-link {\n  position: fixed;\n  z-index: 999;\n  top: .75rem;\n  left: .75rem;\n  padding: .6rem .9rem;\n  transform: translateY(-160%);\n  border-radius: 10px;\n  background: var(--landing-text);\n  color: var(--landing-bg);\n  text-decoration: none;\n}\n\n.skip-link:focus {\n  transform: translateY(0);\n}\n\n.landing-header {\n  position: sticky;\n  z-index: 20;\n  top: 0;\n  display: grid;\n  grid-template-columns: auto 1fr auto;\n  align-items: center;\n  gap: 1.2rem;\n  width: min(calc(100% - 2rem), var(--landing-max));\n  min-height: 74px;\n  margin: 0 auto;\n  padding: .65rem 0;\n  backdrop-filter: blur(18px);\n}\n\n.landing-header::before {\n  position: fixed;\n  z-index: -1;\n  inset: 0 0 auto;\n  height: 74px;\n  border-bottom: 1px solid color-mix(in srgb, var(--landing-line) 72%, transparent);\n  background: color-mix(in srgb, var(--landing-bg) 82%, transparent);\n  content: \"\";\n}\n\n.landing-brand {\n  display: inline-flex;\n  align-items: center;\n  gap: .65rem;\n  text-decoration: none;\n}\n\n.landing-brand-mark {\n  display: grid;\n  width: 42px;\n  height: 42px;\n  place-items: center;\n  border-radius: 13px;\n  background: linear-gradient(145deg, var(--landing-primary), color-mix(in srgb, var(--landing-primary) 70%, var(--landing-accent)));\n  box-shadow: 0 8px 20px color-mix(in srgb, var(--landing-primary) 22%, transparent);\n  color: #fff;\n  font-size: 1.15rem;\n  font-weight: 900;\n}\n\n.landing-brand > span:last-child {\n  display: grid;\n  line-height: 1.2;\n}\n\n.landing-brand strong {\n  font-size: .95rem;\n  letter-spacing: .01em;\n}\n\n.landing-brand small {\n  margin-top: .15rem;\n  color: var(--landing-muted);\n  font-size: .66rem;\n  font-weight: 700;\n}\n\n.landing-nav {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: .25rem;\n}\n\n.landing-nav a {\n  min-height: 44px;\n  padding: .68rem .75rem;\n  border-radius: 12px;\n  color: var(--landing-muted);\n  font-size: .82rem;\n  font-weight: 760;\n  text-decoration: none;\n}\n\n.landing-nav a:hover,\n.landing-nav a:focus-visible {\n  background: var(--landing-primary-soft);\n  color: var(--landing-primary);\n}\n\n.landing-header-cta,\n.landing-button {\n  display: inline-flex;\n  min-height: 46px;\n  align-items: center;\n  justify-content: center;\n  border: 1px solid transparent;\n  border-radius: 14px;\n  font-weight: 850;\n  text-decoration: none;\n  transition: transform .2s ease, box-shadow .2s ease, background-color .2s ease;\n}\n\n.landing-header-cta {\n  padding: .68rem 1rem;\n  background: var(--landing-text);\n  color: var(--landing-bg);\n  font-size: .8rem;\n}\n\n.landing-button {\n  padding: .78rem 1.2rem;\n}\n\n.landing-button.primary {\n  background: linear-gradient(135deg, var(--landing-primary), color-mix(in srgb, var(--landing-primary) 78%, #6f65e8));\n  box-shadow: 0 12px 28px color-mix(in srgb, var(--landing-primary) 24%, transparent);\n  color: #fff;\n}\n\n.landing-button.secondary {\n  border-color: var(--landing-line);\n  background: var(--landing-surface);\n  color: var(--landing-text);\n}\n\n.landing-button:hover,\n.landing-button:focus-visible,\n.landing-header-cta:hover,\n.landing-header-cta:focus-visible {\n  transform: translateY(-2px);\n}\n\n.landing-hero {\n  display: grid;\n  grid-template-columns: minmax(0, 1.04fr) minmax(420px, .96fr);\n  gap: clamp(2rem, 5vw, 5rem);\n  width: min(calc(100% - 2rem), var(--landing-max));\n  min-height: calc(100svh - 74px);\n  align-items: center;\n  margin: 0 auto;\n  padding: clamp(3rem, 7vw, 6.5rem) 0;\n}\n\n.landing-eyebrow {\n  display: flex;\n  flex-wrap: wrap;\n  gap: .45rem;\n  margin-bottom: 1.3rem;\n}\n\n.landing-eyebrow span,\n.landing-kicker,\n.landing-section-heading > span,\n.landing-final-cta > span {\n  color: var(--landing-primary);\n  font-size: .72rem;\n  font-weight: 900;\n  letter-spacing: .1em;\n  text-transform: uppercase;\n}\n\n.landing-eyebrow span {\n  padding: .38rem .6rem;\n  border: 1px solid color-mix(in srgb, var(--landing-primary) 24%, transparent);\n  border-radius: 999px;\n  background: var(--landing-primary-soft);\n  letter-spacing: .035em;\n  text-transform: none;\n}\n\n.landing-hero h1 {\n  max-width: 780px;\n  margin: 0;\n  font-size: clamp(2.55rem, 6vw, 5.45rem);\n  line-height: 1.04;\n  letter-spacing: -.055em;\n}\n\n.landing-hero-lead {\n  max-width: 650px;\n  margin: 1.4rem 0 0;\n  color: var(--landing-muted);\n  font-size: clamp(1rem, 1.6vw, 1.12rem);\n}\n\n.landing-hero-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: .65rem;\n  margin-top: 1.8rem;\n}\n\n.landing-trust-row {\n  display: flex;\n  flex-wrap: wrap;\n  gap: .55rem 1rem;\n  margin-top: 1.4rem;\n  color: var(--landing-muted);\n  font-size: .78rem;\n  font-weight: 700;\n}\n\n.landing-trust-row span {\n  display: inline-flex;\n  align-items: center;\n  gap: .38rem;\n}\n\n.landing-trust-row i {\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  background: var(--landing-accent);\n  box-shadow: 0 0 0 4px color-mix(in srgb, var(--landing-accent) 12%, transparent);\n}\n\n.landing-hero-preview {\n  position: relative;\n}\n\n.preview-window {\n  position: relative;\n  z-index: 2;\n  overflow: hidden;\n  padding: 1rem;\n  border: 1px solid var(--landing-line);\n  border-radius: var(--landing-radius-xl);\n  background:\n    linear-gradient(150deg, color-mix(in srgb, var(--landing-surface-strong) 94%, transparent), color-mix(in srgb, var(--landing-primary-soft) 32%, var(--landing-surface-strong)));\n  box-shadow: var(--landing-shadow);\n  transform: rotate(1.25deg);\n}\n\n.preview-window::before {\n  position: absolute;\n  inset: 0 auto auto 0;\n  width: 58%;\n  height: 50%;\n  background: radial-gradient(circle at top left, color-mix(in srgb, var(--landing-primary) 12%, transparent), transparent 70%);\n  content: \"\";\n  pointer-events: none;\n}\n\n.preview-topbar {\n  position: relative;\n  display: flex;\n  align-items: center;\n  gap: .7rem;\n  padding: .45rem .35rem .9rem;\n}\n\n.preview-brand-dot {\n  display: grid;\n  width: 38px;\n  height: 38px;\n  place-items: center;\n  border-radius: 12px;\n  background: var(--landing-primary);\n  color: #fff;\n  font-weight: 900;\n}\n\n.preview-topbar div {\n  display: grid;\n}\n\n.preview-topbar strong {\n  font-size: .88rem;\n}\n\n.preview-topbar small {\n  color: var(--landing-muted);\n  font-size: .67rem;\n}\n\n.preview-focus-card {\n  position: relative;\n  display: grid;\n  gap: .42rem;\n  padding: 1.05rem;\n  border: 1px solid color-mix(in srgb, var(--landing-primary) 18%, var(--landing-line));\n  border-radius: 18px;\n  background: color-mix(in srgb, var(--landing-primary-soft) 62%, var(--landing-surface-strong));\n}\n\n.preview-focus-card > span,\n.preview-grid article > span {\n  color: var(--landing-muted);\n  font-size: .68rem;\n  font-weight: 850;\n}\n\n.preview-focus-card > strong {\n  font-size: 1.05rem;\n}\n\n.preview-progress {\n  height: 8px;\n  margin-top: .2rem;\n  overflow: hidden;\n  border-radius: 999px;\n  background: color-mix(in srgb, var(--landing-line) 80%, transparent);\n}\n\n.preview-progress i {\n  display: block;\n  width: 68%;\n  height: 100%;\n  border-radius: inherit;\n  background: linear-gradient(90deg, var(--landing-primary), var(--landing-accent));\n}\n\n.preview-grid {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: .65rem;\n  margin-top: .65rem;\n}\n\n.preview-grid article {\n  display: grid;\n  gap: .24rem;\n  min-height: 124px;\n  align-content: end;\n  padding: .9rem;\n  border: 1px solid var(--landing-line);\n  border-radius: 16px;\n  background: var(--landing-surface);\n}\n\n.preview-grid article strong {\n  font-size: .83rem;\n}\n\n.preview-grid article small {\n  color: var(--landing-muted);\n  font-size: .65rem;\n}\n\n.preview-grid article.wide {\n  grid-column: 1 / -1;\n  min-height: 92px;\n}\n\n.preview-orbit {\n  position: absolute;\n  z-index: 1;\n  border-radius: 50%;\n  filter: blur(1px);\n}\n\n.orbit-one {\n  top: -3rem;\n  right: -2rem;\n  width: 170px;\n  height: 170px;\n  border: 1px solid color-mix(in srgb, var(--landing-primary) 24%, transparent);\n}\n\n.orbit-two {\n  bottom: -2.5rem;\n  left: -2rem;\n  width: 120px;\n  height: 120px;\n  background: color-mix(in srgb, var(--landing-accent) 11%, transparent);\n}\n\n.landing-strip {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  width: min(calc(100% - 2rem), var(--landing-max));\n  margin: 0 auto;\n  overflow: hidden;\n  border: 1px solid var(--landing-line);\n  border-radius: var(--landing-radius-lg);\n  background: var(--landing-surface);\n  box-shadow: var(--landing-shadow-soft);\n}\n\n.landing-strip > div {\n  display: grid;\n  gap: .18rem;\n  padding: 1rem 1.15rem;\n  border-right: 1px solid var(--landing-line);\n}\n\n.landing-strip > div:last-child {\n  border-right: 0;\n}\n\n.landing-strip strong {\n  font-size: .82rem;\n}\n\n.landing-strip span {\n  color: var(--landing-muted);\n  font-size: .7rem;\n}\n\n.landing-section {\n  width: min(calc(100% - 2rem), var(--landing-max));\n  margin: 0 auto;\n  padding: clamp(5rem, 9vw, 8rem) 0 0;\n}\n\n.landing-section-heading {\n  max-width: 760px;\n}\n\n.landing-section-heading h2,\n.landing-data-card h2,\n.landing-final-cta h2 {\n  margin: .55rem 0 0;\n  font-size: clamp(2rem, 4vw, 3.6rem);\n  line-height: 1.12;\n  letter-spacing: -.04em;\n}\n\n.landing-section-heading p,\n.landing-data-card p,\n.landing-final-cta p {\n  margin: 1rem 0 0;\n  color: var(--landing-muted);\n}\n\n.landing-feature-grid {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: .8rem;\n  margin-top: 2rem;\n}\n\n.landing-feature-card {\n  position: relative;\n  display: grid;\n  min-height: 250px;\n  align-content: end;\n  overflow: hidden;\n  padding: 1.25rem;\n  border: 1px solid var(--landing-line);\n  border-radius: var(--landing-radius-lg);\n  background: var(--landing-surface);\n  box-shadow: var(--landing-shadow-soft);\n}\n\n.landing-feature-card::before {\n  position: absolute;\n  top: -50px;\n  right: -35px;\n  width: 150px;\n  height: 150px;\n  border-radius: 50%;\n  background: radial-gradient(circle, color-mix(in srgb, var(--landing-primary) 11%, transparent), transparent 68%);\n  content: \"\";\n}\n\n.feature-index {\n  position: absolute;\n  top: 1rem;\n  left: 1rem;\n  color: var(--landing-primary);\n  font-size: .72rem;\n  font-weight: 900;\n}\n\n.landing-feature-card h3 {\n  margin: 0;\n  font-size: 1.08rem;\n}\n\n.landing-feature-card p {\n  margin: .6rem 0 0;\n  color: var(--landing-muted);\n  font-size: .82rem;\n}\n\n.landing-how {\n  display: grid;\n  grid-template-columns: minmax(260px, .72fr) minmax(0, 1.28fr);\n  gap: clamp(2rem, 6vw, 6rem);\n  align-items: start;\n}\n\n.landing-steps {\n  display: grid;\n  gap: .7rem;\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n\n.landing-steps li {\n  display: grid;\n  grid-template-columns: 46px 1fr;\n  gap: .9rem;\n  align-items: start;\n  padding: 1rem;\n  border: 1px solid var(--landing-line);\n  border-radius: var(--landing-radius-md);\n  background: var(--landing-surface);\n}\n\n.landing-steps li > span {\n  display: grid;\n  width: 42px;\n  height: 42px;\n  place-items: center;\n  border-radius: 13px;\n  background: var(--landing-primary-soft);\n  color: var(--landing-primary);\n  font-size: .78rem;\n  font-weight: 900;\n}\n\n.landing-steps strong {\n  display: block;\n  margin-top: .05rem;\n}\n\n.landing-steps p {\n  margin: .2rem 0 0;\n  color: var(--landing-muted);\n  font-size: .78rem;\n}\n\n.landing-center-action {\n  grid-column: 2;\n}\n\n.landing-updates {\n  display: grid;\n  grid-template-columns: minmax(260px, .7fr) minmax(0, 1.3fr);\n  gap: clamp(2rem, 6vw, 6rem);\n}\n\n.update-timeline {\n  position: relative;\n  display: grid;\n  gap: .7rem;\n}\n\n.update-timeline::before {\n  position: absolute;\n  top: 1rem;\n  bottom: 1rem;\n  left: 8px;\n  width: 1px;\n  background: var(--landing-line);\n  content: \"\";\n}\n\n.update-item {\n  position: relative;\n  display: grid;\n  grid-template-columns: 18px 1fr;\n  gap: 1rem;\n}\n\n.update-marker {\n  z-index: 1;\n  width: 17px;\n  height: 17px;\n  margin-top: 1.15rem;\n  border: 4px solid var(--landing-bg);\n  border-radius: 50%;\n  background: var(--landing-muted);\n  box-shadow: 0 0 0 1px var(--landing-line);\n}\n\n.update-item.current .update-marker {\n  background: var(--landing-primary);\n  box-shadow: 0 0 0 4px var(--landing-primary-soft);\n}\n\n.update-item > div:last-child {\n  padding: 1rem 1.1rem;\n  border: 1px solid var(--landing-line);\n  border-radius: var(--landing-radius-md);\n  background: var(--landing-surface);\n}\n\n.update-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: .4rem .7rem;\n  align-items: center;\n  color: var(--landing-muted);\n  font-size: .7rem;\n}\n\n.update-meta strong {\n  color: var(--landing-primary);\n}\n\n.update-meta span:last-child {\n  padding: .18rem .4rem;\n  border-radius: 999px;\n  background: var(--landing-primary-soft);\n  color: var(--landing-primary);\n  font-weight: 800;\n}\n\n.update-item h3 {\n  margin: .55rem 0 0;\n  font-size: 1rem;\n}\n\n.update-item p {\n  margin: .4rem 0 0;\n  color: var(--landing-muted);\n  font-size: .78rem;\n}\n\n.landing-data-card {\n  display: grid;\n  grid-template-columns: 1.15fr .85fr;\n  gap: clamp(2rem, 6vw, 5rem);\n  padding: clamp(1.5rem, 4vw, 3rem);\n  border: 1px solid color-mix(in srgb, var(--landing-primary) 20%, var(--landing-line));\n  border-radius: var(--landing-radius-xl);\n  background:\n    linear-gradient(145deg, color-mix(in srgb, var(--landing-primary-soft) 58%, var(--landing-surface-strong)), var(--landing-surface));\n  box-shadow: var(--landing-shadow-soft);\n}\n\n.data-points {\n  display: grid;\n  gap: .65rem;\n  align-content: center;\n}\n\n.data-points > div {\n  display: grid;\n  gap: .12rem;\n  padding: .85rem .9rem;\n  border: 1px solid var(--landing-line);\n  border-radius: 14px;\n  background: color-mix(in srgb, var(--landing-surface-strong) 84%, transparent);\n}\n\n.data-points strong {\n  font-size: .8rem;\n}\n\n.data-points span {\n  color: var(--landing-muted);\n  font-size: .72rem;\n}\n\n.landing-final-cta {\n  width: min(calc(100% - 2rem), 920px);\n  margin: clamp(5rem, 10vw, 9rem) auto 0;\n  padding: clamp(2rem, 6vw, 4rem);\n  border: 1px solid var(--landing-line);\n  border-radius: var(--landing-radius-xl);\n  background:\n    radial-gradient(circle at 90% 10%, color-mix(in srgb, var(--landing-accent) 13%, transparent), transparent 19rem),\n    radial-gradient(circle at 5% 90%, color-mix(in srgb, var(--landing-primary) 13%, transparent), transparent 20rem),\n    var(--landing-surface);\n  box-shadow: var(--landing-shadow);\n  text-align: center;\n}\n\n.landing-final-cta p {\n  margin-bottom: 1.4rem;\n}\n\n.landing-footer {\n  display: grid;\n  grid-template-columns: 1fr auto auto;\n  gap: 1rem;\n  align-items: center;\n  width: min(calc(100% - 2rem), var(--landing-max));\n  margin: 5rem auto 0;\n  padding: 1.5rem 0 2.5rem;\n  border-top: 1px solid var(--landing-line);\n  color: var(--landing-muted);\n  font-size: .72rem;\n}\n\n.landing-brand.compact .landing-brand-mark {\n  width: 34px;\n  height: 34px;\n  border-radius: 10px;\n  font-size: .9rem;\n}\n\n.landing-footer p {\n  margin: 0;\n}\n\n.landing-footer > a {\n  min-height: 44px;\n  display: inline-flex;\n  align-items: center;\n  color: var(--landing-primary);\n  font-weight: 850;\n  text-decoration: none;\n}\n\n.reveal {\n  opacity: 0;\n  transform: translateY(18px);\n  transition: opacity .5s ease, transform .5s ease;\n}\n\n.reveal.is-visible {\n  opacity: 1;\n  transform: translateY(0);\n}\n\n@media (max-width: 900px) {\n  .landing-nav {\n    display: none;\n  }\n\n  .landing-header {\n    grid-template-columns: 1fr auto;\n  }\n\n  .landing-hero {\n    grid-template-columns: 1fr;\n    min-height: 0;\n    padding-top: 4rem;\n  }\n\n  .landing-hero-preview {\n    max-width: 620px;\n    margin: 0 auto;\n  }\n\n  .landing-strip,\n  .landing-feature-grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n\n  .landing-strip > div:nth-child(2) {\n    border-right: 0;\n  }\n\n  .landing-strip > div:nth-child(-n+2) {\n    border-bottom: 1px solid var(--landing-line);\n  }\n\n  .landing-how,\n  .landing-updates,\n  .landing-data-card {\n    grid-template-columns: 1fr;\n  }\n\n  .landing-center-action {\n    grid-column: 1;\n  }\n}\n\n@media (max-width: 620px) {\n  .landing-header {\n    width: min(calc(100% - 1.2rem), var(--landing-max));\n  }\n\n  .landing-header-cta {\n    padding-inline: .8rem;\n  }\n\n  .landing-brand small {\n    display: none;\n  }\n\n  .landing-hero,\n  .landing-section,\n  .landing-strip,\n  .landing-footer {\n    width: min(calc(100% - 1.2rem), var(--landing-max));\n  }\n\n  .landing-hero {\n    padding-top: 2.8rem;\n  }\n\n  .landing-hero h1 {\n    font-size: clamp(2.3rem, 13vw, 3.6rem);\n  }\n\n  .landing-hero-actions {\n    display: grid;\n    grid-template-columns: 1fr;\n  }\n\n  .landing-button {\n    width: 100%;\n  }\n\n  .landing-trust-row {\n    display: grid;\n  }\n\n  .preview-window {\n    padding: .75rem;\n    border-radius: 24px;\n    transform: none;\n  }\n\n  .preview-grid {\n    grid-template-columns: 1fr;\n  }\n\n  .preview-grid article.wide {\n    grid-column: auto;\n  }\n\n  .landing-strip,\n  .landing-feature-grid {\n    grid-template-columns: 1fr;\n  }\n\n  .landing-strip > div {\n    border-right: 0;\n    border-bottom: 1px solid var(--landing-line);\n  }\n\n  .landing-strip > div:last-child {\n    border-bottom: 0;\n  }\n\n  .landing-feature-card {\n    min-height: 210px;\n  }\n\n  .landing-data-card {\n    padding: 1.2rem;\n    border-radius: 22px;\n  }\n\n  .landing-footer {\n    grid-template-columns: 1fr;\n    justify-items: start;\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  html {\n    scroll-behavior: auto;\n  }\n\n  *,\n  *::before,\n  *::after {\n    animation-duration: .01ms !important;\n    animation-iteration-count: 1 !important;\n    transition-duration: .01ms !important;\n  }\n\n  .reveal {\n    opacity: 1;\n    transform: none;\n  }\n}\n\nhtml[data-reduce-motion=\"true\"] .reveal {\n  opacity: 1;\n  transform: none;\n}\n";
const LANDING_JS = "const revealNodes = [...document.querySelectorAll('.reveal')];\n\nif (\n  document.documentElement.dataset.reduceMotion === 'true' ||\n  matchMedia('(prefers-reduced-motion: reduce)').matches\n) {\n  revealNodes.forEach(node => node.classList.add('is-visible'));\n} else if ('IntersectionObserver' in window) {\n  const observer = new IntersectionObserver(entries => {\n    for (const entry of entries) {\n      if (!entry.isIntersecting) continue;\n      entry.target.classList.add('is-visible');\n      observer.unobserve(entry.target);\n    }\n  }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });\n\n  revealNodes.forEach(node => observer.observe(node));\n} else {\n  revealNodes.forEach(node => node.classList.add('is-visible'));\n}\n\nif ('serviceWorker' in navigator) {\n  window.addEventListener('load', () => {\n    navigator.serviceWorker.register('./service-worker.js').catch(error => {\n      console.warn('Service Worker registration failed on landing page.', error);\n    });\n  }, { once: true });\n}\n";
const RELEASE_CUTOVER_TEST = "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst landing = fs.readFileSync('index.html', 'utf8');\nconst app = fs.readFileSync('app.html', 'utf8');\nconst v3 = fs.readFileSync('v3.html', 'utf8');\nconst legacy = fs.readFileSync('legacy-v2.html', 'utf8');\nconst manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));\nconst sw = fs.readFileSync('service-worker.js', 'utf8');\n\nassert.equal(app, v3, 'app.html and v3.html must remain byte-identical compatibility entries.');\nassert.match(landing, /data-landing-page|class=\"landing-body\"/);\nassert.match(landing, /href=\"\\.\\/app\\.html\"/);\nassert.doesNotMatch(landing, /src\\/app\\/main\\.js/);\nassert.match(app, /data-nav-library/);\nassert.match(app, /src\\/app\\/main\\.js/);\n\nassert.ok(legacy.length > 0);\nassert.match(legacy, /\\.\\/legacy-v2\\//);\n\nassert.equal(manifest.start_url, './app.html');\nassert.equal(manifest.scope, './');\n\nassert.match(sw, /moxin-quiz-v3-[^'\"\\s]+/);\nassert.match(sw, /'\\.\\/index\\.html'/);\nassert.match(sw, /'\\.\\/app\\.html'/);\nassert.match(sw, /'\\.\\/v3\\.html'/);\nassert.match(sw, /cache\\.match\\('\\.\\/index\\.html'\\)/);\nassert.match(sw, /cache\\.match\\('\\.\\/app\\.html'\\)/);\n\nassert.doesNotMatch(app, /(?:src|href)=\"(?:script\\.js|style\\.css)\"/);\nassert.equal(fs.existsSync('legacy-v2/index.html'), true);\nassert.equal(fs.existsSync('legacy-v2/style.css'), true);\nassert.equal(fs.existsSync('legacy-v2/script.js'), true);\nassert.equal(fs.existsSync('script.js'), false);\nassert.equal(fs.existsSync('style.css'), false);\n\nconsole.log('MoXin Quiz v4.1 landing/app entry regression tests passed.');\n";
const V40_PRODUCTION_TEST = "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { APP_CONFIG } from '../src/app/config.js';\n\nconst app = fs.readFileSync('app.html', 'utf8');\nconst v3 = fs.readFileSync('v3.html', 'utf8');\nconst manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));\nconst readme = fs.readFileSync('README.md', 'utf8');\nconst pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));\nconst sw = fs.readFileSync('service-worker.js', 'utf8');\nconst plan = fs.readFileSync('docs/V4_0_PLAN.md', 'utf8');\n\nassert.equal(app, v3);\nassert.match(app, /<title>墨忻刷題網 v4\\.\\d+<\\/title>/);\nassert.match(app, /<span class=\"version-badge\">v4\\.\\d+<\\/span>/);\nassert.doesNotMatch(app, /v4 preview|v3\\.3|RC1/i);\n\nassert.match(APP_CONFIG.appVersion, /^4\\.\\d+\\.\\d+$/);\nassert.equal(APP_CONFIG.releaseChannel, 'production');\nassert.equal(APP_CONFIG.dbName, 'moxin-quiz-v3');\nassert.equal(APP_CONFIG.dbVersion, 3);\n\nassert.equal(manifest.scope, './');\nassert.match(readme, /\\*\\*v4\\.\\d+\\*\\*/);\nassert.equal(pkg.scripts.preflight, 'node scripts/v4-release-preflight.mjs');\nassert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-[^']+'/);\nassert.match(plan, /## v4\\.0 Production/);\nassert.match(plan, /\\*\\*狀態：Released\\*\\*/);\n\nconsole.log('MoXin Quiz v4 production compatibility contract passed.');\n";
const V41_TEST = "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { APP_CONFIG } from '../src/app/config.js';\n\nconst landing = fs.readFileSync('index.html', 'utf8');\nconst app = fs.readFileSync('app.html', 'utf8');\nconst v3 = fs.readFileSync('v3.html', 'utf8');\nconst manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));\nconst sw = fs.readFileSync('service-worker.js', 'utf8');\nconst readme = fs.readFileSync('README.md', 'utf8');\n\nassert.match(landing, /<title>墨忻刷題網｜首頁<\\/title>/);\nassert.match(landing, /class=\"landing-body\"/);\nassert.match(landing, /href=\"\\.\\/app\\.html\">開始使用<\\/a>/);\nassert.match(landing, /id=\"features\"/);\nassert.match(landing, /id=\"howToStart\"/);\nassert.match(landing, /id=\"updates\"/);\nassert.match(landing, /id=\"data\"/);\nassert.match(landing, /2026-10-04/);\nassert.doesNotMatch(landing, /src\\/app\\/main\\.js/);\n\nassert.equal(app, v3);\nassert.match(app, /<title>墨忻刷題網 v4\\.1<\\/title>/);\nassert.match(app, /<span class=\"version-badge\">v4\\.1<\\/span>/);\nassert.match(app, /data-nav-library/);\n\nassert.equal(APP_CONFIG.appVersion, '4.1.0');\nassert.equal(APP_CONFIG.releaseChannel, 'production');\nassert.equal(APP_CONFIG.dbName, 'moxin-quiz-v3');\nassert.equal(APP_CONFIG.dbVersion, 3);\n\nassert.equal(manifest.start_url, './app.html');\nassert.equal(manifest.scope, './');\nassert.match(manifest.description, /v4\\.1/);\n\nfor (const asset of [\n  './index.html',\n  './app.html',\n  './v3.html',\n  './styles/v41-landing.css',\n  './src/app/landing.js',\n]) {\n  assert.ok(sw.includes(`'${asset}'`), `APP_SHELL missing ${asset}`);\n}\n\nassert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\\.1\\.0-v41-landing-1'/);\nassert.match(sw, /cache\\.match\\('\\.\\/app\\.html'\\)/);\nassert.match(sw, /cache\\.match\\('\\.\\/index\\.html'\\)/);\n\nassert.match(readme, /\\*\\*v4\\.1\\*\\*/);\nassert.match(readme, /公開首頁/);\nassert.match(readme, /app\\.html/);\n\nconsole.log('MoXin Quiz v4.1 landing page tests passed.');\n";
const LANDING_BROWSER_TEST = "import fs from 'node:fs';\nimport path from 'node:path';\nimport assert from 'node:assert/strict';\nimport { chromium } from 'playwright';\nimport AxeBuilder from '@axe-core/playwright';\n\nconst BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/';\nconst OUT_DIR = path.resolve('artifacts/v41-landing-browser');\nconst SCREEN_DIR = path.join(OUT_DIR, 'screenshots');\n\nfs.mkdirSync(SCREEN_DIR, { recursive: true });\n\nconst viewports = [\n  { name: 'small-mobile', width: 320, height: 568 },\n  { name: 'mobile', width: 390, height: 844 },\n  { name: 'tablet', width: 768, height: 1024 },\n  { name: 'laptop', width: 1366, height: 768 },\n  { name: 'desktop', width: 1920, height: 1080 },\n];\n\nconst failures = [];\nconst screenshots = [];\n\nfunction fail(scope, message) {\n  failures.push({ scope, message });\n}\n\nasync function auditViewport(browser, viewport, theme) {\n  const scope = `${viewport.name}-${theme}`;\n  const context = await browser.newContext({ viewport, colorScheme: theme });\n  const page = await context.newPage();\n\n  page.on('pageerror', error => fail(scope, `pageerror: ${error.message}`));\n  page.on('console', message => {\n    if (\n      message.type() === 'error' &&\n      !/Service Worker registration (failed|blocked by Playwright)/i.test(message.text())\n    ) {\n      fail(scope, `console: ${message.text()}`);\n    }\n  });\n\n  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });\n\n  const title = await page.title();\n  if (title !== '墨忻刷題網｜首頁') fail(scope, `unexpected title: ${title}`);\n\n  const primary = page.locator('.landing-hero-actions .landing-button.primary');\n  await primary.waitFor({ state: 'visible' });\n\n  const box = await primary.boundingBox();\n  if (!box || box.height < 44 || box.width < 44) {\n    fail(scope, `primary CTA below 44px touch target`);\n  }\n\n  const href = await primary.getAttribute('href');\n  if (href !== './app.html') fail(scope, `primary CTA href is ${href}`);\n\n  const overflow = await page.evaluate(() =>\n    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -\n    document.documentElement.clientWidth\n  );\n  if (overflow > 1) fail(scope, `horizontal overflow: ${overflow}px`);\n\n  const axe = await new AxeBuilder({ page }).analyze();\n  for (const violation of axe.violations) {\n    if (['critical', 'serious'].includes(violation.impact)) {\n      fail(scope, `a11y ${violation.id}: ${violation.help}`);\n    }\n  }\n\n  const file = path.join(SCREEN_DIR, `${scope}.png`);\n  await page.screenshot({ path: file, fullPage: true });\n  screenshots.push(file);\n\n  if (viewport.name === 'mobile' && theme === 'light') {\n    await primary.click();\n    await page.waitForURL(/app\\.html/, { timeout: 10000 });\n    await page.waitForSelector('#storageStatus', { timeout: 15000 });\n    await page.waitForFunction(() => {\n      const text = document.querySelector('#storageStatus')?.textContent || '';\n      return text.includes('IndexedDB 已就緒');\n    }, null, { timeout: 15000 });\n\n    assert.equal(await page.locator('[data-nav-library]').count() > 0, true);\n  }\n\n  await context.close();\n}\n\nconst browser = await chromium.launch({ headless: true });\n\ntry {\n  for (const viewport of viewports) {\n    for (const theme of ['light', 'dark']) {\n      await auditViewport(browser, viewport, theme);\n    }\n  }\n} finally {\n  await browser.close();\n}\n\nconst summary = {\n  generatedAt: new Date().toISOString(),\n  viewportCount: viewports.length,\n  themeCount: 2,\n  screenshotCount: screenshots.length,\n  failures,\n};\n\nfs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');\n\nif (failures.length) {\n  console.error(JSON.stringify(summary, null, 2));\n  process.exit(1);\n}\n\nconsole.log(`v4.1 landing browser audit passed: ${screenshots.length} screenshots, 0 failures.`);\n";
const V41_PLAN = "# 墨忻刷題網 v4.1 — Public Landing & App Entry\n\n## 版本定位\n\nv4.1 不擴張 Learning Studio 核心功能，而是補上正式的「網站入口層」。\n\n```text\nindex.html  → 公開首頁\napp.html    → 學習大廳\nv3.html     → 舊網址相容入口（與 app.html 相同）\n```\n\nPWA `start_url` 使用 `./app.html`，讓已安裝 App 的使用者直接進入學習大廳。\n\n## 目標\n\n- 第一次造訪者可以先理解網站用途，再決定是否進入。\n- 公開首頁不初始化 IndexedDB，不載入完整 Learning Studio runtime。\n- 核心學習大廳保持 Local-first / Offline。\n- 舊 `v3.html` 連結不失效。\n- 手機、平板、桌面與 Light / Dark 都可正常使用。\n\n## 公開首頁內容\n\n1. Hero + 開始使用\n2. 核心功能\n3. 如何開始\n4. 更新日誌\n5. 資料與隱私說明\n6. 最終 CTA\n\n## 版本邊界\n\nv4.1 不實作：\n\n- Google 登入\n- 跨裝置雲端同步\n- 多人房間\n- Realtime backend\n\n上述大型方向分別保留給後續主版本。\n\n## Release Gates\n\n- `npm run ci`\n- Landing structural regression\n- 5 viewport × Light/Dark Chromium audit\n- axe serious/critical accessibility gate\n- horizontal overflow gate\n- Landing → App 真實點擊\n- IndexedDB 大廳初始化成功\n- `app.html === v3.html`\n- Offline App Shell 包含 Landing + App\n";
const PREFLIGHT = "import fs from 'node:fs';\nimport path from 'node:path';\nimport { spawnSync } from 'node:child_process';\n\nconst root = process.cwd();\nconst errors = [];\nconst warnings = [];\n\nconst read = file => fs.readFileSync(path.join(root, file), 'utf8');\nconst exists = file => fs.existsSync(path.join(root, file));\n\nconst fail = message => errors.push(message);\nconst warn = message => warnings.push(message);\n\nfunction normalizeLocalPath(value) {\n  if (!value || /^(?:https?:|data:|blob:|#)/i.test(value)) return null;\n  const clean = value.split(/[?#]/, 1)[0].replace(/^\\.\\//, '');\n  return clean || null;\n}\n\nfunction checkFile(file, label = 'resource') {\n  if (!exists(file)) fail(`Missing ${label}: ${file}`);\n}\n\nfunction parsePngSize(file) {\n  const buffer = fs.readFileSync(path.join(root, file));\n  if (buffer.length < 24 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {\n    throw new Error(`${file} is not a valid PNG.`);\n  }\n  return {\n    width: buffer.readUInt32BE(16),\n    height: buffer.readUInt32BE(20),\n  };\n}\n\nfor (const file of [\n  'index.html',\n  'app.html',\n  'v3.html',\n  'legacy-v2.html',\n  'legacy-v2/index.html',\n  'manifest.webmanifest',\n  'service-worker.js',\n  'package.json',\n  'styles/v41-landing.css',\n  'src/app/landing.js',\n]) {\n  checkFile(file, 'release file');\n}\n\nconst landing = exists('index.html') ? read('index.html') : '';\nconst app = exists('app.html') ? read('app.html') : '';\nconst compatibility = exists('v3.html') ? read('v3.html') : '';\nconst legacy = exists('legacy-v2.html') ? read('legacy-v2.html') : '';\n\nif (app && compatibility && app !== compatibility) {\n  fail('app.html and v3.html must remain byte-identical.');\n}\n\ncheckHtml('index.html', landing);\ncheckHtml('app.html', app);\ncheckHtml('v3.html', compatibility);\n\nif (!landing.includes('class=\"landing-body\"')) fail('index.html must be the public landing page.');\nif (!landing.includes('href=\"./app.html\"')) fail('Landing page must link to ./app.html.');\nif (landing.includes('src/app/main.js')) fail('Landing page must not bootstrap the Learning Studio runtime.');\n\nfor (const nav of [\n  'data-nav-library',\n  'data-nav-review',\n  'data-nav-exam',\n  'data-nav-stats',\n  'data-nav-tools',\n  'data-nav-settings',\n]) {\n  if (!app.includes(nav)) fail(`Missing app navigation entry: ${nav}`);\n}\n\nif (!app.includes('src/app/main.js')) fail('app.html must load src/app/main.js.');\n\nif (legacy && !legacy.includes('./legacy-v2/')) {\n  fail('legacy-v2.html must redirect to ./legacy-v2/.');\n}\n\nfor (const file of [\n  'legacy-v2/index.html',\n  'legacy-v2/script.js',\n  'legacy-v2/style.css',\n  'legacy-v2/question-banks.json',\n]) {\n  checkFile(file, 'legacy archive file');\n}\n\nfor (const legacyRootFile of ['script.js', 'style.css', 'question-banks.json']) {\n  if (exists(legacyRootFile)) fail(`Legacy root file should be archived: ${legacyRootFile}`);\n}\n\nlet manifest = null;\ntry {\n  manifest = JSON.parse(read('manifest.webmanifest'));\n} catch (error) {\n  fail(`Invalid manifest.webmanifest JSON: ${error.message}`);\n}\n\nif (manifest) {\n  if (manifest.start_url !== './app.html') {\n    fail(`manifest start_url must be ./app.html, got ${manifest.start_url}`);\n  }\n  if (manifest.scope !== './') fail(`manifest scope must be ./, got ${manifest.scope}`);\n\n  const iconRequirements = new Map([\n    ['192x192', [192, 192]],\n    ['512x512', [512, 512]],\n  ]);\n\n  for (const icon of manifest.icons || []) {\n    const iconPath = normalizeLocalPath(icon.src);\n    if (!iconPath) {\n      fail(`Manifest icon must be local: ${icon.src}`);\n      continue;\n    }\n    checkFile(iconPath, 'manifest icon');\n    if (exists(iconPath) && icon.type === 'image/png') {\n      try {\n        const actual = parsePngSize(iconPath);\n        for (const size of String(icon.sizes || '').split(/\\s+/)) {\n          const expected = iconRequirements.get(size);\n          if (expected && (actual.width !== expected[0] || actual.height !== expected[1])) {\n            fail(`${iconPath} declares ${size} but is ${actual.width}x${actual.height}.`);\n          }\n        }\n      } catch (error) {\n        fail(error.message);\n      }\n    }\n  }\n}\n\nconst sw = read('service-worker.js');\nconst shellBlock = sw.match(/const\\s+APP_SHELL\\s*=\\s*\\[([\\s\\S]*?)\\];/);\n\nif (!shellBlock) {\n  fail('service-worker.js does not expose an APP_SHELL array.');\n} else {\n  const refs = [...shellBlock[1].matchAll(/['\"]\\.\\/([^'\"]+)['\"]/g)].map(match => match[1]);\n  for (const required of [\n    'index.html',\n    'app.html',\n    'v3.html',\n    'styles/v41-landing.css',\n    'src/app/landing.js',\n  ]) {\n    if (!refs.includes(required)) fail(`Service Worker App Shell missing ${required}.`);\n  }\n  for (const ref of refs) checkFile(ref, 'Service Worker App Shell resource');\n}\n\nif (!/cache\\.match\\('\\.\\/index\\.html'\\)/.test(sw)) {\n  fail('Service Worker navigation fallback must include ./index.html.');\n}\nif (!/cache\\.match\\('\\.\\/app\\.html'\\)/.test(sw)) {\n  fail('Service Worker navigation fallback must include ./app.html.');\n}\n\nconst codeFiles = [\n  ...walk(path.join(root, 'src')).filter(file => file.endsWith('.js')),\n  ...walk(path.join(root, 'tests')).filter(file => file.endsWith('.mjs')),\n];\n\nfor (const absolute of codeFiles) {\n  const source = fs.readFileSync(absolute, 'utf8');\n  const imports = [...source.matchAll(/(?:from\\s+|import\\s*)['\"]([^'\"]+)['\"]/g)].map(match => match[1]);\n  for (const specifier of imports) {\n    if (!specifier.startsWith('.')) continue;\n    const resolved = path.resolve(path.dirname(absolute), specifier);\n    if (!fs.existsSync(resolved)) {\n      fail(`Missing import target: ${path.relative(root, absolute)} -> ${specifier}`);\n    }\n  }\n}\n\nfor (const absolute of [...codeFiles, path.join(root, 'service-worker.js')]) {\n  const result = spawnSync(process.execPath, ['--check', absolute], { encoding: 'utf8' });\n  if (result.status !== 0) {\n    fail(`Syntax error in ${path.relative(root, absolute)}: ${result.stderr.trim()}`);\n  }\n}\n\nif (/https?:\\/\\//i.test(landing)) {\n  warn('Landing page contains an absolute HTTP(S) URL; review offline/local-first requirement.');\n}\nif (/https?:\\/\\//i.test(shellBlock?.[1] || '')) {\n  fail('Service Worker APP_SHELL must not depend on remote HTTP(S) assets.');\n}\n\nconsole.log(`V4.1 release preflight: ${errors.length ? 'FAIL' : 'PASS'}`);\nconsole.log(`Checked landing + app + v3 compatibility, ${codeFiles.length} module/test files.`);\n\nfor (const message of warnings) console.warn(`WARN: ${message}`);\nfor (const message of errors) console.error(`ERROR: ${message}`);\n\nif (errors.length) process.exit(1);\n\nfunction checkHtml(name, html) {\n  if (!html) return;\n  const ids = [...html.matchAll(/\\bid=\"([^\"]+)\"/g)].map(match => match[1]);\n  const seen = new Set();\n  for (const id of ids) {\n    if (seen.has(id)) fail(`Duplicate HTML id in ${name}: ${id}`);\n    seen.add(id);\n  }\n\n  const refs = [...html.matchAll(/\\b(?:src|href)=\"([^\"]+)\"/g)]\n    .map(match => normalizeLocalPath(match[1]))\n    .filter(Boolean);\n\n  for (const ref of refs) checkFile(ref, `${name} resource`);\n}\n\nfunction walk(directory) {\n  if (!fs.existsSync(directory)) return [];\n  const output = [];\n  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {\n    const absolute = path.join(directory, entry.name);\n    if (entry.isDirectory()) output.push(...walk(absolute));\n    else output.push(absolute);\n  }\n  return output;\n}\n";

import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  const parent = path.split('/').slice(0, -1).join('/');
  if (parent) fs.mkdirSync(parent, { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
}
function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing v4.1 anchor: ${label}`);
  return source.replace(search, replacement);
}

// Split public landing from the existing Learning Studio entry.
const oldIndex = read('index.html');
let app = oldIndex
  .replace('墨忻刷題網 v4.0 本機優先個人學習平台', '墨忻刷題網 v4.1 本機優先個人學習平台')
  .replace('<title>墨忻刷題網 v4.0</title>', '<title>墨忻刷題網 v4.1</title>')
  .replace('<span class="version-badge">v4.0</span>', '<span class="version-badge">v4.1</span>');

if (!app.includes('<title>墨忻刷題網 v4.1</title>')) {
  throw new Error('Could not promote app entry to v4.1');
}

write('app.html', app);
write('v3.html', app);
write('index.html', LANDING_HTML);
write('styles/v41-landing.css', LANDING_CSS);
write('src/app/landing.js', LANDING_JS);

// Runtime version remains production, DB namespace stays intentionally compatible.
{
  const path = 'src/app/config.js';
  let source = read(path);
  source = replaceRequired(
    source,
    "  appVersion: '4.0.0',",
    "  appVersion: '4.1.0',",
    'APP_CONFIG appVersion',
  );
  if (!source.includes("releaseChannel: 'production'")) {
    throw new Error('APP_CONFIG production channel missing');
  }
  if (!source.includes("dbName: 'moxin-quiz-v3'") || !source.includes('dbVersion: 3')) {
    throw new Error('IndexedDB compatibility contract changed unexpectedly');
  }
  write(path, source);
}

// PWA installs/open directly into the app, while root remains the public landing page.
{
  const path = 'manifest.webmanifest';
  const manifest = JSON.parse(read(path));
  manifest.description = '墨忻刷題網 v4.1：本機優先、可離線使用的個人學習與刷題平台。';
  manifest.start_url = './app.html';
  manifest.scope = './';
  write(path, JSON.stringify(manifest, null, 2) + '\n');
}

// Cache Landing + App and keep v3 compatibility. Improve offline navigation fallback.
{
  const path = 'service-worker.js';
  let source = read(path);

  source = replaceRequired(
    source,
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-21';",
    "const CACHE_VERSION = 'moxin-quiz-v3-4.1.0-v41-landing-1';",
    'Service Worker cache revision',
  );

  source = replaceRequired(
    source,
    "  './index.html',\n  './v3.html',",
    "  './index.html',\n  './app.html',\n  './v3.html',\n  './styles/v41-landing.css',\n  './src/app/landing.js',",
    'Service Worker landing/app shell',
  );

  const oldFallback =
`async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (
      await cache.match(request) ||
      await cache.match('./index.html') ||
      await cache.match('./v3.html') ||
      Response.error()
    );
  }
}`;

  const newFallback =
`async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const url = new URL(request.url);
    const appNavigation = /\\/(?:app|v3)\\.html$/.test(url.pathname);
    const routeFallback = appNavigation
      ? await cache.match('./app.html')
      : await cache.match('./index.html');

    return (
      await cache.match(request, { ignoreSearch: true }) ||
      routeFallback ||
      await cache.match('./app.html') ||
      await cache.match('./index.html') ||
      Response.error()
    );
  }
}`;

  source = replaceRequired(source, oldFallback, newFallback, 'Service Worker navigation fallback');
  write(path, source);
}

// Active historical feature tests should now inspect app.html, not the new public landing.
{
  const pkg = JSON.parse(read('package.json'));
  const activeTests = String(pkg.scripts.test || '')
    .split(/\s*&&\s*/)
    .map(command => command.match(/^node\s+(tests\/[^\s]+\.mjs)$/)?.[1])
    .filter(Boolean);

  for (const path of activeTests) {
    if (!fs.existsSync(path)) continue;
    if (path === 'tests/release-cutover-run.mjs' || path === 'tests/v40-production-release-run.mjs') continue;
    let source = read(path);
    source = source.replaceAll(
      "fs.readFileSync('index.html', 'utf8')",
      "fs.readFileSync('app.html', 'utf8')",
    );
    write(path, source);
  }
}

write('tests/release-cutover-run.mjs', RELEASE_CUTOVER_TEST);
write('tests/v40-production-release-run.mjs', V40_PRODUCTION_TEST);
write('tests/v41-landing-page-run.mjs', V41_TEST);
write('tests/v41-landing-browser-run.mjs', LANDING_BROWSER_TEST);
write('scripts/v4-release-preflight.mjs', PREFLIGHT);
write('docs/V4_1_PLAN.md', V41_PLAN);

// Browser audit for the Learning Studio must enter app.html after the entry split.
{
  const path = 'tests/v40-rc1-browser-ux-run.mjs';
  let source = read(path);
  source = replaceRequired(
    source,
    "const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/';",
    "const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';",
    'RC1 browser audit app entry',
  );
  write(path, source);
}

// Package metadata and active test chain.
{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  pkg.name = 'moxin-quiz-site-v4-1';

  const commands = String(pkg.scripts.test || '')
    .split(/\s*&&\s*/)
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => !item.includes('v41-landing-page-run.mjs'));

  const productionIndex = commands.findIndex(item => item.includes('v40-production-release-run.mjs'));
  if (productionIndex < 0) throw new Error('v4 production contract missing from npm test');

  commands.splice(productionIndex + 1, 0, 'node tests/v41-landing-page-run.mjs');
  pkg.scripts.test = commands.join(' && ');
  pkg.scripts['audit:landing'] = 'node tests/v41-landing-browser-run.mjs';

  write(path, JSON.stringify(pkg, null, 2) + '\n');
}

// README: current version + explicit Landing/App entry architecture.
{
  const path = 'README.md';
  let source = read(path);

  source = replaceRequired(
    source,
    '墨忻刷題網 **v4.0** 是一個部署於 GitHub Pages 的 **Local-first 個人學習與刷題平台**。',
    '墨忻刷題網 **v4.1** 是一個部署於 GitHub Pages 的 **Local-first 個人學習與刷題平台**。',
    'README current version',
  );

  source = replaceRequired(
    source,
    '> v4.0 已完成 Release Readiness 與 Main Cutover Rehearsal，正式版由 `main` 部署。',
    '> v4.1 新增正式公開首頁與 App 入口分層；v4.0 Learning Studio 核心功能維持不變。',
    'README release summary',
  );

  const introAnchor = '## v4.0 主要功能';
  const v41Section =
`## v4.1 公開首頁與 App 入口

v4.1 將網站拆成兩層：

\`\`\`text
index.html  → 公開首頁
app.html    → 學習大廳
v3.html     → 舊網址相容入口（與 app.html 相同）
\`\`\`

公開首頁提供功能介紹、開始使用、使用流程、更新日誌與資料說明；不初始化 IndexedDB。
PWA 的 \`start_url\` 為 \`./app.html\`，因此安裝後仍直接進入學習大廳。

`;
  if (!source.includes('## v4.1 公開首頁與 App 入口')) {
    source = replaceRequired(source, introAnchor, v41Section + introAnchor, 'README v4.1 section anchor');
  }

  const oldDeploy =
`GitHub Pages 正式設定：

\`\`\`text
Branch: main
Folder: / (root)
\`\`\`

正式版部署：

\`\`\`text
Branch: main
Folder: / (root)
Release tag: v4.0.0
\`\`\`

正式入口為 repository Pages 根網址；\`v3.html\` 保留相容入口。`;

  const newDeploy =
`GitHub Pages 正式設定：

\`\`\`text
Branch: main
Folder: / (root)
\`\`\`

入口結構：

\`\`\`text
/          → 公開首頁
/app.html  → 學習大廳
/v3.html   → 舊網址相容入口
\`\`\`

PWA 安裝後使用 \`./app.html\` 作為 start_url。`;

  source = replaceRequired(source, oldDeploy, newDeploy, 'README deployment section');
  write(path, source);
}

// Changelog.
{
  const path = 'docs/V4_0_CHANGELOG.md';
  let changelog = read(path);
  if (!changelog.includes('## v4.1 — Public Landing & App Entry')) {
    const section =
`## v4.1 — Public Landing & App Entry
- 新增正式公開首頁，提供開始使用、功能介紹、使用流程、更新日誌與資料說明。
- 原 Learning Studio 入口移至 \`app.html\`。
- \`v3.html\` 與 \`app.html\` 維持 byte-identical，保留既有網址相容性。
- PWA start_url 改為 \`./app.html\`，安裝後直接進入學習大廳。
- Landing 不初始化 IndexedDB，降低首次瀏覽成本。
- Service Worker App Shell 同時快取 Landing + App。
- 新增 5 viewport × Light/Dark 真實 Chromium Landing audit。

`;
    changelog = section + changelog;
  }
  write(path, changelog);
}

// Final structural guards.
{
  const pkg = JSON.parse(read('package.json'));
  const manifest = JSON.parse(read('manifest.webmanifest'));

  if (read('app.html') !== read('v3.html')) throw new Error('app.html !== v3.html');
  if (!read('index.html').includes('class="landing-body"')) throw new Error('Landing marker missing');
  if (!read('app.html').includes('data-nav-library')) throw new Error('App navigation missing');
  if (manifest.start_url !== './app.html') throw new Error('PWA start_url is not app.html');
  if (!pkg.scripts.test.includes('v41-landing-page-run.mjs')) throw new Error('v4.1 test missing');
  const sw = read('service-worker.js');
  if (!sw.includes("moxin-quiz-v3-4.1.0-v41-landing-1")) {
    throw new Error('v4.1 Service Worker cache missing');
  }
  if (!sw.includes("await cache.match('./app.html')")) {
    throw new Error('v4.1 Service Worker app fallback is not explicit');
  }
  if (!sw.includes("await cache.match('./index.html')")) {
    throw new Error('v4.1 Service Worker landing fallback is not explicit');
  }
}

console.log('v4.1 Public Landing & App Entry applied successfully.');
