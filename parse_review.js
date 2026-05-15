const fs = require('fs');
const lines = fs.readFileSync('coderabbit_review.json', 'utf8').split('\n').filter(Boolean);
let md = '# CodeRabbit Code Review\n\n## Major / Security Issues\n\n';
const findings = [];
for (const line of lines) {
  try {
    const obj = JSON.parse(line);
    if (obj.type === 'finding') findings.push(obj);
  } catch(e) {}
}

const majors = findings.filter(f => f.severity === 'major');
const minors = findings.filter(f => f.severity === 'minor');

for (const m of majors) {
  md += `### 🚨 ${m.fileName}\n${m.codegenInstructions}\n\n`;
}

md += '\n## Minor Issues (Top 10)\n\n';
for (const m of minors.slice(0, 10)) {
  md += `### ⚠️ ${m.fileName}\n${m.codegenInstructions}\n\n`;
}

// Write using proper pathing
const artifactPath = require('path').join(
  process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config'),
  '../.gemini/antigravity/brain/cf3db9c9-152a-4c10-8a77-f1e63ed0e9cf/artifacts/coderabbit_review_results.md'
);

try {
  fs.writeFileSync('C:/Users/misra/.gemini/antigravity/brain/cf3db9c9-152a-4c10-8a77-f1e63ed0e9cf/coderabbit_review_results.md', md);
} catch(e) {
  fs.writeFileSync('coderabbit_review_results.md', md);
}
