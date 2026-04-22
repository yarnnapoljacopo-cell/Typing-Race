const path = require("path");

module.exports = {
  publish: {
    provider: "github",
    owner: "yarnnapoljacopo-cell",
    repo: "Typing-Race",
    releaseType: "draft",
  },
  appId: "com.writingsprint.app",
  productName: "Writing Sprint",
  copyright: "Writing Sprint",
  asar: false,
  icon: path.resolve(__dirname, "resources/icon.png"),
  directories: {
    output: "release",
  },
  files: [
    "build/**/*",
    "package.json",
  ],
  extraResources: [
    {
      from: "src/offline.html",
      to: "offline.html",
    },
  ],
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
    icon: path.resolve(__dirname, "resources/icon.ico"),
  },
  mac: {
    target: [{ target: "dmg", arch: ["x64"] }],
    category: "public.app-category.productivity",
    identity: null,
    icon: path.resolve(__dirname, "resources/icon.png"),
  },
  linux: {
    target: [{ target: "AppImage", arch: ["x64"] }],
    category: "Office",
    icon: path.resolve(__dirname, "resources/icon.png"),
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
  },
};
