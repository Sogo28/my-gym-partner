const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Metro compile global.css avec Tailwind et injecte les styles générés.
module.exports = withNativeWind(config, { input: './global.css' });
