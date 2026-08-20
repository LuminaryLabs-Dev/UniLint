export function parseUnityVersion(input) {
  const value = String(input ?? '').trim();
  const match = value.match(/^(\d+)\.(\d+)(?:\.(\d+))?([abfp]\d+)?/i);
  if (!match) return null;
  return {
    raw: value,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3] ?? 0),
    release: match[4] ?? '',
    line: `${match[1]}.${match[2]}`,
  };
}

export function compareUnityVersions(a, b) {
  const left = typeof a === 'string' ? parseUnityVersion(a) : a;
  const right = typeof b === 'string' ? parseUnityVersion(b) : b;
  if (!left || !right) throw new Error('Cannot compare invalid Unity versions.');
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }
  return 0;
}

export function unityAtLeast(actual, minimum) {
  return compareUnityVersions(actual, minimum) >= 0;
}
