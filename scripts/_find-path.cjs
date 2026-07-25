const fs = require('fs');
const raw = fs.readFileSync('C:/Users/shann/.cursor/projects/c-Users-shann-Projects-Town-Hall-Tracker/agent-transcripts/6b3e496a-525f-4490-a859-784df315824e/6b3e496a-525f-4490-a859-784df315824e.jsonl', 'utf8');
const lines = raw.split('\n');
for (const line of lines) {
  if (!line.includes('pathLength') && !line.includes('b64_')) continue;
  if (line.length < 500) console.log(line.slice(0,500));
  else {
    const idx = line.indexOf('pathLength');
    console.log('long line pathLength context:', line.slice(Math.max(0,idx-50), idx+200));
  }
}
