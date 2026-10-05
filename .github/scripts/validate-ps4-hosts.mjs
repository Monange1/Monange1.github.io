import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const hosts = [
  ['6.72', '.gamezone-runtime/ps4-startup-672', 'cache.appcache'],
  ['9.00', '.gamezone-runtime/ps4-startup-900', 'gamezone-v12.appcache'],
  ['11.00-11.02', '.gamezone-runtime/ps4-startup-1100', 'cache.appcache'],
  ['12.00-test', '.gamezone-runtime/ps4-startup-1200', 'cache.appcache'],
  ['router', '.gamezone-runtime/ps4-startup-router', 'cache.appcache'],
  ['11.00-13.00-lab', '.gamezone-runtime/ps4-startup-modern', 'cache.appcache'],
];

function fail(message) {
  throw new Error(message);
}

function sha256(relative) {
  const contents = readFileSync(join(repo, relative));
  const stable = relative.endsWith('exploit-engine.js')
    ? Buffer.from(contents.toString('utf8').replace(/\r\n/g, '\n'))
    : contents;
  return createHash('sha256').update(stable).digest('hex');
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
  ['.gamezone-runtime/ps4-startup-672/goldhen-2.4b18.12.bin', 'df3f27c1b35bc7c40e3a08caab948930914dc7d0301a73b68945cf6ffe40ea12'],
  ['.gamezone-runtime/ps4-startup-672/exploit-engine.js', '2d5b2d5fdf721409da981a1c21974ad6db002f5336bcbdb76049d060fb24f00b'],
  ['.gamezone-runtime/ps4-startup-900/payload.bin', 'c6329401d1810e16c84e6474ac30977dbdc951987c10cdb559370de7d59db0b0'],
  ['.gamezone-runtime/ps4-startup-900/kpatch/900.elf', '56183734c0b4c694344971479c3e070a6a6f0d13f783804b1610218314a7ae33'],
  ['.gamezone-runtime/ps4-startup-900/aio_patches.bin', 'edf729eb5fe532b679cf2f7fb7c9af852d83199ad6d1364d40fb68b9983ac1e5'],
  ['.gamezone-runtime/ps4-startup-1100/src/payload.bin', 'c6329401d1810e16c84e6474ac30977dbdc951987c10cdb559370de7d59db0b0'],
  ['.gamezone-runtime/ps4-startup-modern/payload.bin', 'c6329401d1810e16c84e6474ac30977dbdc951987c10cdb559370de7d59db0b0'],
  ['.gamezone-runtime/ps4-startup-1200/payload.bin', 'c6329401d1810e16c84e6474ac30977dbdc951987c10cdb559370de7d59db0b0'],
  ['.gamezone-runtime/ps4-startup-1200/patches/1200.bin', '87f1d40aea8fbf3adee7b8b5599d90c9d868436c15a498f2dce6bf5d96ae4d27'],
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
const sixIndex = readFileSync(join(repo, '.gamezone-runtime/ps4-startup-672/index.html'), 'utf8');
const sixScript = readFileSync(join(repo, '.gamezone-runtime/ps4-startup-672/includes/script.js'), 'utf8');
const elevenScript = readFileSync(join(repo, '.gamezone-runtime/ps4-startup-1100/includes/script.js'), 'utf8');
const nineManifest = readFileSync(join(repo, '.gamezone-runtime/ps4-startup-900/gamezone-v12.appcache'), 'utf8');
const nineLapse = readFileSync(join(repo, '.gamezone-runtime/ps4-startup-900/lapse.mjs'), 'utf8');
const modernLapse = readFileSync(join(repo, '.gamezone-runtime/ps4-startup-modern/run_lapse.html'), 'utf8');
const modernPoops = readFileSync(join(repo, '.gamezone-runtime/ps4-startup-modern/run_poops.html'), 'utf8');

if (!rootIndex.includes('button id="start" type="button" disabled')) fail('9.00: manual start button is not fail-closed');
if (!rootIndex.includes('manifest="gamezone-v12.appcache?')) fail('9.00: entry page does not use the current isolated offline cache');
if (rootCompat.includes("import('./alert.mjs')")) fail('9.00: compatibility URL can still execute the exploit');
if (!nineManifest.includes('kpatch/900.elf')) fail('9.00: kernel patch is missing from the offline cache');
if (!nineManifest.includes('aio_patches.bin')) fail('9.00: AIO stability patch is missing from the offline cache');
if (nineLapse.includes("req.open('GET','payload.bin')") || nineLapse.includes('await fetch(url)')) fail('9.00: exploit performs a network load after kernel work starts');
if (!rootIndex.includes('window.gamezonePayloadBuffer = binary') || !rootIndex.includes('window.gamezoneKpatchBuffer = patchBinary')) fail('9.00: verified exploit assets are not preloaded');
if (!rootIndex.includes('window.gamezoneAioBuffer = aioBinary')) fail('9.00: AIO stability patch is not preloaded');
if (!nineLapse.includes("runVerifiedPayload(window.gamezoneAioBuffer, 'AIO stability patch')")) fail('9.00: AIO stability patch is not executed before GoldHEN');
if (!sixIndex.includes('button id="start" type="button" disabled')) fail('6.72: manual start button is not fail-closed');
if (/<script[^>]+src=["']exploit-engine\.js/.test(sixIndex)) fail('6.72: engine can execute top-level setup before manual consent');
if (!sixScript.includes('engine.src = "exploit-engine.js"')) fail('6.72: manual engine delivery is missing');
if (!sixIndex.includes('manifest="cache.appcache?v=20261003-2-retro"')) fail('6.72: entry page does not use the current isolated offline cache');
if (!sixScript.includes('firmware() === "6.72"') || sixScript.includes('setTimeout(jailbreak')) fail('6.72: exact firmware lock or manual start guarantee is missing');
if (/GamerHack|Main Payloads|pl_FTP|load_goldhen/i.test(sixIndex)) fail('6.72: legacy multi-payload menu returned');
if (elevenScript.includes('countdown(') || elevenScript.includes('checkbox.checked = true')) fail('11.00: automatic startup returned');
if (!elevenScript.includes('if (cache.status === cache.IDLE)') || !elevenScript.includes('Offline cache loaded')) fail('11.00: installed offline cache is not recovered after a failed WAN refresh');
if (!modernLapse.includes('gamezone-launch-ticket') || !modernPoops.includes('gamezone-launch-ticket')) fail('modern host: protected launch ticket is missing');

console.log('All GameZone firmware hosts passed cache, origin, safety, and integrity checks.');

const twelveRoot = '.gamezone-runtime/ps4-startup-1200';
const twelveIntegrity = JSON.parse(readFileSync(join(repo,twelveRoot,'integrity.json'),'utf8'));
for (const [path, expectedFile] of Object.entries(twelveIntegrity.files)) {
  const buffer = readFileSync(join(repo,twelveRoot,path));
  if (buffer.length !== expectedFile.size || sha256(`${twelveRoot}/${path}`) !== expectedFile.sha256) fail(`12.00: stale integrity metadata for ${path}`);
  if (!cacheEntries(join(repo,twelveRoot,'cache.appcache')).includes(path)) fail(`12.00: ${path} is missing from the offline package`);
}
const twelveChain = readFileSync(join(repo,twelveRoot,'chain_lapse.js'),'utf8');
if (!twelveChain.includes('maxAttempts: 1,') || twelveChain.includes('await fetch(') || twelveChain.includes('kpatched || params.get("payload")')) fail('12.00: unsafe retry/network/payload override returned');
if (twelveIntegrity.qualification !== 'TEST_ONLY_NOT_HARDWARE_VERIFIED') fail('12.00: unverified build was relabeled as production');
console.log('Dedicated 12.00 test package passed integrity and fail-closed checks.');

// AppCache URLs are exact: core.js?v=10 is not the cached core.js. A second
// URL also instantiates a second module, splitting the primitive's state.
const twelveCached = new Set(cacheEntries(join(repo,twelveRoot,'cache.appcache')));
for (const file of twelveCached) {
  if (!file.endsWith('.js')) continue;
  const code = readFileSync(join(repo,twelveRoot,file),'utf8');
  const dependencies = [...code.matchAll(/(?:^[ \t]*import\s+(?:[\w*\s{},]+?\s+from\s*)?|\bimport\s*\(\s*|\bnew\s+Worker\(\s*)["']([^"']+)["']/gm)];
  for (const [,specifier] of dependencies) {
    const url = new URL(specifier,new URL(file,'https://offline.invalid/'));
    if (url.origin !== 'https://offline.invalid' || url.search || url.hash || !twelveCached.has(url.pathname.slice(1))) {
      fail(`12.00: ${file} requests an uncached or noncanonical dependency: ${specifier}`);
    }
  }
}
console.log('12.00 module and worker dependency URLs are canonical and fully cached.');
