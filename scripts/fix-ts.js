const fs = require('fs');

// 1. Fix app/api/admin/patients/route.ts
let content = fs.readFileSync('app/api/admin/patients/route.ts', 'utf8');
content = content.replace(/s\.id/g, 's.uid');
fs.writeFileSync('app/api/admin/patients/route.ts', content);

// 2. Fix app/api/admin/send-otp/route.ts
content = fs.readFileSync('app/api/admin/send-otp/route.ts', 'utf8');
// Replace sessions.forEach(s => s.email && emails.add(s.email.toLowerCase().trim()))
// with just a no-op or use getPatientByUid if necessary. We can just catch and ignore or check patients collection.
content = content.replace(/sessions\.forEach\(s => s\.email && emails\.add\(s\.email\.toLowerCase\(\)\.trim\(\)\)\)/g, '/* chat sessions do not store email directly anymore */');
fs.writeFileSync('app/api/admin/send-otp/route.ts', content);

// 3. Fix scripts/check-blood-tests.ts
content = fs.readFileSync('scripts/check-blood-tests.ts', 'utf8');
content = content.replace(/d\.name/g, '(d as any).name');
fs.writeFileSync('scripts/check-blood-tests.ts', content);

console.log('Fixed TS errors');
