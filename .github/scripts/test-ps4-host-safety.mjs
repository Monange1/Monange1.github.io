import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createHash, randomBytes } from 'node:crypto';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function assert(value, message) {
  if (!value) throw new Error(message);
}

function inlineScripts(relative) {
  const html = readFileSync(join(repo, relative), 'utf8');
  return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim()).filter(Boolean);
}

function environment(userAgent, initial = {}) {
  const elements = new Map();
  const storage = new Map(initial.storage || []);
  const appended = [];
  function element(id) {
    if (!elements.has(id)) {
      const listeners = {};
      elements.set(id, {
        id, disabled:false, hidden:false, checked:false, textContent:'', className:'', value:'',
        addEventListener(type, handler) { listeners[type] = handler; },
        click() { if (listeners.click) listeners.click({ target:this }); },
        change(value) { this.value=value; if (listeners.change) listeners.change({ target:this }); },
      });
    }
    return elements.get(id);
  }
  const cacheListeners = {};
  const applicationCache = {
    UNCACHED:0, IDLE:1, CHECKING:2, DOWNLOADING:3, UPDATEREADY:4, OBSOLETE:5,
    status: initial.cacheStatus ?? 1,
    addEventListener(type, handler) { cacheListeners[type] = handler; },
    swapCache() {},
    abort() { this.abortCalls = (this.abortCalls || 0) + 1; this.status = initial.abortStatus ?? 1; },
    update() { this.updateCalls = (this.updateCalls || 0) + 1; this.status = 2; },
  };
  const location = { href:'', pathname:initial.pathname||'', search:initial.search||'', hash:initial.hash||'', replace(value) { this.href=value; } };
  const document = {
    getElementById: element,
    querySelector: element,
    createElement() { return { type:'', src:'', textContent:'' }; },
    body: { appendChild(value) { appended.push(value); } },
  };
  const context = {
    console, document, navigator:{ userAgent, onLine:true }, location,
    applicationCache, sessionStorage:{
      setItem(key,value){ storage.set(key,String(value)); },
      getItem(key){ return storage.has(key)?storage.get(key):null; },
      removeItem(key){ storage.delete(key); },
    },
    setTimeout(handler){ handler(); return 1; }, clearInterval(){}, setInterval(){ return 1; },
    fetch(){ initial.fetches=(initial.fetches||0)+1; return Promise.reject(new Error('unexpected fetch')); },
    Date, JSON, Math, Uint32Array, URLSearchParams,
  };
  context.localStorage = context.sessionStorage;
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  return { context, element, appended, storage, location, applicationCache, cacheListeners };
}

function run(code, env, name) {
  new vm.Script(code, { filename:name, importModuleDynamically: () => Promise.reject(new Error('unexpected import')) }).runInContext(env.context);
}

function modern(firmware) {
  const env = environment(`Mozilla/5.0 (PlayStation 4/${firmware}) AppleWebKit`);
  run(inlineScripts('.gamezone-runtime/ps4-startup-modern/index.html')[0], env, 'modern-index.js');
  return env;
}

let env = modern('11.50');
assert(env.element('start').disabled === false, '11.50 should become manually startable after cache readiness');
assert(env.location.href === '' && env.storage.size === 0, '11.50 started without a button press');
env.element('start').click();
assert(env.location.href === 'run_lapse.html', '11.50 did not select Lapse after the button press');
assert(JSON.parse(env.storage.get('gamezone-launch-ticket')).firmware === '11.50', '11.50 launch ticket is missing');

env = modern('12.02');
env.element('start').click();
assert(env.location.href === '' && env.storage.size === 0, '12.02 skipped its test-only acknowledgement');
env.element('start').click();
assert(env.location.href === 'run_lapse.html', '12.02 did not launch after two deliberate presses');

env = modern('11.52');
assert(env.element('start').disabled === true && env.location.href === '', 'unknown nearby firmware did not fail closed');

