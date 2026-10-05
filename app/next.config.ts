import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const here = dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  turbopack: {
    // `@skur/sdk` is a `file:` dependency, so it resolves through a symlink to a sibling
    // directory. Turbopack will not follow a link out of the project unless it knows the
    // workspace root is one level up.
    root: resolve(here, '..'),
  },
};

export default config;
