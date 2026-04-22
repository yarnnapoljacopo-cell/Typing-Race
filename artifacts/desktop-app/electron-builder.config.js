module.exports = {
  appId: "com.writingsprint.app",
  productName: "Writing Sprint",
  copyright: "Writing Sprint",
  asar: false,
  directories: {
    output: "release",
  },
  files: [
    "build/**/*",
    "resources/**/*",
    "node_modules/**/*",
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
    icon: "resources/icon.ico",
  },
  mac: {
    target: [{ target: "dmg", arch: ["x64", "arm64"] }],
    icon: "resources/icon.icns",
    category: "public.app-category.productivity",
  },
  linux: {
    target: [{ target: "AppImage", arch: ["x64"] }],
    icon: "resources/icon.png",
    category: "Office",
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
  },
};