const routerScript = inlineScripts('.gamezone-runtime/ps4-startup-router/index.html')[0];
const firmwareRoutes = new Map([
  ['6.72',  ['/672/', '/672/']],
  ['9.00',  ['/900/', '/ps4-host/900/']],
  ['11.00', ['/1100/', '/1100/']],
  ['11.02', ['/1100/', '/1100/']],
  ['11.50', ['/modern/', '/modern/']],
  ['12.00', ['/1200/', '/ps4-host/1200/']],
  ['12.02', ['/modern/', '/modern/']],
  ['12.50', ['/modern/', '/modern/']],
  ['12.52', ['/modern/', '/modern/']],
  ['13.00', ['/modern/', '/modern/']],
]);
for (const [firmware, [publicTarget, localTarget]] of firmwareRoutes) {
  env = environment(`Mozilla/5.0 (PlayStation 4/${firmware}) AppleWebKit`, { pathname:'/start/' });
  run(routerScript, env, `public-router-${firmware}.js`);
  assert(env.location.href === publicTarget, `public router selected the wrong ${firmware} starter`);
  assert(env.storage.size === 0, `public ${firmware} handoff created an exploit launch ticket`);

  env = environment(`Mozilla/5.0 (PlayStation 4/${firmware}) AppleWebKit`, { pathname:'/ps4-host/start/' });
  run(routerScript, env, `local-router-${firmware}.js`);
  assert(env.location.href === localTarget, `local router selected the wrong ${firmware} starter`);
  assert(env.storage.size === 0, `local ${firmware} handoff created an exploit launch ticket`);
}

env = environment('Mozilla/5.0 (PlayStation 4/6.72) AppleWebKit', { pathname:'/start' });
run(routerScript, env, 'public-router-no-trailing-slash-672.js');
assert(env.location.href === '/672/', 'public /start without a trailing slash did not select the 6.72 host');

env = environment('Mozilla/5.0 (PlayStation 4/9.01) AppleWebKit', { pathname:'/ps4-host/start/' });
run(routerScript, env, 'unknown-router.js');
assert(env.location.href === '' && env.element('open').disabled === true, 'unknown firmware did not fail closed in the router');

env = environment('Mozilla/5.0 (PlayStation 4/11.50) AppleWebKit');
run(inlineScripts('.gamezone-runtime/ps4-startup-modern/run_lapse.html')[0], env, 'lapse-guard.js');
assert(env.appended.length === 0 && env.element('state').textContent.startsWith('BLOCKED'), 'direct Lapse URL bypassed the launch ticket');

const ticket = JSON.stringify({ firmware:'11.50', chain:'lapse', issuedAt:Date.now() });
env = environment('Mozilla/5.0 (PlayStation 4/11.50) AppleWebKit', { storage:[['gamezone-launch-ticket',ticket]] });
run(inlineScripts('.gamezone-runtime/ps4-startup-modern/run_lapse.html')[0], env, 'lapse-ticket.js');
assert(env.appended.length === 1 && env.appended[0].src === './chain_lapse.js', 'valid Lapse ticket did not start exactly one chain');
assert(!env.storage.has('gamezone-launch-ticket'), 'launch ticket was not consumed');

let calls = 0;
env = environment('Mozilla/5.0 (PlayStation 4/6.72) AppleWebKit');
env.context.jailbreak = () => { calls += 1; };
run(readFileSync(join(repo, '.gamezone-runtime/ps4-startup-672/includes/script.js'),'utf8'), env, 'six.js');
assert(calls === 0 && env.element('start').disabled === false, '6.72 auto-started or stayed unavailable');
env.element('start').click();
env.element('start').click();
assert(calls === 0 && env.appended.length === 1 && env.appended[0].src === 'exploit-engine.js', '6.72 engine was not loaded only after one manual press');
env.appended[0].onload();
assert(calls === 1 && env.context.PLfile === 'goldhen-2.4b18.12.bin', '6.72 did not enforce one exact payload attempt');

calls = 0;
env = environment('Mozilla/5.0 (PlayStation 4/6.71) AppleWebKit');
env.context.jailbreak = () => { calls += 1; };
run(readFileSync(join(repo, '.gamezone-runtime/ps4-startup-672/includes/script.js'),'utf8'), env, 'six-wrong-firmware.js');
env.element('start').click();
assert(calls === 0 && env.element('start').disabled === true, '6.72 host did not fail closed on nearby firmware');

calls = 0;
env = environment('Mozilla/5.0 (PlayStation 4/11.00) AppleWebKit');
env.context.doJb = () => { calls += 1; };
run(readFileSync(join(repo, '.gamezone-runtime/ps4-startup-1100/includes/script.js'),'utf8'), env, 'eleven.js');
assert(calls === 0 && env.element('jeilbrek').disabled === false, '11.00 auto-started or stayed unavailable');
env.element('jeilbrek').click();
env.element('jeilbrek').click();
assert(calls === 1 && env.context.payloadPath === 'src/payload.bin', '11.00 did not enforce one managed attempt');

calls = 0;
env = environment('Mozilla/5.0 (PlayStation 4/11.00) AppleWebKit');
env.context.doJb = () => { calls += 1; };
run(readFileSync(join(repo, '.gamezone-runtime/ps4-startup-1100/includes/script.js'),'utf8'), env, 'eleven-maintenance.js');
env.element('maintenance').click();
assert(calls === 1 && env.context.payloadPath.endsWith('goldhen-2.4b18-maintenance.bin'), '11.00 maintenance mode did not select the no-AutoRun payload');

