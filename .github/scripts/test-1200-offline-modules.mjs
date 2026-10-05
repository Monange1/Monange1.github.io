// Link the real ES module graph without evaluating any exploit code.
import { SourceTextModule, createContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'../../.gamezone-runtime/ps4-startup-1200');
async function linkGraph(alter) {
  const context=createContext({});
  const modules=new Map();
  function load(url) {
    if(url.origin!=='https://offline.invalid'||url.search||url.hash) throw new Error('Uncached module URL: '+url.href);
    const name=url.pathname.slice(1);
    if(!modules.has(name)) {
      let source=readFileSync(join(root,name),'utf8');
      if(alter)source=alter(name,source);
      modules.set(name,new SourceTextModule(source,{context,identifier:url.href}));
    }
    return modules.get(name);
  }
  const entry=load(new URL('https://offline.invalid/chain_lapse.js'));
  await entry.link((specifier,parent)=>load(new URL(specifier,parent.identifier)));
  if([...modules.values()].some(module=>module.status!=='linked'))throw new Error('Module graph did not link completely');
  return modules;
}
const graph=await linkGraph();
if(graph.size!==5||!graph.has('core.js')||graph.get('core.js').status!=='linked')throw new Error('Unexpected shared-core module graph');
let rejected=false;
try {
  await linkGraph((name,source)=>name==='mem.js'?source.replace('from "./core.js"','from "./core.js?v=10"'):source);
} catch(error) {rejected=String(error).includes('Uncached module URL');}
if(!rejected)throw new Error('Regression fixture allowed the old uncached core URL');
console.log('12.00: real five-module graph links with one shared core; old query URL is rejected. No exploit code evaluated.');
