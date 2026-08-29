const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
const path = require("path");

const config = getDefaultConfig(__dirname)

/**
 * This project's own functions/ directory, as an absolute path with any regex
 * metacharacters escaped.
 *
 * The escape matters because the path contains the user's home directory, which
 * can hold characters like "." or "+" that would otherwise be read as regex
 * syntax rather than as literal text.
 */
const serverDir = path
  .join(__dirname, "functions")
  .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// functions/ is the Cloud Functions server (Node 22), not app code.
// Nothing in the app imports it, but blocking it here stops Metro watching
// functions/node_modules and guarantees server code can never reach the bundle.
//
// Anchored with ^ to this project's functions/ directory. Metro tests these
// patterns against absolute paths, so an unanchored /\/functions\/.*/ also
// matches node_modules/@react-native-firebase/functions and makes the Firebase
// Functions SDK unresolvable.
config.resolver.blockList = [
  ...config.resolver.blockList,
  new RegExp(`^${serverDir}/.*`),
]

module.exports = withNativeWind(config, { input: './global.css' })