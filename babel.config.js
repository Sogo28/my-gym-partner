module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // jsxImportSource : c'est ce qui permet à className de fonctionner
      // sur les composants React Native.
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
