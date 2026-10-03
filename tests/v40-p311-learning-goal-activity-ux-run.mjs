import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GLOBAL_SCOPE, renderLearningGoalPanel } from '../src/ui/learning-goals.js';

const noGoalHtml = renderLearningGoalPanel({
  banks: [], selectedScope: GLOBAL_SCOPE, configured: false,
  goal: { id:'global', bankId:null, enabled:false, dailyPracticeTarget:0, dailyReviewTarget:0 },
  progress: {
    activeTargetCount:0, streak:2, recentAchievedDays:0,
    today: {
      completionPercent:0, achieved:false,
      practiceGoal:{count:2,target:0,active:false,complete:true,percent:0,remaining:0},
      reviewGoal:{count:0,target:0,active:false,complete:true,percent:0,remaining:0},
    },
    history:[
      {dateKey:'2026-09-30',active:false,achieved:false,answered:0,completionPercent:0},
      {dateKey:'2026-10-01',active:true,achieved:false,answered:7,completionPercent:0},
      {dateKey:'2026-10-02',active:true,achieved:false,answered:2,completionPercent:0},
    ],
  },
});
assert.match(noGoalHtml, /<strong>尚未設定<\/strong>/);
assert.match(noGoalHtml, /目前未啟用每日目標/);
assert.match(noGoalHtml, /啟用目標後開始計算達成日/);
assert.match(noGoalHtml, /有學習/);
assert.doesNotMatch(noGoalHtml, />0%<\/strong>/);
assert.doesNotMatch(noGoalHtml, /0 \/ 3/);

const activeGoalHtml = renderLearningGoalPanel({
  banks: [], selectedScope: GLOBAL_SCOPE, configured: true,
  goal: { id:'global', bankId:null, enabled:true, dailyPracticeTarget:5, dailyReviewTarget:2 },
  progress: {
    activeTargetCount:2, streak:2, recentAchievedDays:1,
    today: {
      completionPercent:29, achieved:false,
      practiceGoal:{count:2,target:5,active:true,complete:false,percent:40,remaining:3},
      reviewGoal:{count:0,target:2,active:true,complete:false,percent:0,remaining:2},
    },
    history:[
      {dateKey:'2026-10-01',active:true,achieved:true,answered:7,completionPercent:100},
      {dateKey:'2026-10-02',active:true,achieved:false,answered:2,completionPercent:29},
    ],
  },
});
assert.match(activeGoalHtml, /<strong>29%<\/strong>/);
assert.match(activeGoalHtml, /1 \/ 2/);
assert.match(activeGoalHtml, />✓<\/strong>/);
assert.match(activeGoalHtml, />29%<\/strong>/);
assert.doesNotMatch(activeGoalHtml, /尚未設定<\/strong>/);

const source=fs.readFileSync('src/ui/learning-goals.js','utf8');
assert.match(source,/hasActiveGoal/);
assert.match(source,/有學習/);
assert.match(source,/尚未設定/);
console.log('MoXin Quiz v4.0 P3.1.1 learning goal activity UX tests passed.');
