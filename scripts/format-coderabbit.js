const fs = require('fs');
try {
  const content = fs.readFileSync('coderabbit-output.json', 'utf8');
  let data;
  try {
    data = JSON.parse(content);
  } catch(e) {
    // If it's not JSON, it might just be the string output
    fs.writeFileSync('coderabbit-review-formatted.md', content);
    process.exit(0);
  }

  // If it is an array of findings, let's format it
  let markdown = '# CodeRabbit Deep-Dive Review Results\n\n';
  if (Array.isArray(data)) {
    data.forEach(finding => {
      markdown += `## [${finding.severity}] ${finding.type}\n`;
      markdown += `**File:** \`${finding.file}\`\n\n`;
      markdown += `${finding.description}\n\n`;
      if (finding.suggestion) {
        markdown += `### Suggestion\n${finding.suggestion}\n\n`;
      }
      if (finding.code_snippet) {
        markdown += `\`\`\`${finding.file.split('.').pop()}\n${finding.code_snippet}\n\`\`\`\n\n`;
      }
      markdown += `---\n\n`;
    });
  } else {
    // Maybe it's a summary object
    markdown += JSON.stringify(data, null, 2);
  }
  fs.writeFileSync('coderabbit-review-formatted.md', markdown);
} catch (err) {
  console.error('Error processing:', err);
}
