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
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) { throw new Error(`${file}: ${error.message}`, { cause: error }); }
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
      if (options.unityVisible && (entry.name.startsWith('.') || entry.name.endsWith('~'))) continue;
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

// Resolve through existing parents so output symlinks cannot bypass project-source guards.
export function outputPathOutsideSource(projectRoot, destination) {
  const requested=path.resolve(destination);let parent=path.dirname(requested), suffix=[path.basename(requested)];
  while(!fs.existsSync(parent)) { suffix.unshift(path.basename(parent));const next=path.dirname(parent);if(next===parent)break;parent=next; }
  const actual=path.join(fs.realpathSync(parent),...suffix);
  const rel=path.relative(fs.realpathSync(projectRoot),actual);
  if(['Assets','Packages','ProjectSettings','Library','.git'].some(d=>rel===d||rel.startsWith(d+path.sep))) throw new Error('Output must be outside Unity source/cache and Git directories.');
  return actual;
}
