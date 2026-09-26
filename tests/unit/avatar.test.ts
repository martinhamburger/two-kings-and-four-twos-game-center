import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectImage,sanitizeAvatar,cropRect} from '../../lib/avatar/image.ts';
import {avatarProfile,mergeProfiles} from '../../lib/avatar/profile.ts';
const jpg=new Uint8Array(readFileSync(new URL('../fixtures/avatar.jpg',import.meta.url)));
test('avatar raster validates dimensions and strips metadata, rejecting truncated and disguised files',()=>{
 assert.deepEqual(inspectImage(jpg),{width:256,height:256,type:'image/jpeg'});
 const meta=Uint8Array.from([255,225,0,12,...new TextEncoder().encode('GPS secret')]);
 const tagged=new Uint8Array(jpg.length+meta.length);tagged.set(jpg.subarray(0,2));tagged.set(meta,2);tagged.set(jpg.subarray(2),2+meta.length);
 const clean=sanitizeAvatar(tagged);assert(!new TextDecoder().decode(clean).includes('GPS secret'));assert.deepEqual(clean,sanitizeAvatar(jpg));
 for(const bad of [jpg.subarray(0,-1),jpg.subarray(0,40),new TextEncoder().encode('<svg/>'),new Uint8Array(65537)])assert.throws(()=>sanitizeAvatar(bad));
 const wrong=jpg.slice();for(let p=2;p<wrong.length-10;p++)if(wrong[p]===255&&wrong[p+1]===192){wrong[p+5]=0;wrong[p+6]=128;break;}assert.throws(()=>sanitizeAvatar(wrong),/256/);
});
test('source limits and animation headers reject before image decoding',()=>{
 assert.throws(()=>inspectImage(new Uint8Array(10*1024*1024+1)),/10MB/);
 const png=new Uint8Array(57),v=new DataView(png.buffer);png.set([137,80,78,71,13,10,26,10]);v.setUint32(8,13);png.set(new TextEncoder().encode('IHDR'),12);v.setUint32(16,6000);v.setUint32(20,4001);assert.throws(()=>inspectImage(png),/2400/);v.setUint32(16,256);v.setUint32(20,256);png.set(new TextEncoder().encode('acTL'),37);assert.throws(()=>inspectImage(png),/动画/);
 const webp=new Uint8Array(30);webp.set(new TextEncoder().encode('RIFF'));new DataView(webp.buffer).setUint32(4,22,true);webp.set(new TextEncoder().encode('WEBPVP8X'),8);new DataView(webp.buffer).setUint32(16,10,true);webp[20]=2;assert.throws(()=>inspectImage(webp),/动画/);
});
test('crop remains inside portrait and landscape edges at every zoom',()=>{for(const [w,h] of [[600,400],[400,600]])for(const zoom of [1,1.5,3])for(const x of [-1,0,.5,1,2])for(const y of [-1,0,.5,1,2]){const r=cropRect(w,h,zoom,x,y);assert(r.left>=0&&r.top>=0&&r.left+r.size<=w&&r.top+r.size<=h);}});
test('late pictures cannot overwrite newer pictures or a default tombstone; unchanged snapshots keep references',()=>{
 const first=mergeProfiles({},[avatarProfile('a',2,true)]);assert.equal(mergeProfiles(first,[avatarProfile('a',1,true),avatarProfile('a',2,true)]),first);
 const restored=mergeProfiles(first,[avatarProfile('a',3,false)]);assert.equal(mergeProfiles(restored,[avatarProfile('a',2,true)]),restored);assert.equal(restored.a.url,null);assert.deepEqual(mergeProfiles({},[avatarProfile('b')]),{b:avatarProfile('b')});
});
