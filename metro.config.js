const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname)

// functions/ is the Cloud Functions server (Node 22), not app code.
// Nothing in the app imports it, but blocking it here stops Metro watching
// functions/node_modules and guarantees server code can never reach the bundle.
config.resolver.blockList = [
  ...config.resolver.blockList,
  /\/functions\/.*/,
]

module.exports = withNativeWind(config, { input: './global.css' })