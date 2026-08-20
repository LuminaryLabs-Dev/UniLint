import { extractGuidReferences } from './meta.mjs';

export function parseUnityYaml(text) {
  const documents = [];
  const header = /^---\s*!u!(\d+)\s*&(-?\d+)(?:\s+stripped)?\s*$/gm;
  const matches = [...text.matchAll(header)];

  for (let index = 0; index < matches.length; index++) {
    const current = matches[index];
    const start = current.index + current[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : text.length;
    const body = text.slice(start, end);
    const typeMatch = body.match(/^([A-Za-z0-9_]+):\s*$/m);
    documents.push({
      classId: Number(current[1]),
      fileId: current[2],
      type: typeMatch?.[1] ?? null,
      serializedVersion: Number(body.match(/^\s*serializedVersion:\s*(\d+)\s*$/m)?.[1] ?? 0) || null,
      guidReferences: extractGuidReferences(body),
    });
  }

  return {
    documents,
    guidReferences: extractGuidReferences(text),
  };
}
