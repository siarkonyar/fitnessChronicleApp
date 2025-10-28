module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Reanimated moved its Babel plugin to the react-native-worklets package.
    // Keep this plugin LAST in the list.
    plugins: ["react-native-worklets/plugin"],
  };
};