calls = 0;
env = environment('Mozilla/5.0 (PlayStation 4/11.00) AppleWebKit', { cacheStatus:2 });
env.context.doJb = () => { calls += 1; };
run(readFileSync(join(repo, '.gamezone-runtime/ps4-startup-1100/includes/script.js'),'utf8'), env, 'eleven-offline-refresh.js');
assert(env.element('jeilbrek').disabled === true, '11.00 enabled before its cache check completed');
env.applicationCache.status = env.applicationCache.IDLE;
env.cacheListeners.error();
assert(env.element('jeilbrek').disabled === false, '11.00 rejected an installed cache after an offline manifest refresh failed');
assert(env.element('status').textContent.startsWith('Offline cache loaded'), '11.00 did not explain that its installed offline cache was used');

calls = 0;
env = environment('Mozilla/5.0 (PlayStation 4/11.00) AppleWebKit', { cacheStatus:2 });
env.context.doJb = () => { calls += 1; };
run(readFileSync(join(repo, '.gamezone-runtime/ps4-startup-1100/includes/script.js'),'utf8'), env, 'eleven-uncached-error.js');
env.applicationCache.status = env.applicationCache.UNCACHED;
env.cacheListeners.error();
assert(env.element('jeilbrek').disabled === true && calls === 0, '11.00 enabled without an installed offline cache');

env = environment('Mozilla/5.0 (PlayStation 4/9.00) AppleWebKit');
const rootScript = inlineScripts('.gamezone-runtime/ps4-startup-900/index.html')[0];
run(rootScript, env, 'nine.js');
assert((env.context.fetches||0) === 0 && env.element('start').disabled === false, '9.00 performed work before a button press');

env = environment('Mozilla/5.0 (PlayStation 4/9.00) AppleWebKit', { cacheStatus:2 });
env.element('start').disabled = true;
env.element('maintenance').disabled = true;
run(rootScript, env, 'nine-offline-refresh.js');
assert(env.element('start').disabled === true, '9.00 enabled before its cache check completed');
env.applicationCache.status = env.applicationCache.IDLE;
env.cacheListeners.error();
assert(env.element('start').disabled === false, '9.00 rejected an installed cache after an offline manifest refresh failed');
assert(env.element('status').textContent.startsWith('Offline cache loaded'), '9.00 did not explain that its installed offline cache was used');

env = environment('Mozilla/5.0 (PlayStation 4/9.00) AppleWebKit', { cacheStatus:2 });
env.element('start').disabled = true;
env.element('maintenance').disabled = true;
run(rootScript, env, 'nine-uncached-error.js');
env.applicationCache.status = env.applicationCache.UNCACHED;
env.cacheListeners.error();
assert(env.element('start').disabled === true, '9.00 enabled without an installed offline cache');

for (const cacheStatus of [2, 3]) {
  for (const online of [true, false]) {
    env = environment('PlayStation 4/9.00', { cacheStatus, storage:[['gamezone-900-installed-cache','installed']] });
    env.context.navigator.onLine = online;
    run(rootScript, env, 'nine-installed-no-wan.js');
    assert(env.applicationCache.abortCalls === 1 && !env.element('start').disabled,
      '9.00 saved launch waited for WAN during optional refresh');
    assert(env.element('status').textContent.includes('No Wi-Fi'), '9.00 did not explain offline readiness');
    assert(!env.context.fetches && !env.appended.length, 'offline readiness triggered exploit or network fetch');
  }
}
env = environment('PlayStation 4/9.00', { cacheStatus:2, abortStatus:0, storage:[['gamezone-900-installed-cache','installed']] });
run(rootScript, env, 'nine-deleted-cache-receipt.js');
assert(env.element('start').disabled, '9.00 trusted stale storage after actual cache deletion');
env = environment('PlayStation 4/9.00', { cacheStatus:3 });
run(rootScript, env, 'nine-first-install.js');
assert(!env.applicationCache.abortCalls && env.element('start').disabled, '9.00 aborted its first offline install');
env.applicationCache.status = 1;
env.cacheListeners.cached();
assert(env.storage.get('gamezone-900-installed-cache') === 'installed' && !env.element('start').disabled,
  '9.00 first complete save did not become offline-ready');
env.element('update-cache').click();
assert(env.applicationCache.updateCalls === 1 && env.element('start').disabled, 'explicit offline update did not wait for completion');
env.cacheListeners.checking();
assert(!env.applicationCache.abortCalls, 'explicit update was cancelled as an optional refresh');
env.applicationCache.status = 1;
env.cacheListeners.error();
assert(!env.element('start').disabled, 'failed optional update prevented saved launch');

