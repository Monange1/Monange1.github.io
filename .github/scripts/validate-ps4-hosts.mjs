import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const hosts = [
  ['9.00', '.gamezone-runtime/ps4-startup-900', 'gamezone.appcache'],
  ['11.00-11.02', '.gamezone-runtime/ps4-startup-1100', 'cache.appcache'],
  ['router', '.gamezone-runtime/ps4-startup-router', 'cache.appcache'],
  ['11.00-13.00-lab', '.gamezone-runtime/ps4-startup-modern', 'cache.appcache'],
];

function fail(message) {
  throw new Error(message);
}

function sha256(relative) {
  return createHash('sha256').update(readFileSync(join(repo, relative))).digest('hex');
}

function cacheEntries(manifestPath) {
  const lines = readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0].trim() !== 'CACHE MANIFEST') fail(`${manifestPath}: missing CACHE MANIFEST header`);
  let section = 'CACHE';
  const result = [];
  for (const raw of lines.slice(1)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^(CACHE|NETWORK|FALLBACK):$/.test(line)) { section = line.slice(0, -1); continue; }
    if (section === 'CACHE') result.push(line);
  }
  return result;
}

for (const [name, relativeRoot, manifestName] of hosts) {
  const root = join(repo, relativeRoot);
  const manifest = join(root, manifestName);
  if (!existsSync(manifest)) fail(`${name}: missing ${manifestName}`);
  for (const entry of cacheEntries(manifest)) {
    if (/\s/.test(entry)) fail(`${name}: cache entry contains whitespace: ${entry}`);
    if (!existsSync(join(root, entry))) fail(`${name}: cache entry is missing: ${entry}`);
  }
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  if (/(?:src|href)=["']https?:\/\//i.test(html)) fail(`${name}: hosted entry page depends on an external origin`);
}

const expected = new Map([
  ['.gamezone-runtime/ps4-startup-900/payload.bin', 'c6329401d1810e16c84e6474ac30977dbdc951987c10cdb559370de7d59db0b0'],
  ['.gamezone-runtime/ps4-startup-1100/src/payload.bin', 'c6329401d1810e16c84e6474ac30977dbdc951987c10cdb559370de7d59db0b0'],
  ['.gamezone-runtime/ps4-startup-modern/payload.bin', 'c6329401d1810e16c84e6474ac30977dbdc951987c10cdb559370de7d59db0b0'],
  ['.gamezone-runtime/ps4-startup-900/goldhen-2.4b18-maintenance.bin', 'eb9fee5e9e3618c0a144a6fc6b8fc1ec7e89cf06483ad64ae7c1085efc9525a3'],
  ['.gamezone-runtime/ps4-startup-1100/src/goldhen-2.4b18-maintenance.bin', 'eb9fee5e9e3618c0a144a6fc6b8fc1ec7e89cf06483ad64ae7c1085efc9525a3'],
  ['.gamezone-runtime/ps4-startup-modern/patches/1100.bin', '15497a2b748dafd49bfb89c51ed048d0c5ba3c5092c5254da46dd4443f80983b'],
  ['.gamezone-runtime/ps4-startup-modern/patches/1150.bin', 'd4e3a514e462b973842e634eba6c90136dbfd864a208f8c39c229055e5f2e1f9'],
  ['.gamezone-runtime/ps4-startup-modern/patches/1200.bin', '87f1d40aea8fbf3adee7b8b5599d90c9d868436c15a498f2dce6bf5d96ae4d27'],
  ['.gamezone-runtime/ps4-startup-modern/patches/1250.bin', '5baaf0bb2663064db1eb1bfd976bc3aa5087ab7f0963648cb6fcb216adce714d'],
  ['.gamezone-runtime/ps4-startup-modern/patches/1300.bin', 'be70930d96c40b8d7ba03a57e2ea5c834b606fb74ed118756b4dea7fffaa1d57'],
]);

for (const [relative, hash] of expected) {
  if (sha256(relative) !== hash) fail(`${relative}: integrity hash changed`);
}

const rootIndex = readFileSync(join(repo, '.gamezone-runtime/ps4-startup-900/index.html'), 'utf8');
const rootCompat = readFileSync(join(repo, '.gamezone-runtime/ps4-startup-900/start.html'), 'utf8');
const elevenScript = readFileSync(join(repo, '.gamezone-runtime/ps4-startup-1100/includes/script.js'), 'utf8');
const modernLapse = readFileSync(join(repo, '.gamezone-runtime/ps4-startup-modern/run_lapse.html'), 'utf8');
const modernPoops = readFileSync(join(repo, '.gamezone-runtime/ps4-startup-modern/run_poops.html'), 'utf8');

if (!rootIndex.includes('button id="start" type="button" disabled')) fail('9.00: manual start button is not fail-closed');
if (rootCompat.includes("import('./alert.mjs')")) fail('9.00: compatibility URL can still execute the exploit');
if (elevenScript.includes('countdown(') || elevenScript.includes('checkbox.checked = true')) fail('11.00: automatic startup returned');
if (!modernLapse.includes('gamezone-launch-ticket') || !modernPoops.includes('gamezone-launch-ticket')) fail('modern host: protected launch ticket is missing');

console.log('All GameZone firmware hosts passed cache, origin, safety, and integrity checks.');
