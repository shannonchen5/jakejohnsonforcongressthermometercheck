const fs = require('fs');
const raw = fs.readFileSync('C:/Users/shann/.cursor/projects/c-Users-shann-Projects-Town-Hall-Tracker/agent-transcripts/6b3e496a-525f-4490-a859-784df315824e/6b3e496a-525f-4490-a859-784df315824e.jsonl', 'utf8');
const lines = raw.split('\n');
for (let li = 0; li < lines.length; li++) {
  const line = lines[li];
  if (!line.trim()) continue;
  let obj;
  try { obj = JSON.parse(line); } catch { continue; }
  const text = JSON.stringify(obj);
  if (text.includes('55.667213439941406') || text.includes('pathLength":28622') || text.includes('"pathLength":28622')) {
    console.log('line', li, 'len', text.length);
  }
  // find nested path strings
  const re = /"path"\s*:\s*"([^"]{10000,})"/g;
  let m;
  while ((m = re.exec(text))) {
    console.log('found path in line', li, 'pathLen', m[1].length, 'start', m[1].slice(0,50));
  }
}