console.log('PS4 host safety state tests passed.');

const twelveScript = inlineScripts('.gamezone-runtime/ps4-startup-1200/index.html')[0];
const twelveGuard = inlineScripts('.gamezone-runtime/ps4-startup-1200/run_lapse.html')[0];
function twelve(firmware='12.00', initial={}) {
  const result = environment(`Mozilla/5.0 (PlayStation 4/${firmware}) AppleWebKit/605.1.15`, initial);
  run(twelveScript,result,'twelve-index.js'); return result;
}
for (const firmware of ['9.00','11.00','12.02','12.000','12.50','13.00']) {
  env = twelve(firmware); env.element('start').click(); env.element('start').click();
  assert(env.element('start').disabled && !env.location.href && env.storage.size===0, `12.00 accepted wrong firmware ${firmware}`);
}
env = twelve();
assert(!env.element('start').disabled && !env.location.href && env.storage.size===0,'12.00 started without a deliberate press');
env.element('start').click();
assert(!env.location.href && env.storage.size===0,'12.00 skipped risk acknowledgement');
env.element('start').click(); env.element('start').click();
assert(env.location.href==='run_lapse.html' && env.element('start').disabled,'12.00 failed protected single launch');
const twelveTicket=env.storage.get('gamezone-1200-launch');
env = environment('PlayStation 4/12.00',{storage:[['gamezone-1200-launch',twelveTicket]]});
run(twelveGuard,env,'twelve-guard.js');
assert(env.appended.length===1 && env.appended[0].src==='./launch.js' && env.storage.size===0,'12.00 valid ticket was not consumed for preflight');
run(twelveGuard,env,'twelve-guard-reuse.js');
assert(env.appended.length===1,'12.00 launch ticket could be reused');
for (const delta of [-61000, 30000]) {
  const invalid=JSON.stringify({build:'GZ12-20261001-1',firmware:'12.00',issuedAt:Date.now()+delta});
  env=environment('PlayStation 4/12.00',{storage:[['gamezone-1200-launch',invalid]]});
  run(twelveGuard,env,'twelve-expired-ticket.js');
  assert(env.appended.length===0,'12.00 accepted expired or future ticket');
}
env=environment('PlayStation 4/12.00'); run(twelveGuard,env,'twelve-direct-url.js');
assert(env.appended.length===0,'12.00 direct launch URL bypassed manual consent');
for (const initial of [{search:'?payload=1'},{search:'?bug=poops'},{hash:'#run'}]) {
  env=twelve('12.00',initial); env.element('start').click(); env.element('start').click();
  assert(!env.location.href && env.element('start').disabled,'12.00 accepted URL override');
  env=environment('PlayStation 4/12.00',{...initial,storage:[['gamezone-1200-launch',twelveTicket]]});
  run(twelveGuard,env,'twelve-query-guard.js');
  assert(env.appended.length===0,'12.00 internal page accepted URL override');
}
env=twelve('12.00',{cacheStatus:2});
assert(env.element('start').disabled,'12.00 enabled while initial cache was checking');
env.applicationCache.status=1; env.cacheListeners.error();
assert(!env.element('start').disabled,'12.00 rejected installed offline cache when WAN check failed');
env=twelve('12.00',{cacheStatus:0}); env.context.navigator.onLine=false; env.cacheListeners.error();
assert(env.element('start').disabled,'12.00 assumed disconnected means cached');
env=twelve('12.00',{cacheStatus:4});
assert(env.element('start').disabled,'12.00 started mixed cache version without reloading');
console.log('Dedicated 12.00 firmware, consent, ticket, override, and offline-state tests passed.');

const twelveRoot=join(repo,'.gamezone-runtime/ps4-startup-1200');
const digestCode=readFileSync(join(twelveRoot,'sha256.js'),'utf8').replace('export function sha256','function sha256');
const digestEnv=environment('desktop');
run(digestCode,digestEnv,'twelve-sha256.js');
for (const size of [0,1,3,55,56,63,64,65,127,632,4096,290016]) {
  const data=randomBytes(size);
  const buffer=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  assert(digestEnv.context.sha256(buffer)===createHash('sha256').update(data).digest('hex'),`12.00 SHA-256 failed at ${size} bytes`);
}

// Run only delivery preflight, replacing the final exploit import with a spy.
// No kernel/userland exploit code executes in these desktop tests.
const delivery=readFileSync(join(twelveRoot,'launch.js'),'utf8')
  .replace("import { sha256 } from './sha256.js';",'')
  .replace("await import('./chain_lapse.js');",'window.testLaunchCalls++;');
