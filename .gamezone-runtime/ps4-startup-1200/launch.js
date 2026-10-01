import { sha256 } from './sha256.js';

const state = document.getElementById('state');
try {
  if (!/PlayStation 4[\\/ ]12\.00(?:\D|$)/.test(navigator.userAgent) || location.search || location.hash) {
    throw new Error('Wrong firmware or forbidden URL override');
  }
  const metadata = await fetch('./integrity.json');
  if (!metadata.ok) throw new Error('Integrity metadata is unavailable');
  const release = await metadata.json();
  if (release.build !== 'GZ12-20261001-1') throw new Error('Mixed starter versions: reconnect and reload');
  const files = ['core.js','mem.js','int64.js','ps4_offsets.js','rpc_worker.js','chain_lapse.js','payload.bin','patches/1200.bin'];
  const verified = {};
  for (let i = 0; i < files.length; i++) {
    const path = files[i], expected = release.files[path];
    state.textContent = 'Verifying offline file ' + (i + 1) + '/' + files.length + ': ' + path;
    const response = await fetch('./' + path);
    if (!response.ok || !expected) throw new Error('Missing required file: ' + path);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== expected.size || sha256(buffer) !== expected.sha256) throw new Error('Damaged or mixed file: ' + path);
    if (path.endsWith('.bin')) verified[path] = new Uint8Array(buffer);
  }
  // These two hashes are also compiled into the loader; metadata cannot select
  // a different firmware patch or arbitrary replacement payload.
  if (sha256(verified['payload.bin'].buffer) !== 'c6329401d1810e16c84e6474ac30977dbdc951987c10cdb559370de7d59db0b0' ||
      sha256(verified['patches/1200.bin'].buffer) !== '87f1d40aea8fbf3adee7b8b5599d90c9d868436c15a498f2dce6bf5d96ae4d27') {
    throw new Error('Firmware payload or patch identity mismatch');
  }
  window.gamezone1200Assets = verified;
  state.textContent = 'Files verified. Starting one 12.00 test attempt. Please wait…';
  await import('./chain_lapse.js');
} catch (error) {
  state.className = 'bad';
  state.textContent = 'STOP: ' + String(error && (error.message || error)) + '. No retry will run automatically.';
}
