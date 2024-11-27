module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    '@babel/plugin-transform-class-static-block',
    ['@babel/plugin-proposal-decorators', {legacy: true}],
    [
      'module-resolver',
      {
        alias: {
          // This needs to be mirrored in tsconfig.json
          _providers: './src/providers',
          _components: './src/components',
          _hooks: './src/hooks',
          _navigators: './src/navigators',
          _reducers: './src/reducers',
          _services: './src/services',
        },
      },
    ],
  ],
};
