const fs = require('fs');
const p = 'C:/Users/shann/.cursor/projects/c-Users-shann-Projects-Town-Hall-Tracker/agent-transcripts/6b3e496a-525f-4490-a859-784df315824e/subagents/5e5848a7-1757-4935-a37b-c5a6725ff79b.jsonl';
const raw = fs.readFileSync(p, 'utf8');
const start = raw.indexOf('TSA1NSA1OTEg');
const end = raw.indexOf('The string ends with', start);
if (start === -1 || end === -1) throw new Error('markers not found');
let b64 = raw.slice(start, end);
// trim trailing whitespace/newlines from prose before "The string ends with"
b64 = b64.trimEnd();
// remove trailing incomplete if ends before ==
const lastEq = b64.lastIndexOf('==');
b64 = b64.slice(0, lastEq + 2);
console.log('b64 len', b64.length);
console.log('decoded', Buffer.from(b64, 'base64').length);
console.log('start dec', Buffer.from(b64, 'base64').toString('utf8').slice(0, 40));
console.log('end dec', Buffer.from(b64, 'base64').toString('utf8').slice(-60));
