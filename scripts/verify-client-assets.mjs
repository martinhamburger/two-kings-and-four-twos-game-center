import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,relative,sep,basename} from 'node:path';
import {pathToFileURL} from 'node:url';

const assetOrigin='https://build-assets.local';

export function parseAssetsManifest(source){
 const match=source.match(/^\s*export\s+default\s+(\{[\s\S]*\})\s*;?\s*$/);
 if(!match)throw Error('Unsupported RSC assets manifest format');
 return JSON.parse(match[1]);
}

function assetUrl(value,extension){
 if(typeof value!=='string'||!value.startsWith('/_next/static/')||!value.endsWith(extension)||new URL(value,assetOrigin).pathname!==value)
  throw Error(`Unsupported client asset path: ${value}`);
 return value;
}

/** Check literal bundle imports/preload tables without executing generated code. */
export function clientAssetReferences(source,sourceUrl){
 const references=new Set();
 for(const match of source.matchAll(/["'`]([^"'`\r\n]+\.js(?:[?#][^"'`\r\n]*)?)["'`]/g)){
  let value=match[1];
  if(value.startsWith('_next/static/'))value='/'+value;
  if(!value.startsWith('/_next/static/')&&!value.startsWith('./')&&!value.startsWith('../'))continue;
  const url=new URL(value,new URL(sourceUrl,assetOrigin));
  if(url.pathname.startsWith('/_next/static/'))references.add(url.pathname);
 }
 return [...references];
}

/** plugin-rsc collects the reference entry first, followed by preload deps.
 * Only an absent secondary JS with no emitted JS reference may be removed. */
export function reconcileAssetsManifest(original,assets){
 const manifest=structuredClone(original),removed=new Set();
 const bootstrap=manifest.bootstrapScriptContent?.match(/^import\((["'])([^"']+)\1\)$/)?.[2];
 if(!bootstrap||!assets.has(assetUrl(bootstrap,'.js')))throw Error(`Missing client bootstrap: ${bootstrap??'unrecognized bootstrap'}`);
 if(!manifest.clientReferenceDeps||typeof manifest.clientReferenceDeps!=='object'||Array.isArray(manifest.clientReferenceDeps))
  throw Error('Missing client reference dependency map');
 const jsSources=[...assets].filter(([url])=>url.endsWith('.js'));
 for(const [sourceUrl,source] of jsSources){
  for(const dependency of clientAssetReferences(source,sourceUrl))
   if(!assets.has(dependency))throw Error(`Client JS ${sourceUrl} references missing asset ${dependency}`);
 }
 const checkCss=(resource)=>{
  if(!resource||!Array.isArray(resource.js)||!Array.isArray(resource.css))throw Error('Invalid asset dependency list');
  for(const url of resource.css)if(!assets.has(assetUrl(url,'.css')))throw Error(`Missing client CSS: ${url}`);
 };
 for(const [id,resource] of Object.entries(manifest.clientReferenceDeps)){
  checkCss(resource);
  if(resource.js.length&&!assets.has(assetUrl(resource.js[0],'.js')))throw Error(`Missing client reference entry ${id}: ${resource.js[0]}`);
  resource.js=resource.js.filter((url,index)=>{
   assetUrl(url,'.js');
   if(assets.has(url))return true;
   // A filename mention is intentionally conservative: unknown consumers fail
   // verification rather than concealing an actual import or preload request.
   if(index===0||jsSources.some(([,source])=>source.includes(basename(url))))throw Error(`Referenced client JS is missing: ${url}`);
   removed.add(url);return false;
  });
 }
 for(const resource of Object.values(manifest.serverResources??{})){
  checkCss(resource);
  for(const url of resource.js)if(!assets.has(assetUrl(url,'.js')))throw Error(`Missing server resource JS: ${url}`);
 }
 return {manifest,removed:[...removed]};
}

/** Validate both server copies before changing either one. */
export function verifyClientAssets(distRoot='dist'){
 const root=resolve(distRoot),client=resolve(root,'client'),assets=new Map();
 const collect=(directory)=>{
  for(const entry of readdirSync(directory,{withFileTypes:true})){
   const path=resolve(directory,entry.name);
   if(entry.isDirectory())collect(path);
   else if(entry.isFile()&&/\.(js|css)$/.test(entry.name))assets.set('/'+relative(client,path).split(sep).join('/'),readFileSync(path,'utf8'));
  }
 };
 collect(client);
 const entry=JSON.parse(readFileSync(resolve(client,'vinext-client-entry-manifest.json'),'utf8')).appBrowserEntry;
 if(typeof entry!=='string'||!assets.has(assetUrl('/'+entry.replace(/^\//,''),'.js')))throw Error(`Missing browser entry: ${entry}`);
 const vite=JSON.parse(readFileSync(resolve(client,'.vite/manifest.json'),'utf8'));
 for(const item of Object.values(vite)){
  for(const file of [item.file,...(item.css??[])]){
   if(typeof file==='string'&&/\.(js|css)$/.test(file)&&!assets.has(assetUrl('/'+file.replace(/^\//,''),file.endsWith('.css')?'.css':'.js')))
    throw Error(`Missing Vite manifest asset: ${file}`);
  }
 }
 const plans=['server/__vite_rsc_assets_manifest.js','server/ssr/__vite_rsc_assets_manifest.js'].map(file=>{
  const path=resolve(root,file),source=readFileSync(path,'utf8');
  return {path,...reconcileAssetsManifest(parseAssetsManifest(source),assets)};
 });
 for(const plan of plans)if(plan.removed.length)writeFileSync(plan.path,'export default '+JSON.stringify(plan.manifest,null,2)+'\n','utf8');
 const removed=[...new Set(plans.flatMap(plan=>plan.removed))];
 return {removed,manifests:plans.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const result=verifyClientAssets();
 console.log(`Client asset manifests verified (${result.manifests}); removed ${result.removed.length} absent secondary preloads.`);
 for(const url of result.removed)console.log(`  ${url}`);
}
