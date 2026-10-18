// Save file on disk (in the app's user data folder). Plain Node, so it is easy to test.
const fs = require('node:fs');
const path = require('node:path');

const FILE_NAME = 'neon-dash-save.json';
const MAX_BYTES = 64 * 1024;

function savePath(dir) {
  return path.join(dir, FILE_NAME);
}

/** Returns the saved text, or null if there is no save yet (or it is unreadable). */
function readSave(dir) {
  try {
    const text = fs.readFileSync(savePath(dir), 'utf8');
    return text.length <= MAX_BYTES ? text : null;
  } catch {
    return null;
  }
}

/** Write atomically: write a temp file, then rename, so a crash never leaves half a save. */
function writeSave(dir, text) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) return false;
  try {
    JSON.parse(text); // only accept valid JSON
  } catch {
    return false;
  }
  fs.mkdirSync(dir, { recursive: true });
  const target = savePath(dir);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, target);
  return true;
}

module.exports = { readSave, writeSave, savePath, FILE_NAME };
