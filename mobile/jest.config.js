/**
 * Tests render the real screens and fire their real handlers.
 *
 * This is how the app's behaviour is verified: this environment has no Simulator GUI and no
 * idb_companion, so there is no way to send a touch to a running device. Rendering the component
 * tree and pressing through it is both closer to the code and repeatable, which a hand-driven
 * simulator session is not.
 */
const preset = require('jest-expo/jest-preset');

module.exports = {
  preset: 'jest-expo',
  // The Sui SDK's gRPC entry is built from `.mjs` chunks, which the preset's `\.[jt]sx?$` pattern
  // does not match — so Jest would hand raw ESM to a CommonJS runtime. The same gap Metro had.
  //
  // The preset's own transforms are kept rather than replaced: they are what handle React Native's
  // Flow-typed sources, and dropping them fails on the first `value(id: TimeoutID)` it meets.
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'json', 'node'],
  transform: { ...preset.transform, '^.+\\.mjs$': preset.transform['\\.[jt]sx?$'] },
  setupFilesAfterEnv: ['<rootDir>/test/setup.tsx'],
  testMatch: ['<rootDir>/test/**/*.test.tsx'],
  // The Sui SDK and its dependencies ship ESM, which Jest has to transform rather than skip.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@mysten/.*|@skur/.*|@protobuf-ts/.*|@noble/.*|@scure/.*|valibot|graphql|gql.tada|poseidon-lite))',
  ],
  moduleNameMapper: {
    // The screens import the client for its type and its proxy; tests supply their own data.
    '^../lib/client$': '<rootDir>/test/mocks/client.ts',
    '^../../lib/client$': '<rootDir>/test/mocks/client.ts',
    // @skur/sdk is ESM with an exports map holding only `import`, which Jest's CommonJS resolver
    // does not read. Point at the build output and let Babel transform it like any source file.
    '^@skur/sdk$': '<rootDir>/../sdk/dist/index.js',
    // Babel's helpers are required from the transformed SDK, which sits outside this package and
    // so cannot resolve them on its own.
    '^@babel/runtime/(.*)$': '<rootDir>/node_modules/@babel/runtime/$1',
  },
};
