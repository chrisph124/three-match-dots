// Metro config: extend the Expo defaults so Rive `.riv` animation files are
// bundled as assets (Metro does not treat `.riv` as an asset out of the box).
// Keep this the ONLY reason this file exists — reset to the Expo default if the
// Rive title is ever removed.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('riv');

module.exports = config;
