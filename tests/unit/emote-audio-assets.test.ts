import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {EMOTES} from '../../lib/emotes.ts';
test('six original emote tracks are pinned, local, finite and match the shipped fingerprints',()=>{
 const sources=JSON.parse(readFileSync(new URL('../../public/emotes/royale-v2/AUDIO-SOURCES.json',import.meta.url),'utf8'));
 assert.match(sources.commit,/^[a-f0-9]{40}$/);
 const audible=EMOTES.filter(e=>e.audio);assert.equal(audible.length,6);assert.equal(sources.items.length,6);
 for(const e of audible){
  assert.match(e.audio!,/^\/emotes\/royale-v2\/[a-z-]+\/sound\.mp3$/);
  const source=sources.items.find((i:{id:string})=>i.id===e.id);assert(source);assert.equal(source.local,e.audio);assert(source.duration>0&&source.duration<6);
  const bytes=readFileSync(new URL('../../public'+e.audio,import.meta.url));assert.equal(bytes.length,source.bytes);assert(bytes.length<50000);assert.equal(bytes.toString('ascii',0,3),'ID3');assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);
 }
});
