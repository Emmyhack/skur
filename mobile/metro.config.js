// Shares the web app's pure library (types, risk engine, policy rules, contract reads, ABI, chain config)
// with the mobile app without publishing a package: ../web/src is watched and resolved as "@web/*".
// Bare imports made from those shared files (viem, ...) resolve from mobile/node_modules so the app holds
// one copy of each dependency; everything else resolves normally.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const root = __dirname;
const webSrc = path.resolve(root, "../web/src");
const config = getDefaultConfig(root);
config.watchFolders = [webSrc];
config.resolver.extraNodeModules = { "@web": webSrc };
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromShared = context.originModulePath.startsWith(webSrc);
  const bare = !moduleName.startsWith(".") && !moduleName.startsWith("/") && !moduleName.startsWith("@web");
  const ctx = fromShared && bare ? { ...context, originModulePath: path.join(root, "index.ts") } : context;
  return (defaultResolve ?? ctx.resolveRequest)(ctx, moduleName, platform);
};
module.exports = config;
