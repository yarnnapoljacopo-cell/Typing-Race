module.exports = {
  appId: "com.writingsprint.app",
  productName: "Writing Sprint",
  directories: { output: "dist" },
  asar: false,
  files: ["build/**/*", "node_modules/**/*", "package.json"],
  linux: { target: [{ target: "dir" }] },
};
