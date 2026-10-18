// Puts build/icon.ico into the Windows exe (works on Linux, no wine needed).
import fs from 'node:fs';
import * as ResEdit from 'resedit';

const exePath = process.argv[2] || 'release/win-unpacked/Neon Dash.exe';
const icoPath = process.argv[3] || 'build/icon.ico';

const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath));
const res = ResEdit.NtExecutableResource.from(exe);
const icon = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath));
const group = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)[0];
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
  res.entries, group.id, group.lang, icon.icons.map((i) => i.data));
res.outputResource(exe);
fs.writeFileSync(exePath, Buffer.from(exe.generate()));
console.log('Icon set on', exePath, 'with', icon.icons.length, 'sizes');
