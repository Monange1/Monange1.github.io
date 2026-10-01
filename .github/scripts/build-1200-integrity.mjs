import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../.gamezone-runtime/ps4-startup-1200');
const names = ['core.js','mem.js','int64.js','ps4_offsets.js','rpc_worker.js','chain_lapse.js','payload.bin','patches/1200.bin'];
const files = {};
for (const name of names) {
  const path = join(root, name);
  if (name.endsWith('.js')) writeFileSync(path, readFileSync(path, 'utf8').replace(/\r\n/g, '\n'));
  const buffer = readFileSync(path);
  files[name] = { size:buffer.length, sha256:createHash('sha256').update(buffer).digest('hex') };
}
writeFileSync(join(root, 'integrity.json'), JSON.stringify({
  build:'GZ12-20261001-1', firmware:'12.00', qualification:'TEST_ONLY_NOT_HARDWARE_VERIFIED',
  upstream:'https://github.com/rawgame4/rawgame4.github.io/tree/d297459c793b08346409206c537acf40cbcb926f',
  payload:'GoldHEN 2.4b18.10; unchanged upstream payload.bin',
  evidence:'Upstream README claims tested 12.00; its offset table says UNTESTED-on-hardware. No GameZone hardware certification.',
  changes:['Exact firmware and protected manual launch','Complete offline package','SHA-256 preflight before primitive','One primitive attempt','No forced unpatched payload','No network logging'],
  researchedSources:[
    'https://github.com/rawgame4/rawgame4.github.io/blob/d297459c793b08346409206c537acf40cbcb926f/ps4_offsets.js',
    'https://github.com/GoldHEN/GoldHEN/issues/334',
    'https://ko-fi.com/s/969702e773',
    'https://webkitty.arabpixel.net/',
  ], files,
}, null, 2) + '\n');
console.log('12.00 integrity metadata generated.');
