// Read-only HTTP audit. This verifies delivery, not PS4 AppCache persistence.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const origin = 'https://monange1.github.io/';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const command = promisify(execFile);
let problems=0;
async function get(url) {
  let error;
  for(let attempt=0;attempt<2;attempt++) {
    try {
      // Windows' native HTTP transport is more reliable here than Node fetch
      // for larger GitHub Pages files on this connection.
      const {stdout}=await command(process.platform==='win32'?'curl.exe':'curl',
        ['--silent','--show-error','--fail','--max-time','25','--dump-header','-','--url',String(url)],
        {encoding:'buffer',maxBuffer:16*1024*1024});
      const split=stdout.indexOf(Buffer.from('\r\n\r\n'));
      if(split<0) throw new Error('HTTP header boundary missing');
      const header=stdout.subarray(0,split).toString();
      return {status:Number(header.match(/^HTTP\/\S+ (\d+)/)?.[1]),type:header.match(/^content-type:\s*(.*)$/im)?.[1].trim()||'',bytes:stdout.subarray(split+4)};
    } catch(e) { error=e; }
  }
  throw error;
}
for(const version of ['672','900','1100','1200']) {
  const base=new URL(version+'/',origin);
  const local=join(root,'.gamezone-runtime/ps4-startup-'+version);
  const page=await get(base);
  const manifestName=page.bytes.toString().match(/manifest="([^"]+)"/)?.[1];
  if(page.status!==200||!manifestName) throw new Error(`${version}: missing entry or manifest`);
  const manifest=await get(new URL(manifestName,base));
  const lines=manifest.bytes.toString().trim().split(/\r?\n/);
  if(manifest.status!==200||!manifest.type.startsWith('text/cache-manifest')||lines[0]!=='CACHE MANIFEST') throw new Error(`${version}: manifest status/MIME/header invalid`);
  let section='CACHE'; const names=[];
  for(let line of lines.slice(1)) {
    line=line.trim(); if(!line||line.startsWith('#'))continue;
    if(line.endsWith(':')) {section=line.slice(0,-1);continue;}
    if(section==='CACHE')names.push(line);
  }
  const failures=[]; let bytes=0;
  // Limit concurrency to avoid GitHub throttling and Wi-Fi saturation.
  for(let index=0;index<names.length;index+=3) {
    await Promise.all(names.slice(index,index+3).map(async name=>{
      try {
        const result=await get(new URL(name,base)); bytes+=result.bytes.length;
        const expected=readFileSync(join(local,name));
        // Git can normalize text line endings without changing functionality.
        const text=/\.(?:html|css|js|mjs|json|appcache|txt)$/.test(name)||name==='LICENSE';
        const normalized=data=>text?Buffer.from(data.toString().replace(/\r\n/g,'\n')):data;
        if(result.status!==200 || hash(normalized(result.bytes))!==hash(normalized(expected))) failures.push(`${name}: HTTP ${result.status} or content differs`);
      } catch(e) { failures.push(`${name}: ${e.message}`); }
    }));
  }
  problems+=failures.length;
  console.log(JSON.stringify({version,manifest:manifestName,mime:manifest.type,files:names.length,bytes,failures}));
}
if(problems) process.exitCode=1;
