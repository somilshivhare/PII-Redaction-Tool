'use strict';
const { redact } = require('../src/redactor');
const cases = require('./synthetic_ground_truth');

function norm(s) { return s.trim().toUpperCase().replace(/\s+/g, ' '); }

const stats = {}; // type -> {tp, fp, fn}
function bump(type, key) {
  if (!stats[type]) stats[type] = { tp: 0, fp: 0, fn: 0 };
  stats[type][key]++;
}

let totalTP = 0, totalFP = 0, totalFN = 0;
const details = [];

for (const c of cases) {
  const { entities } = redact(c.text);
  const found = entities.map(e => ({ type: e.type, value: norm(e.original) }));
  const expected = c.expected.map(e => ({ type: e.type, value: norm(e.value) }));

  const foundCopy = [...found];
  for (const exp of expected) {
    const idx = foundCopy.findIndex(f => f.value === exp.value); // type-agnostic value match
    if (idx >= 0) {
      totalTP++; bump(exp.type, 'tp');
      foundCopy.splice(idx, 1);
    } else {
      totalFN++; bump(exp.type, 'fn');
      details.push(`MISSED: [${exp.type}] "${exp.value}" in: "${c.text}"`);
    }
  }
  // whatever's left in foundCopy are false positives
  for (const fp of foundCopy) {
    totalFP++; bump(fp.type, 'fp');
    details.push(`FALSE POSITIVE: [${fp.type}] "${fp.value}" in: "${c.text}"`);
  }
}

console.log('=== Per-type results ===');
for (const [type, s] of Object.entries(stats)) {
  const precision = s.tp / (s.tp + s.fp) || 0;
  const recall = s.tp / (s.tp + s.fn) || 0;
  const f1 = (2 * precision * recall) / (precision + recall) || 0;
  console.log(`${type.padEnd(18)} TP=${s.tp} FP=${s.fp} FN=${s.fn}  P=${precision.toFixed(2)} R=${recall.toFixed(2)} F1=${f1.toFixed(2)}`);
}

const precision = totalTP / (totalTP + totalFP) || 0;
const recall = totalTP / (totalTP + totalFN) || 0;
const f1 = (2 * precision * recall) / (precision + recall) || 0;
console.log('\n=== Overall (synthetic set) ===');
console.log(`TP=${totalTP} FP=${totalFP} FN=${totalFN}`);
console.log(`Precision=${precision.toFixed(3)}  Recall=${recall.toFixed(3)}  F1=${f1.toFixed(3)}`);

if (details.length) {
  console.log('\n=== Details ===');
  details.forEach(d => console.log(d));
}
