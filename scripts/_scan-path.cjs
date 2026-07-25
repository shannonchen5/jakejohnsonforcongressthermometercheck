const fs = require('fs');
const raw = fs.readFileSync('C:/Users/shann/.cursor/projects/c-Users-shann-Projects-Town-Hall-Tracker/agent-transcripts/6b3e496a-525f-4490-a859-784df315824e/6b3e496a-525f-4490-a859-784df315824e.jsonl', 'utf8');
const idx = raw.indexOf('vectorPaths');
console.log('count vectorPaths', (raw.match(/vectorPaths/g)||[]).length);
// find long path-like strings with M commands
const re = /M [0-9][^"\\]{500,}/g;
let m, i=0;
while ((m = re.exec(raw)) && i<5) {
  console.log('hit', i, 'len', m[0].length, 'start', m[0].slice(0,80));
  i++;
}
