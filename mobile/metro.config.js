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
config.resolver.unstable_conditionNames = ['react-native', 'import', 'require', 'default'];

// Its gRPC entry is built from `.mjs` chunks that import each other by explicit path. Expo's
// default sourceExts does not include `mjs`, so Metro would resolve those files without applying
// the transform — the module loads, every export is undefined, and the first `new` on one fails
// with "undefined cannot be used as a constructor" from somewhere with no stack.
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

module.exports = config;
