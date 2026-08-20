import fs from 'node:fs';

export function parseScriptingDefines(projectSettingsFile) {
  if (!fs.existsSync(projectSettingsFile)) return {};
  const lines = fs.readFileSync(projectSettingsFile, 'utf8').split(/\r?\n/);
  const result = {};
  const start = lines.findIndex((line) => /^\s*scriptingDefineSymbols:\s*$/.test(line));
  if (start < 0) return result;
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) continue;
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= 2) break;
    const match = line.match(/^\s{4,}([^:]+):\s*(.*)$/);
    if (!match) continue;
    result[match[1].trim()] = match[2].trim().split(';').map((value) => value.trim()).filter(Boolean);
  }
  return result;
}
