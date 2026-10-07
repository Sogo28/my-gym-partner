const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// La version web de l'app (`npx expo start --web`) fait tourner SQLite en
// WebAssembly : Metro doit servir ses fichiers `.wasm` comme des ressources.
config.resolver.assetExts.push('wasm');

// Metro compile global.css avec Tailwind et injecte les styles générés.
module.exports = withNativeWind(config, { input: './global.css' });
