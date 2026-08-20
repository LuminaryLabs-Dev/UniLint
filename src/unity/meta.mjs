import fs from 'node:fs';

export function readMetaGuid(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    const match = text.match(/^guid:\s*([0-9a-fA-F]{32})\s*$/m);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

export function extractGuidReferences(text) {
  const found = new Set();
  const regex = /guid:\s*([0-9a-fA-F]{32})/g;
  let match;
  while ((match = regex.exec(text))) found.add(match[1].toLowerCase());
  return [...found];
}
