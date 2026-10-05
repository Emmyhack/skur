import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The SDK is consumed as built JavaScript, but keeping it transpiled here means a change in
  // sdk/src shows up on the next dev reload instead of needing a rebuild first.
  transpilePackages: ['@skur/sdk'],
  typedRoutes: true,
};

export default config;
