const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Allow Drizzle SQL migrations to be bundled.
config.resolver.sourceExts.push('sql');

module.exports = config;
