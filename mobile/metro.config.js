const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// `@skur/sdk` is a file: dependency, so it resolves through a symlink to a sibling directory.
// Metro has to be told to watch the workspace and to look there for modules, or an edit to the
// SDK is invisible until the bundler is restarted.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// The Sui SDK ships ESM with an exports map and no CommonJS fallback.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'require', 'import', 'default'];

module.exports = config;
