import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/matches.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext}});
const { filterMatches, formatStart, parseMatches, statusLabel } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

const data = parseMatches(JSON.parse(readFileSync(new URL('../data/matches.json', import.meta.url), 'utf8')));
test('all keeps every match, including live and postponed', () => {
  assert.deepEqual(filterMatches(data.matches, 'all').map(m => m.id), ['m1','m2','m3','m4','m5','m6','m7','m8']);
});
test('upcoming includes postponed; finished includes only finished', () => {
  assert.deepEqual(filterMatches(data.matches, 'upcoming').map(m => m.id), ['m5','m6','m7','m8']);
  assert.deepEqual(filterMatches(data.matches, 'finished').map(m => m.id), ['m1','m2','m3']);
});
test('empty response is valid', () => {
  assert.deepEqual(filterMatches(parseMatches({round: 12, matches: []}).matches, 'all'), []);
});
test('zero goals are preserved, null date has a readable fallback', () => {
  assert.deepEqual(data.matches[1].score, {home: 0, away: 0});
  assert.equal(formatStart(data.matches[6].startsAt), 'Дата уточняется');
  assert.equal(formatStart('invalid'), 'Дата уточняется');
});
test('time is formatted in the device timezone', () => {
  const expected = new Date(data.matches[0].startsAt).toLocaleString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  assert.equal(formatStart(data.matches[0].startsAt), expected);
});
test('live minute zero is valid; new statuses are not lost', () => {
  assert.equal(statusLabel({...data.matches[3], minute: 0}), 'В прямом эфире · 0 мин');
  const unknown = {...data.matches[0], status: 'cancelled'};
  assert.equal(statusLabel(unknown), 'Статус неизвестен');
  assert.deepEqual(filterMatches([unknown], 'all'), [unknown]);
});
test('malformed responses and duplicate IDs fail explicitly', () => {
  for (const value of [null, {}, {round: 12, matches: [{}]}, {...data, matches: [data.matches[0], data.matches[0]]},
    {...data, matches: [{...data.matches[0], score: {home: -1, away: 0}}]}]) {
    assert.throws(() => parseMatches(value));
  }
});

