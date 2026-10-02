import fs from 'node:fs';

const PATCHES = [{"label": "active goal state", "search": "  const history = Array.isArray(progress.history) ? progress.history : [];\n  const configured = model.configured === true;\n\n  return `", "replacement": "  const history = Array.isArray(progress.history) ? progress.history : [];\n  const configured = model.configured === true;\n  const reportedActiveTargetCount = Number(progress.activeTargetCount);\n  const activeTargetCount = Number.isFinite(reportedActiveTargetCount)\n    ? reportedActiveTargetCount\n    : Number(Number(goal.dailyPracticeTarget || 0) > 0) +\n      Number(Number(goal.dailyReviewTarget || 0) > 0);\n  const hasActiveGoal =\n    goal.enabled === true &&\n    activeTargetCount > 0;\n\n  return `"}, {"label": "today summary", "search": "        <article class=\"learning-goal-summary-card primary\">\n          <span>今日整體進度</span>\n          <strong>${clampPercent(today.completionPercent)}%</strong>\n          <small>${today.achieved ? '今日目標已完成' : goal.enabled ? '依目前目標持續累積' : '目前未啟用目標'}</small>\n          <div class=\"learning-goal-progress-track\" aria-hidden=\"true\">\n            <i style=\"width:${clampPercent(today.completionPercent)}%\"></i>\n          </div>\n        </article>", "replacement": "        <article class=\"learning-goal-summary-card primary\">\n          <span>今日整體進度</span>\n          <strong>${hasActiveGoal ? `${clampPercent(today.completionPercent)}%` : '尚未設定'}</strong>\n          <small>${\n            hasActiveGoal\n              ? today.achieved\n                ? '今日目標已完成'\n                : '依目前目標持續累積'\n              : '目前未啟用每日目標'\n          }</small>\n          <div class=\"learning-goal-progress-track\" aria-hidden=\"true\">\n            <i style=\"width:${hasActiveGoal ? clampPercent(today.completionPercent) : 0}%\"></i>\n          </div>\n        </article>"}, {"label": "recent summary", "search": "        <article class=\"learning-goal-summary-card\">\n          <span>近 7 日達成</span>\n          <strong>${Number(progress.recentAchievedDays || 0)} / ${history.length || 7}</strong>\n          <small>以目前設定的目標回看</small>\n        </article>", "replacement": "        <article class=\"learning-goal-summary-card\">\n          <span>近 7 日達成</span>\n          <strong>${hasActiveGoal ? `${Number(progress.recentAchievedDays || 0)} / ${history.length || 7}` : '—'}</strong>\n          <small>${hasActiveGoal ? '以目前設定的目標回看' : '啟用目標後開始計算達成日'}</small>\n        </article>"}, {"label": "history explanation", "search": "            <span>綠色代表依目前目標達成；有作答但未完成會顯示進度。</span>", "replacement": "            <span>${hasActiveGoal\n              ? '綠色代表依目前目標達成；有作答但未完成會顯示進度。'\n              : '尚未啟用目標時，只顯示是否有學習與當日題數。'}</span>"}, {"label": "history cell call", "search": "          ${history.map(day => historyCell(day)).join('')}", "replacement": "          ${history.map(day => historyCell(day, { hasActiveGoal })).join('')}"}, {"label": "history cell function", "search": "function historyCell(day) {\n  const percent = clampPercent(day?.completionPercent);\n  const state = day?.achieved\n    ? 'is-achieved'\n    : day?.active\n      ? 'is-active'\n      : 'is-empty';\n\n  return `\n    <div class=\"learning-goal-day ${state}\" role=\"listitem\" title=\"${escapeAttr(day.dateKey || '')}\">\n      <span>${formatShortDate(day.dateKey)}</span>\n      <strong>${day?.achieved ? '✓' : day?.active ? `${percent}%` : '—'}</strong>\n      <small>${Number(day?.answered || 0)} 題</small>\n    </div>\n  `;\n}", "replacement": "function historyCell(day, { hasActiveGoal = false } = {}) {\n  const percent = clampPercent(day?.completionPercent);\n  const state = hasActiveGoal && day?.achieved\n    ? 'is-achieved'\n    : day?.active\n      ? 'is-active'\n      : 'is-empty';\n\n  const status = hasActiveGoal\n    ? day?.achieved\n      ? '✓'\n      : day?.active\n        ? `${percent}%`\n        : '—'\n    : day?.active\n      ? '有學習'\n      : '—';\n\n  return `\n    <div class=\"learning-goal-day ${state}\" role=\"listitem\" title=\"${escapeAttr(day.dateKey || '')}\">\n      <span>${formatShortDate(day.dateKey)}</span>\n      <strong>${status}</strong>\n      <small>${Number(day?.answered || 0)} 題</small>\n    </div>\n  `;\n}"}];
const TEST_CODE = "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { GLOBAL_SCOPE, renderLearningGoalPanel } from '../src/ui/learning-goals.js';\n\nconst noGoalHtml = renderLearningGoalPanel({\n  banks: [], selectedScope: GLOBAL_SCOPE, configured: false,\n  goal: { id:'global', bankId:null, enabled:false, dailyPracticeTarget:0, dailyReviewTarget:0 },\n  progress: {\n    activeTargetCount:0, streak:2, recentAchievedDays:0,\n    today: {\n      completionPercent:0, achieved:false,\n      practiceGoal:{count:2,target:0,active:false,complete:true,percent:0,remaining:0},\n      reviewGoal:{count:0,target:0,active:false,complete:true,percent:0,remaining:0},\n    },\n    history:[\n      {dateKey:'2026-09-30',active:false,achieved:false,answered:0,completionPercent:0},\n      {dateKey:'2026-10-01',active:true,achieved:false,answered:7,completionPercent:0},\n      {dateKey:'2026-10-02',active:true,achieved:false,answered:2,completionPercent:0},\n    ],\n  },\n});\nassert.match(noGoalHtml, /<strong>尚未設定<\\/strong>/);\nassert.match(noGoalHtml, /目前未啟用每日目標/);\nassert.match(noGoalHtml, /啟用目標後開始計算達成日/);\nassert.match(noGoalHtml, /有學習/);\nassert.doesNotMatch(noGoalHtml, />0%<\\/strong>/);\nassert.doesNotMatch(noGoalHtml, /0 \\/ 3/);\n\nconst activeGoalHtml = renderLearningGoalPanel({\n  banks: [], selectedScope: GLOBAL_SCOPE, configured: true,\n  goal: { id:'global', bankId:null, enabled:true, dailyPracticeTarget:5, dailyReviewTarget:2 },\n  progress: {\n    activeTargetCount:2, streak:2, recentAchievedDays:1,\n    today: {\n      completionPercent:29, achieved:false,\n      practiceGoal:{count:2,target:5,active:true,complete:false,percent:40,remaining:3},\n      reviewGoal:{count:0,target:2,active:true,complete:false,percent:0,remaining:2},\n    },\n    history:[\n      {dateKey:'2026-10-01',active:true,achieved:true,answered:7,completionPercent:100},\n      {dateKey:'2026-10-02',active:true,achieved:false,answered:2,completionPercent:29},\n    ],\n  },\n});\nassert.match(activeGoalHtml, /<strong>29%<\\/strong>/);\nassert.match(activeGoalHtml, /1 \\/ 2/);\nassert.match(activeGoalHtml, />✓<\\/strong>/);\nassert.match(activeGoalHtml, />29%<\\/strong>/);\nassert.doesNotMatch(activeGoalHtml, /尚未設定<\\/strong>/);\n\nconst source=fs.readFileSync('src/ui/learning-goals.js','utf8');\nassert.match(source,/hasActiveGoal/);\nassert.match(source,/有學習/);\nassert.match(source,/尚未設定/);\nconsole.log('MoXin Quiz v4.0 P3.1.1 learning goal activity UX tests passed.');\n";
const DOC_CODE = "# 墨忻刷題網 v4.0 — P3.1.1 Learning Goal Activity UX\n\n尚未啟用有效每日目標時，不再把有作答的日期顯示成 0%。\n\n- 今日整體進度：顯示「尚未設定」\n- 近 7 日達成：顯示「—」\n- 無作答日：顯示「—」\n- 有作答日：顯示「有學習」並保留題數\n- 啟用有效 target 後才顯示百分比、✓ 與 X / 7\n\n這次只修 UI 呈現，不修改 P3 Core 計算。\n";
function read(path){return fs.readFileSync(path,'utf8');}
function write(path,content){fs.mkdirSync(path.split('/').slice(0,-1).join('/')||'.',{recursive:true});fs.writeFileSync(path,content,'utf8');}
function replaceOne(source,search,replacement,label){const first=source.indexOf(search);if(first<0)throw new Error(`Missing patch anchor: ${label}`);if(source.indexOf(search,first+search.length)>=0)throw new Error(`Patch anchor is not unique: ${label}`);return source.slice(0,first)+replacement+source.slice(first+search.length);}

