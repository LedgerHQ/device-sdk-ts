const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

const nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '..', '..', 'node_modules'),
  path.resolve(__dirname, '..', '..', 'node_modules', '.pnpm'),
];

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  projectRoot: __dirname,
  watchFolders: [path.resolve(__dirname, '../../')],
  resolver: {
    unstable_enablePackageExports: true,
    unstable_conditionNames: ['browser', 'react-native', 'import', 'require'],
    resolverMainFields: [
      'browser',
      'react-native',
      'import',
      'require',
      'main',
    ],
    nodeModulesPaths,
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