async function preflight(alter) {
  const result=environment('PlayStation 4/12.00');
  result.context.sha256=digestEnv.context.sha256;
  result.context.testLaunchCalls=0;
  const metadata=JSON.parse(readFileSync(join(twelveRoot,'integrity.json'),'utf8'));
  result.context.fetch=async function(url) {
    const path=url.replace(/^\.\//,'');
    if(path==='integrity.json') return {ok:true,json:async()=>metadata};
    const data=readFileSync(join(twelveRoot,path));
    const response={ok:true,buffer:data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};
    if(alter) alter(path,response,metadata);
    return {ok:response.ok,arrayBuffer:async()=>response.buffer};
  };
  await new vm.Script('(async function(){'+delivery+'})();',{filename:'twelve-preflight.js'}).runInContext(result.context);
  return result;
}
env=await preflight();
assert(env.context.testLaunchCalls===1 && env.context.gamezone1200Assets['payload.bin'].length===290016,'12.00 verified preflight did not hand off once');
for (const file of ['payload.bin','patches/1200.bin','core.js','rpc_worker.js']) {
  env=await preflight((path,response)=>{if(path===file)response.ok=false;});
  assert(env.context.testLaunchCalls===0 && env.element('state').textContent.startsWith('STOP:'),`12.00 launched with missing ${file}`);
  env=await preflight((path,response)=>{if(path===file)new Uint8Array(response.buffer)[0]^=1;});
  assert(env.context.testLaunchCalls===0,`12.00 launched with same-size corrupted ${file}`);
}
env=await preflight((path,response,metadata)=>{
  if(path==='payload.bin') {
    new Uint8Array(response.buffer)[0]^=1;
    metadata.files[path].sha256=createHash('sha256').update(new Uint8Array(response.buffer)).digest('hex');
  }
});
assert(env.context.testLaunchCalls===0,'12.00 let metadata replace the compiled payload identity');
console.log('12.00 SHA-256 vectors and missing/corrupt asset preflight tests passed; no exploit was executed.');

// Cache status, not navigator.onLine, determines whether a saved package exists.
const auditedHosts = [
  ['6.72', readFileSync(join(repo,'.gamezone-runtime/ps4-startup-672/includes/script.js'),'utf8'), 'start'],
  ['9.00', rootScript, 'start'],
  ['11.00', readFileSync(join(repo,'.gamezone-runtime/ps4-startup-1100/includes/script.js'),'utf8'), 'jeilbrek'],
  ['12.00', twelveScript, 'start'],
];
let cacheCases = 0;
for (const [fw, code, buttonId] of auditedHosts) {
  for (const online of [false,true]) {
    for (const cacheStatus of [0,1,2,3,4,5]) {
      const result=environment(`PlayStation 4/${fw}`,{cacheStatus});
      result.context.navigator.onLine=online;
      run(code,result,`cache-matrix-${fw}-${online}-${cacheStatus}`);
      assert(result.element(buttonId).disabled === (cacheStatus!==1), `${fw}: wrong initial state ${cacheStatus}, online=${online}`);
      assert(!result.location.href && [...result.storage.keys()].every(key => key === 'gamezone-900-installed-cache'), `${fw}: cache state started an exploit`);
      cacheCases++;
    }
  }
  for (const nextStatus of [0,1,3,4,5]) {
    const result=environment(`PlayStation 4/${fw}`,{cacheStatus:2});
    run(code,result,`cache-error-${fw}-${nextStatus}`);
    result.applicationCache.status=nextStatus;
    result.cacheListeners.error();
    assert(result.element(buttonId).disabled === (nextStatus!==1), `${fw}: incorrect refresh-error recovery ${nextStatus}`);
    cacheCases++;
  }
  const result=environment(`PlayStation 4/${fw}`,{cacheStatus:2});
  run(code,result,`cache-late-event-${fw}`);
  result.applicationCache.status=1; result.cacheListeners.cached();
  result.context.jailbreak=()=>{}; result.context.doJb=()=>{};
  // Block payload fetching, so even this start-button test cannot execute code.
  result.context.fetch=()=>new Promise(()=>{});
  result.element(buttonId).click();
  if(fw==='12.00') result.element(buttonId).click();
  result.cacheListeners.noupdate();
  assert(result.element(buttonId).disabled, `${fw}: late cache event re-enabled a started attempt`);
  cacheCases++;
}
console.log(`${cacheCases} cross-firmware offline state regressions passed; no exploit was executed.`);