write('tests/v40-p311-learning-goal-activity-ux-run.mjs',TEST_CODE);
write('docs/V4_0_P3_1_1_LEARNING_GOAL_ACTIVITY_UX.md',DOC_CODE);

{
  const path='src/ui/learning-goals.js';
  let source=read(path);
  for(const patch of PATCHES) source=replaceOne(source,patch.search,patch.replacement,patch.label);
  write(path,source);
}

{
  const path='package.json';
  const pkg=JSON.parse(read(path));
  const anchor='node tests/v40-p31-learning-goals-ui-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';
  const replacement='node tests/v40-p31-learning-goals-ui-run.mjs && node tests/v40-p311-learning-goal-activity-ux-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';
  if(!pkg.scripts.test.includes('v40-p311-learning-goal-activity-ux-run.mjs')){if(!pkg.scripts.test.includes(anchor))throw new Error('package.json P3.1.1 insertion anchor not found');pkg.scripts.test=pkg.scripts.test.replace(anchor,replacement);}
  write(path,JSON.stringify(pkg,null,2)+'\n');
}

{
  let sw=read('service-worker.js');
  sw=replaceOne(sw,"const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-9';","const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-10';",'P3.1.1 cache revision');
  write('service-worker.js',sw);
}

{
  const path='docs/V4_0_CHANGELOG.md';
  let c=read(path);
  if(!c.includes('## P3.1.1 — Learning Goal Activity UX')){
    const anchor='## P3.1 — Learning Goal UI';
    const section=`## P3.1.1 — Learning Goal Activity UX
- 未啟用有效 target 時，「今日整體進度」顯示「尚未設定」，近 7 日達成顯示「—」。
- 最近 7 日有作答日期改顯示「有學習」，並保留實際題數。
- 啟用有效 target 後才顯示百分比、達成 ✓ 與 X / 7。
- 僅調整 UI 呈現，不更動 P3 Core 統計規則。
- APP cache 更新至 r2k.5-10。

`;
    if(!c.includes(anchor))throw new Error('P3.1 changelog anchor missing');
    c=c.replace(anchor,section+anchor);
  }
  write(path,c);
}

{
  const ui=read('src/ui/learning-goals.js');
  const pkg=JSON.parse(read('package.json'));
  const sw=read('service-worker.js');
  for(const marker of ['hasActiveGoal',"'尚未設定'","'有學習'"])if(!ui.includes(marker))throw new Error(`P3.1.1 marker missing: ${marker}`);
  if(!pkg.scripts.test.includes('v40-p311-learning-goal-activity-ux-run.mjs'))throw new Error('P3.1.1 regression missing');
  if(!sw.includes("CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-10'"))throw new Error('P3.1.1 cache revision missing');
  if(read('index.html')!==read('v3.html'))throw new Error('Release entries diverged before P3.1.1 commit');
}
console.log('P3.1.1 learning goal activity UX patch applied successfully.');
