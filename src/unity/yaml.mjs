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

// Detailed graph extraction is opt-in; the inexpensive inventory remains compatible.
import { parseDocument } from 'yaml';

export function parseYamlData(text) {
  const document = parseDocument(text, { schema: 'failsafe', uniqueKeys: true, prettyErrors: false, strict: true });
  if (document.errors.length || document.warnings.length) throw new Error([...document.errors, ...document.warnings].map(e => e.message).join('; '));
  return document.toJS({ maxAliasCount: 0 });
}

export function collectReferences(value, field = '', refs = []) {
  if (!value || typeof value !== 'object') return refs;
  if (!Array.isArray(value) && Object.hasOwn(value, 'fileID')) {
    refs.push({ field, fileId: String(value.fileID), guid: value.guid ? String(value.guid).toLowerCase() : null, type: value.type ?? null });
    return refs;
  }
  for (const [key, child] of Object.entries(value)) collectReferences(child, Array.isArray(value) ? `${field}[${key}]` : (field ? `${field}.${key}` : key), refs);
  return refs;
}

export function parseUnityDocuments(text) {
  const headers = [...text.matchAll(/^---\s*!u!(\d+)\s*&(-?\d+)(\s+stripped)?\s*$/gm)];
  const result = []; let previous = 0, line = 1;
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]; line += (text.slice(previous, h.index).match(/\n/g) ?? []).length; previous = h.index;
    const body = text.slice(h.index + h[0].length, headers[i + 1]?.index ?? text.length);
    const record = { classId: Number(h[1]), fileId: h[2], stripped: Boolean(h[3]), line, type: body.match(/^([A-Za-z0-9_]+):\s*$/m)?.[1] ?? null };
    try {
      const wrapper = parseYamlData(body);
      if (!wrapper || Object.keys(wrapper).length !== 1) throw new Error('Expected one Unity document root');
      record.data = wrapper[record.type];
      if (!record.data || typeof record.data !== 'object') throw new Error('Unsupported Unity document body');
      record.references = collectReferences(record.data);
    } catch (error) { record.error = error.message; record.data = null; record.references = []; }
    result.push(record);
  }
  return result;
}
