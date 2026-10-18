// electron-builder hook: sets the game icon on the exe after packing.
const path = require('node:path');
const { execFileSync } = require('node:child_process');
exports.default = async function (context) {
  const exe = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.exe');
  execFileSync(process.execPath, [path.join(__dirname, 'set-exe-icon.mjs'), exe, 'build/icon.ico'], { stdio: 'inherit' });
};
