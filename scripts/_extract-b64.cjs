const fs = require('fs');
const p = 'C:/Users/shann/.cursor/projects/c-Users-shann-Projects-Town-Hall-Tracker/agent-transcripts/6b3e496a-525f-4490-a859-784df315824e/subagents/5e5848a7-1757-4935-a37b-c5a6725ff79b.jsonl';
const raw = fs.readFileSync(p, 'utf8');
for (const key of ['b64_0', 'b64_1', 'b64_2', 'b64_3']) {
  const marker = `"${key}":"`;
  let idx = raw.indexOf(marker);
  if (idx === -1) {
    console.log(key, 'not found');
    continue;
  }
  idx += marker.length;
  let end = idx;
  while (end < raw.length && raw[end] !== '"') {
    if (raw[end] === '\\') end += 2;
    else end++;
  }
  const b64 = raw.slice(idx, end);
  console.log(key, 'b64len', b64.length, 'decoded', Buffer.from(b64, 'base64').length);
}
