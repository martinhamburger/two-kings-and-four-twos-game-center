import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {test} from 'node:test';
import {royalCardArt} from '../../lib/game/card-art.ts';
import {virtualCard} from '../../lib/game/engine.ts';

test('all 54 physical cards have distinct, shipped Page artwork',()=>{
 const arts=Array.from({length:54},(_,card)=>royalCardArt(card)!);
 assert.equal(new Set(arts.map(a=>a.src)).size,54);
 for(const art of arts){
  const path=new URL('../../public'+art.src,import.meta.url);
  assert.ok(existsSync(path),art.src);
  const bytes=readFileSync(path);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
 }
 assert.notEqual(royalCardArt(52)!.src.toLowerCase(),royalCardArt(53)!.src.toLowerCase());
});
test('suit colours follow the user approved mapping, including A and 2',()=>{
 for(const start of [0,44,48]){
  assert.equal(royalCardArt(start+2)!.rarity,0); // clubs
  assert.equal(royalCardArt(start+3)!.rarity,1); // diamonds
  assert.equal(royalCardArt(start+1)!.rarity,2); // hearts
  assert.equal(royalCardArt(start)!.rarity,3); // spades
 }
 assert.equal(royalCardArt(44)!.point,'A');
 assert.equal(royalCardArt(48)!.point,'2');
});
test('virtual skill cards and invalid IDs never resolve ordinary artwork',()=>{
 for(const id of [virtualCard(14,1),-1,54,0.5,NaN,Infinity])assert.equal(royalCardArt(id),null);
});
