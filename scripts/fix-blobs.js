const fs = require('fs');
const path = require('path');

function replaceBlobs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content.replace(/w-\[(\d+)px\] h-\[\1px\]/g, 'w-[min($1px,100vw)] h-[min($1px,100vw)]');
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log('Fixed blobs in ' + filePath);
  }
}

function traverse(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverse(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      replaceBlobs(fullPath);
    }
  }
}

traverse(path.join(__dirname, '../app'));
traverse(path.join(__dirname, '../components'));
