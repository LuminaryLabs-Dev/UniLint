import fs from 'node:fs';
import path from 'node:path';
import { exists, readJson, relative } from '../core/fs.mjs';

// Resolve only declared/locked packages. Never select another cached version by proximity.
export function resolvePackageRoots(root, data) {
  const roots = [], resolutions = [];
  const declared = data.manifest?.dependencies ?? {};
  const locked = data.lock?.dependencies ?? {};
  const names = new Set([...Object.keys(declared), ...Object.keys(locked)]);
  const packagesDir = path.join(root, 'Packages');
  if (exists(packagesDir)) for (const e of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (e.isDirectory() && exists(path.join(packagesDir, e.name, 'package.json'))) names.add(e.name);
  }
  for (const name of [...names].sort()) {
    const entry = locked[name] ?? {};
    const requested = String(declared[name] ?? entry.version ?? '');
    const version = entry.version ?? (/^\d/.test(requested) ? requested : null);
    const embedded = path.join(packagesDir, name);
    let candidate = null, kind = null;
    if (exists(path.join(embedded, 'package.json'))) { candidate = embedded; kind = 'embedded'; }
    else if (requested.startsWith('file:')) { candidate = path.resolve(packagesDir, requested.slice(5)); kind = 'local'; }
    else if (version && /^\d[^/]*$/.test(version)) { candidate = path.join(root, 'Library/PackageCache', `${name}@${version}`); kind = 'cache'; }
    else if (entry.hash && /^[a-f0-9]{7,40}$/i.test(entry.hash)) {
      const cache = path.join(root, 'Library/PackageCache');
      const matches = exists(cache) ? fs.readdirSync(cache).filter(x => x.startsWith(`${name}@`) && x.split('@')[1].length >= 7 && entry.hash.startsWith(x.split('@')[1])) : [];
      if (matches.length === 1) { candidate = path.join(cache, matches[0]); kind = 'git-cache'; }
    }
    const result = { name, requested, resolvedVersion: version, kind, path: candidate ? relative(root, candidate) : null, status: 'unavailable' };
    if (!candidate && name.startsWith('com.unity.modules.')) result.status = 'engine-module';
    if (candidate && exists(path.join(candidate, 'package.json'))) {
      try {
        const manifest = readJson(path.join(candidate, 'package.json'));
        if (manifest.name !== name) throw new Error(`Expected package ${name}, found ${manifest.name}`);
        if (kind === 'cache' && manifest.version !== version) throw new Error(`Expected version ${version}, found ${manifest.version}`);
        result.status = 'resolved'; result.actualVersion = manifest.version; roots.push(candidate);
      } catch (error) { result.status = 'invalid'; result.reason = error.message; }
    }
    resolutions.push(result);
  }
  return { roots: [...new Set(roots)], resolutions };
}
