const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const projectRootDir = path.resolve(__dirname, '../..');

const nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(projectRootDir, 'node_modules'),
  path.resolve(projectRootDir, 'node_modules', '.pnpm'),
];

const config = {
  watchFolders: [projectRootDir],
  resolver: {
    unstable_enableSymlinks: true,
    unstable_enablePackageExports: true,
    unstable_conditionNames: ['browser', 'require', 'react-native'],
    resolverMainFields: ['react-native', 'browser', 'main'],
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
