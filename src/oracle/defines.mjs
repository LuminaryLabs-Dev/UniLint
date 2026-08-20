import { parseUnityVersion } from '../unity/version.mjs';

const PLATFORM_DEFINES = {
  windows: ['UNITY_STANDALONE', 'UNITY_STANDALONE_WIN'],
  macos: ['UNITY_STANDALONE', 'UNITY_STANDALONE_OSX'],
  linux: ['UNITY_STANDALONE', 'UNITY_STANDALONE_LINUX'],
  android: ['UNITY_ANDROID'],
  ios: ['UNITY_IOS'],
  webgl: ['UNITY_WEBGL'],
};

function normalizePlatform(value) {
  const platform = String(value ?? 'windows').toLowerCase();
  if (platform === 'win' || platform === 'windows64') return 'windows';
  if (platform === 'osx' || platform === 'mac') return 'macos';
  return platform;
}

export function buildTargetEnvironment({ unity, platform = 'windows', editor = true, backend = null, architecture = null, graphics = null, customDefines = [] }) {
  const parsed = parseUnityVersion(unity);
  if (!parsed) throw new Error(`Invalid target Unity version '${unity}'.`);
  const normalizedPlatform = normalizePlatform(platform);
  const defines = new Set();
  if (editor) defines.add('UNITY_EDITOR');
  for (const define of PLATFORM_DEFINES[normalizedPlatform] ?? []) defines.add(define);
  if (editor && normalizedPlatform === 'windows') defines.add('UNITY_EDITOR_WIN');
  if (editor && normalizedPlatform === 'macos') defines.add('UNITY_EDITOR_OSX');
  if (editor && normalizedPlatform === 'linux') defines.add('UNITY_EDITOR_LINUX');
  if (String(backend).toLowerCase() === 'il2cpp') defines.add('ENABLE_IL2CPP');
  if (String(backend).toLowerCase() === 'mono') defines.add('ENABLE_MONO');

  if (parsed.major === 6000) {
    for (let minor = 0; minor <= parsed.minor; minor++) defines.add(`UNITY_6000_${minor}_OR_NEWER`);
  }

  for (const define of customDefines) if (define) defines.add(define);
  return {
    unityVersion: parsed.raw,
    unityLine: parsed.line,
    platform: normalizedPlatform,
    editor: Boolean(editor),
    backend,
    architecture,
    graphics,
    defines: [...defines].sort(),
  };
}
