import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_IGNORES = new Set(['.git', 'Library', 'Temp', 'Obj', 'Logs', 'UserSettings', 'node_modules']);

export function normalizePath(value) {
  return value.split(path.sep).join('/');
}

export function relative(root, value) {
  return normalizePath(path.relative(root, value));
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

export function exists(file) {
  return fs.existsSync(file);
}

export function walk(root, options = {}) {
  const ignores = new Set([...(options.ignores ?? []), ...DEFAULT_IGNORES]);
  const results = [];
  if (!fs.existsSync(root)) return results;

  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!ignores.has(entry.name)) {
          results.push({ path: absolute, type: 'directory' });
          stack.push(absolute);
        }
      } else if (entry.isFile()) {
        results.push({ path: absolute, type: 'file' });
      }
    }
  }
  return results;
}
