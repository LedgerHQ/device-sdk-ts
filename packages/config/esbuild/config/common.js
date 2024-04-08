const buildConfig = (config, packageJson) => ({
  sourcemap: true,
  treeShaking: true,
  color: true,
  bundle: true,
  minify: true,
  ...config,
  plugins: [...(config.plugins || [])],
  external: Object.keys(packageJson.dependencies || {}).concat(
    Object.keys(packageJson.peerDependencies || {})
  ),
});

module.exports = buildConfig;
