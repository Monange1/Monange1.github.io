import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

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
  };
  const location = { href:'', pathname:initial.pathname||'', replace(value) { this.href=value; } };
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
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  return { context, element, appended, storage, location, applicationCache };
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

env = environment('Mozilla/5.0 (PlayStation 4/13.00) AppleWebKit');
run(inlineScripts('.gamezone-runtime/ps4-startup-router/index.html')[0], env, 'router.js');
assert(env.location.href === '', 'router navigated without a button press');
env.element('open').click();
assert(env.location.href === '../modern/', 'router selected the wrong 13.00 destination');

env = environment('Mozilla/5.0 (PlayStation 4/9.00) AppleWebKit', { pathname:'/ps4-host/start/' });
run(inlineScripts('.gamezone-runtime/ps4-startup-router/index.html')[0], env, 'local-router.js');
env.element('open').click();
assert(env.location.href === '../900/', 'local Hub router did not select its mounted 9.00 path');

env = environment('Mozilla/5.0 (PlayStation 4/11.50) AppleWebKit');
run(inlineScripts('.gamezone-runtime/ps4-startup-modern/run_lapse.html')[0], env, 'lapse-guard.js');
assert(env.appended.length === 0 && env.element('state').textContent.startsWith('BLOCKED'), 'direct Lapse URL bypassed the launch ticket');

const ticket = JSON.stringify({ firmware:'11.50', chain:'lapse', issuedAt:Date.now() });
env = environment('Mozilla/5.0 (PlayStation 4/11.50) AppleWebKit', { storage:[['gamezone-launch-ticket',ticket]] });
run(inlineScripts('.gamezone-runtime/ps4-startup-modern/run_lapse.html')[0], env, 'lapse-ticket.js');
assert(env.appended.length === 1 && env.appended[0].src === './chain_lapse.js', 'valid Lapse ticket did not start exactly one chain');
assert(!env.storage.has('gamezone-launch-ticket'), 'launch ticket was not consumed');

let calls = 0;
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

env = environment('Mozilla/5.0 (PlayStation 4/9.00) AppleWebKit');
const rootScript = inlineScripts('.gamezone-runtime/ps4-startup-900/index.html')[0];
run(rootScript, env, 'nine.js');
assert((env.context.fetches||0) === 0 && env.element('start').disabled === false, '9.00 performed work before a button press');

console.log('PS4 host safety state tests passed.');
