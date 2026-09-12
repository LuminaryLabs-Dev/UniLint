import { readBuildSettings, selectScenes } from '../../unity/build-settings.mjs';
export function routeGame(root, options) {
  const settings=readBuildSettings(root);return { settings, scenes:selectScenes(settings, options) };
}
