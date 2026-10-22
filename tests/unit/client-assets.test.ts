import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {clientAssetReferences,parseAssetsManifest,reconcileAssetsManifest,verifyClientAssets} from '../../scripts/verify-client-assets.mjs';

const prefix='/_next/static/',bootstrap=prefix+'chunks/bootstrap.js',entry=prefix+'chunks/page.js',css=prefix+'css/page.css',auxiliary=prefix+'chunks/css-only.js';
function manifest(){return {bootstrapScriptContent:`import("${bootstrap}")`,clientReferenceDeps:{page:{js:[entry,bootstrap,auxiliary],css:[css]}},serverResources:{layout:{js:[],css:[css]}}};}
function assets(){return new Map([[bootstrap,'export const bootstrap=true;'],[entry,'export const page=true;'],[css,'body {color:green}']]);}

test('only an absent unreferenced secondary preload is removed; CSS and entries remain intact',()=>{
 const original=manifest(),result=reconcileAssetsManifest(original,assets());
 assert.deepEqual(result.removed,[auxiliary]);
 assert.deepEqual(result.manifest.clientReferenceDeps.page.js,[entry,bootstrap]);
 assert.deepEqual(result.manifest.clientReferenceDeps.page.css,[css]);
 assert.deepEqual(original.clientReferenceDeps.page.js,[entry,bootstrap,auxiliary]);
});

test('missing nonempty client reference entry or bootstrap always fails',()=>{
 const missingEntry=assets();missingEntry.delete(entry);
 assert.throws(()=>reconcileAssetsManifest(manifest(),missingEntry),/reference entry/);
 const missingBootstrap=assets();missingBootstrap.delete(bootstrap);
 assert.throws(()=>reconcileAssetsManifest(manifest(),missingBootstrap),/bootstrap/);
});

test('a real client JS import cannot be hidden by pruning its missing preload',()=>{
 for(const reference of ['./css-only.js',auxiliary]){
  const files=assets();files.set(entry,`import "${reference}";`);
  assert.throws(()=>reconcileAssetsManifest(manifest(),files),/references missing asset/);
 }
 const mentioned=assets();mentioned.set(entry,'const dependency="css-only.js";');
 assert.throws(()=>reconcileAssetsManifest(manifest(),mentioned),/Referenced client JS/);
});

test('missing CSS fails for both reference and server resources',()=>{
 const files=assets();files.delete(css);
 assert.throws(()=>reconcileAssetsManifest(manifest(),files),/Missing client CSS/);
 const onlyServer=manifest();onlyServer.clientReferenceDeps.page.css=[];
 assert.throws(()=>reconcileAssetsManifest(onlyServer,files),/Missing client CSS/);
});

test('bundle references resolve relative paths and ignore external URLs',()=>{
 assert.deepEqual(clientAssetReferences('import "./next.js"; import("https://cdn.test/external.js");',entry),[prefix+'chunks/next.js']);
 assert.throws(()=>parseAssetsManifest('export default runCode()'),/Unsupported/);
 assert.throws(()=>reconcileAssetsManifest({...manifest(),bootstrapScriptContent:'console.log("bootstrap")'},assets()),/bootstrap/);
});

function fixture(){
 const directory=mkdtempSync(join(tmpdir(),'sly-client-assets-'));
 const write=(name:string,source:string)=>{const path=join(directory,name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,source,'utf8');};
 for(const [url,source] of assets())write('client'+url,source);
 write('client/vinext-client-entry-manifest.json',JSON.stringify({appBrowserEntry:bootstrap.slice(1)}));
 write('client/.vite/manifest.json',JSON.stringify({bootstrap:{file:bootstrap.slice(1)},page:{file:entry.slice(1),css:[css.slice(1)]}}));
 for(const path of ['server/__vite_rsc_assets_manifest.js','server/ssr/__vite_rsc_assets_manifest.js'])write(path,'export default '+JSON.stringify(manifest()));
 const clean=()=>{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('sly-client-assets-'));rmSync(directory,{recursive:true,force:true});};
 return {directory,write,clean};
}

test('postbuild repairs both manifest copies and stays idempotent',()=>{
 const f=fixture();
 try{
  assert.deepEqual(verifyClientAssets(f.directory).removed,[auxiliary]);
  for(const path of ['server/__vite_rsc_assets_manifest.js','server/ssr/__vite_rsc_assets_manifest.js']){
   const value=parseAssetsManifest(readFileSync(join(f.directory,path),'utf8'));
   assert.deepEqual(value.clientReferenceDeps.page.js,[entry,bootstrap]);
   assert.deepEqual(value.clientReferenceDeps.page.css,[css]);
  }
  assert.deepEqual(verifyClientAssets(f.directory).removed,[]);
 }finally{f.clean();}
});

test('postbuild rejects missing emitted entries before writing either manifest',()=>{
 const f=fixture();
 try{
  f.write('client/.vite/manifest.json',JSON.stringify({entry:{file:prefix.slice(1)+'chunks/missing.js'}}));
  const before=readFileSync(join(f.directory,'server/__vite_rsc_assets_manifest.js'),'utf8');
  assert.throws(()=>verifyClientAssets(f.directory),/Missing Vite manifest asset/);
  assert.equal(readFileSync(join(f.directory,'server/__vite_rsc_assets_manifest.js'),'utf8'),before);
 }finally{f.clean();}
});

test('a failure in the second server copy leaves the first copy unmodified',()=>{
 const f=fixture();
 try{
  const invalid=manifest();invalid.clientReferenceDeps.page.js[0]=prefix+'chunks/missing-entry.js';
  f.write('server/ssr/__vite_rsc_assets_manifest.js','export default '+JSON.stringify(invalid));
  const before=readFileSync(join(f.directory,'server/__vite_rsc_assets_manifest.js'),'utf8');
  assert.throws(()=>verifyClientAssets(f.directory),/reference entry/);
  assert.equal(readFileSync(join(f.directory,'server/__vite_rsc_assets_manifest.js'),'utf8'),before);
 }finally{f.clean();}
});
