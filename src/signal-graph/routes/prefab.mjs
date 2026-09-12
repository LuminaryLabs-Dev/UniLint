import { extractSerialized } from '../extract/serialized.mjs';
// Definitions are parsed once. Each use retains its own file-scoped instance node and overrides.
export function routePrefab(graph, file) { return extractSerialized(graph, file); }
