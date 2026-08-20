function parse(value) {
  const match = String(value ?? '').trim().match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+]([^\s]+))?/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
    prerelease: match[4] ?? '',
  };
}

function compare(a, b) {
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return null;
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }
  if (left.prerelease === right.prerelease) return 0;
  if (!left.prerelease) return 1;
  if (!right.prerelease) return -1;
  return left.prerelease.localeCompare(right.prerelease, undefined, { numeric: true });
}

export function satisfiesVersionExpression(version, expression) {
  const expr = String(expression ?? '').trim();
  if (!expr) return false;

  if (!expr.startsWith('[') && !expr.startsWith('(')) {
    return compare(version, expr) === 0;
  }

  const match = expr.match(/^([[(])\s*([^,\])}]*)\s*(?:,\s*([^\])}]*)\s*)?([\])])$/);
  if (!match) return false;
  const [, lowerBracket, lowerRaw, upperRaw = '', upperBracket] = match;
  const lower = lowerRaw.trim();
  const upper = upperRaw.trim();

  if (lower) {
    const cmp = compare(version, lower);
    if (cmp === null || cmp < 0 || (cmp === 0 && lowerBracket === '(')) return false;
  }
  if (upper) {
    const cmp = compare(version, upper);
    if (cmp === null || cmp > 0 || (cmp === 0 && upperBracket === ')')) return false;
  }
  return true;
}
