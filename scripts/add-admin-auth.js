const fs = require('fs');
const path = require('path');

const adminApiDir = path.join(__dirname, '../app/api/admin');

function traverse(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverse(fullPath);
    } else if (fullPath.endsWith('.ts') && !fullPath.includes('verify-otp') && !fullPath.includes('send-otp')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // If already added, skip
      if (content.includes('requireAdminSession')) continue;
      
      // Add import
      content = `import { requireAdminSession } from '@/lib/admin-auth'\n` + content;
      
      // Add auth check to every exported async function
      content = content.replace(/(export async function \w+\(.*\) \{)/g, `$1\n  const adminUser = await requireAdminSession();\n  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });\n`);
      
      // Make sure NextResponse is imported if not
      if (!content.includes("import { NextResponse")) {
         content = `import { NextResponse } from 'next/server'\n` + content;
      }
      
      fs.writeFileSync(fullPath, content);
      console.log('Updated ' + fullPath);
    }
  }
}

traverse(adminApiDir);

// Also do escalation
const escalationPath = path.join(__dirname, '../app/api/escalation/route.ts');
if (fs.existsSync(escalationPath)) {
  let content = fs.readFileSync(escalationPath, 'utf8');
  if (!content.includes('requireAdminSession')) {
    content = `import { requireAdminSession } from '@/lib/admin-auth'\n` + content;
    content = content.replace(/(export async function \w+\(.*\) \{)/g, `$1\n  const adminUser = await requireAdminSession();\n  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });\n`);
    fs.writeFileSync(escalationPath, content);
    console.log('Updated escalation path');
  }
}
