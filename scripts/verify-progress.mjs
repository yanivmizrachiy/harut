import fs from 'node:fs';

const file = new URL('../workplans/harut.json', import.meta.url);
const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = (msg) => { throw new Error(`Progress verification failed: ${msg}`); };

if (!plan.requirementsBaseline || typeof plan.requirementsBaseline.ready !== 'boolean') fail('requirementsBaseline missing');
if (!Array.isArray(plan.tasks) || plan.tasks.length === 0) fail('tasks missing');

for (const task of plan.tasks) {
  if (!task.id || !task.title) fail('task identity missing');
  if (!Number.isFinite(task.percent) || task.percent < 0 || task.percent > 100) fail(`${task.id}: invalid percent`);
  if (!['pending', 'in_progress', 'blocked', 'done'].includes(task.status)) fail(`${task.id}: invalid status`);
  if (task.percent > 0 && (!Array.isArray(task.evidence) || task.evidence.length === 0)) fail(`${task.id}: progress without evidence`);
  if (task.status === 'done' && task.percent !== 100) fail(`${task.id}: done must equal 100`);
}

if (!plan.requirementsBaseline.ready) {
  if (plan.progress.overallProgressPercent !== null) fail('overallProgressPercent must stay null before requirements are baselined');
  if (plan.progress.remainingPercent !== null) fail('remainingPercent must stay null before requirements are baselined');
  if (plan.progress.verifiedAgainstCanonicalRequirementsPercent !== 0) fail('verified percent must be 0 before canonical requirements exist');
  if (plan.progress.status !== 'blocked_pending_source_of_truth') fail('unexpected pre-baseline status');
  console.log('Harut progress verified: canonical requirements not yet on GitHub; no completion percentage is being fabricated.');
  process.exit(0);
}

const scored = plan.tasks.filter(t => t.weight > 0);
const weightTotal = scored.reduce((sum, t) => sum + t.weight, 0);
if (weightTotal !== 100) fail(`scored task weights total ${weightTotal}, expected 100`);
const calculated = Math.round(scored.reduce((sum, t) => sum + (t.weight * t.percent / 100), 0));
if (plan.progress.overallProgressPercent !== calculated) fail(`overallProgressPercent must be ${calculated}`);
if (plan.progress.remainingPercent !== 100 - calculated) fail(`remainingPercent must be ${100 - calculated}`);
if (calculated === 100 && scored.some(t => t.status !== 'done')) fail('100% requires every scored task done');
console.log(`Harut progress verified: ${calculated}% complete, ${100 - calculated}% remaining.`);
