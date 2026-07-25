const fs = require('fs');
const p = 'C:/Users/shann/.cursor/projects/c-Users-shann-Projects-Town-Hall-Tracker/agent-transcripts/6b3e496a-525f-4490-a859-784df315824e/6b3e496a-525f-4490-a859-784df315824e.jsonl';
const raw = fs.readFileSync(p, 'utf8');
const prefixes = [
  ['0', 'TSA1NSA1OTEg'],
  ['1', 'MzAwLjQyNjIzOTAxMzY3MTkg'],
  ['2', 'NDM3LjM4NTI1MzkwNjI1'],
];
for (const [id, pref] of prefixes) {
  const idx = raw.indexOf(pref);
  console.log('prefix', id, 'idx', idx);
}
const re = /[A-Za-z0-9+/=]{1000,}/g;
let m;
const hits = [];
while ((m = re.exec(raw))) {
  const s = m[0];
  let d;
  try { d = Buffer.from(s, 'base64').length; } catch { continue; }
  hits.push({ d, start: s.slice(0, 30), len: s.length });
}
hits.sort((a, b) => b.d - a.d);
console.log('top hits', hits.slice(0, 15));
