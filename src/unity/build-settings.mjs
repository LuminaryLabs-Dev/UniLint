import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseUnityDocuments } from './yaml.mjs';
import { readMetaGuid } from './meta.mjs';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function readBuildSettings(root) {
  const file = 'ProjectSettings/EditorBuildSettings.asset', absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) return { file, sha256: null, entries: [], errors: ['Build Settings file is missing'], complete: false };
  const raw = fs.readFileSync(absolute), docs = parseUnityDocuments(raw.toString('utf8'));
  const owner = docs.find(d => d.type === 'EditorBuildSettings');
  if (!owner || owner.error || !Array.isArray(owner.data?.m_Scenes)) return { file, sha256: sha256(raw), entries: [], errors: [owner?.error ?? 'Unsupported scene-list serialization'], complete: false };
  let enabledIndex = 0; const seenPaths = new Set(), seenGuids = new Set();
  const entries = owner.data.m_Scenes.map((s, listedIndex) => {
    const sourcePath = String(s.path ?? ''); const guid = String(s.guid ?? '').toLowerCase();
    const enabled = s.enabled === '1'; const errors = [];
    if (!['0','1'].includes(s.enabled)) errors.push('Invalid enabled flag');
    if (!sourcePath.startsWith('Assets/') || sourcePath.split('/').includes('..') || !sourcePath.endsWith('.unity')) errors.push('Invalid scene path');
    if (!/^[a-f0-9]{32}$/.test(guid)) errors.push('Invalid scene GUID');
    const absoluteScene = path.join(root, sourcePath);
    const exists = !errors.includes('Invalid scene path') && fs.existsSync(absoluteScene) && fs.statSync(absoluteScene).isFile();
    const metaGuid = exists ? readMetaGuid(`${absoluteScene}.meta`) : null;
    if (!exists) errors.push('Scene file missing');
    if (metaGuid !== guid) errors.push('Scene metadata GUID mismatch');
    if (seenPaths.has(sourcePath) || seenGuids.has(guid)) errors.push('Duplicate build-list identity');
    seenPaths.add(sourcePath); seenGuids.add(guid);
    return { listedIndex, enabledBuildIndex: enabled ? enabledIndex++ : null, enabled, path: sourcePath, guid, metaGuid, exists, sha256: exists ? sha256(fs.readFileSync(absoluteScene)) : null, errors };
  });
  return { file, sha256: sha256(raw), entries, errors: [], complete: entries.every(e => !e.errors.length) };
}

export function selectScenes(settings, { scope = 'build-list', scenes = [] } = {}) {
  if (settings.errors.length) throw new Error(settings.errors.join('; '));
  if (!['build-list','enabled','selected'].includes(scope)) throw new Error(`Unknown scope: ${scope}`);
  if (scope === 'selected' && !scenes.length) throw new Error('Selected scope requires --scene GUID/path or --scenes GUID,path');
  const selected = settings.entries.filter(s => scope === 'build-list' || (scope === 'enabled' ? s.enabled : scenes.includes(s.guid) || scenes.includes(s.path)));
  if (scope === 'selected') for (const selector of scenes) if (!selected.some(s => [s.guid,s.path].includes(selector))) throw new Error(`Scene is not in the build list: ${selector}`);
  return selected;
}
