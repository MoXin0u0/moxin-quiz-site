import assert from 'node:assert/strict';

// B02 D-02: deterministic, non-production, fictitious-case tests.
// No accounts, records, calendar API, network requests, or user data are accessed.
// Use date-only calendar arithmetic rather than 365/730 days or UTC timestamp offsets.
const formatDate = (y, m, d) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function parseCalendarDate(value) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/, 'use a date-only YYYY-MM-DD');
  const [year, month, day] = value.split('-').map(Number);
  const verified = new Date(Date.UTC(year, month - 1, day));
  assert.equal(formatDate(verified.getUTCFullYear(), verified.getUTCMonth() + 1, verified.getUTCDate()), value, 'invalid calendar date');
  return { year, month, day };
}

function addCalendarYearsClamped(dayString, years) {
  assert.ok(Number.isInteger(years) && years > 0);
  const { year, month, day } = parseCalendarDate(dayString);
  const targetYear = year + years;
  const targetLastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return formatDate(targetYear, month, Math.min(day, targetLastDay));
}

function addCalendarMonthsClamped(dayString, months) {
  assert.ok(Number.isInteger(months) && months > 0);
  const { year, month, day } = parseCalendarDate(dayString);
  const targetMonthIndex = (year * 12) + month - 1 + months;
  const y = Math.floor(targetMonthIndex / 12);
  const m = (targetMonthIndex % 12) + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return formatDate(y, m, Math.min(day, last));
}

// A reminder is only drafted for a completed, ordinary case. No actual reminder is created.
function mockReminder(caseItem) {
  if (caseItem.status !== 'closed' || caseItem.kind !== 'general') return null;
  const years = { forms: 1, gmail: 2 }[caseItem.channel];
  if (!years) return null;
  return {
    id: caseItem.id,
    channel: caseItem.channel,
    dueDate: addCalendarYearsClamped(caseItem.closedOn, years),
    state: 'proposal_only',
  };
}

// Human-verified identity and hold checks are mandatory before any later deletion.
function mockDeletionGate({ uniqueMatch, hold, dueDate, reviewDate }) {
  return uniqueMatch === true && hold === false && reviewDate >= dueDate;
}

const cases = [
  { id: 'SIM-F01', channel: 'forms', kind: 'general', status: 'closed', closedOn: '2026-10-21', expected: '2027-10-21' },
  { id: 'SIM-G01', channel: 'gmail', kind: 'general', status: 'closed', closedOn: '2026-10-21', expected: '2028-10-21' },
  { id: 'SIM-F02', channel: 'forms', kind: 'general', status: 'closed', closedOn: '2026-12-31', expected: '2027-12-31' },
  { id: 'SIM-G02', channel: 'gmail', kind: 'general', status: 'closed', closedOn: '2026-12-31', expected: '2028-12-31' },
  { id: 'SIM-F03', channel: 'forms', kind: 'general', status: 'closed', closedOn: '2024-02-29', expected: '2025-02-28' },
  { id: 'SIM-G03', channel: 'gmail', kind: 'general', status: 'closed', closedOn: '2024-02-29', expected: '2026-02-28' },
  { id: 'SIM-F04', channel: 'forms', kind: 'general', status: 'closed', closedOn: '2027-03-01', expected: '2028-03-01' },
];
for (const sample of cases) {
  assert.equal(mockReminder(sample).dueDate, sample.expected, sample.id);
  assert.equal(mockReminder(sample).state, 'proposal_only');
}
assert.equal(mockReminder({ id: 'SIM-OPEN', channel: 'forms', kind: 'general', status: 'open' }), null);
assert.equal(mockReminder({ id: 'SIM-HOLD', channel: 'gmail', kind: 'special', status: 'closed', closedOn: '2026-10-21' }), null);
assert.equal(mockReminder({ id: 'SIM-INVALID', channel: 'other', kind: 'general', status: 'closed', closedOn: '2026-10-21' }), null);
assert.throws(() => parseCalendarDate('2026-02-29'));
assert.throws(() => parseCalendarDate('2026-13-01'));
assert.throws(() => parseCalendarDate('2026-2-01'));
assert.equal(addCalendarYearsClamped('2023-02-28', 1), '2024-02-28');
assert.equal(addCalendarMonthsClamped('2026-11-30', 3), '2027-02-28');
assert.equal(addCalendarMonthsClamped('2026-12-31', 3), '2027-03-31');

// Quarterly review does not extend an already-fixed individual due date.
const fixedExpiry = '2027-03-01';
const nextQuarterReview = addCalendarMonthsClamped('2027-01-21', 3);
assert.equal(nextQuarterReview, '2027-04-21');
assert.ok(fixedExpiry < nextQuarterReview, 'individual due dates must not wait for the next quarterly audit');
assert.equal(mockDeletionGate({ uniqueMatch: false, hold: false, dueDate: '2027-03-01', reviewDate: '2027-03-01' }), false);
assert.equal(mockDeletionGate({ uniqueMatch: true, hold: true, dueDate: '2027-03-01', reviewDate: '2027-03-01' }), false);
assert.equal(mockDeletionGate({ uniqueMatch: true, hold: false, dueDate: '2027-03-01', reviewDate: '2027-02-28' }), false);
assert.equal(mockDeletionGate({ uniqueMatch: true, hold: false, dueDate: '2027-03-01', reviewDate: '2027-03-01' }), true);

// This simulates eligibility ONLY, never actual permission or a delete operation.
console.log('B02 D-02 fictitious calendar-year, quarterly-review and deletion-guard fixtures PASS.');
