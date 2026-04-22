const path = require("path");

const root = __dirname;

module.exports = {
  appId: "com.writingsprint.app",
  productName: "Writing Sprint",
  copyright: "Writing Sprint",
  asar: false,
  icon: path.resolve(root, "resources/icon.png"),
  directories: {
    output: path.resolve(root, "release"),
    app: root,
  },
  files: [
    "build/**/*",
    "node_modules/**/*",
    "package.json",
  ],
  extraResources: [
    {
      from: path.resolve(root, "src/offline.html"),
      to: "offline.html",
    },
  ],
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
  },
  mac: {
    target: [{ target: "dmg", arch: ["x64", "arm64"] }],
    category: "public.app-category.productivity",
  },
  linux: {
    target: [{ target: "AppImage", arch: ["x64"] }],
    category: "Office",
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
  },
};
