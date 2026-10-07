import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {test} from 'node:test';
import {royalCardArt,GALLERY_CARD_IDS} from '../../lib/game/card-art.ts';
import {virtualCard,rank} from '../../lib/game/engine.ts';

test('two decks share fifteen shipped rank styles, including the two original jokers',()=>{
 const arts=Array.from({length:108},(_,card)=>royalCardArt(card)!);
 assert.equal(new Set(arts.map(a=>a.src)).size,15);
 assert.equal(GALLERY_CARD_IDS.length,15);
 assert.equal(new Set(GALLERY_CARD_IDS.map(c=>royalCardArt(c)!.src)).size,15);
 for(const art of arts){const path=new URL('../../public'+art.src,import.meta.url);assert.ok(existsSync(path),art.src);const bytes=readFileSync(path);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');}
 assert.ok(royalCardArt(52)!.src.endsWith('/small-joker.webp'));
 assert.ok(royalCardArt(53)!.src.endsWith('/big-joker.webp'));
});
test('rank determines rarity independently of suit or deck',()=>{
 for(let c=0;c<108;c++){const r=rank(c);assert.equal(royalCardArt(c)!.rarity,r<=6?0:r<=10?1:r<=13?2:3);}
 for(let c=0;c<52;c+=4)for(let suit=0;suit<4;suit++){assert.equal(royalCardArt(c)!.src,royalCardArt(c+suit)!.src);assert.equal(royalCardArt(c)!.src,royalCardArt(c+suit+54)!.src);}
});
test('virtual skill cards and invalid IDs never resolve ordinary artwork',()=>{
 for(const id of [virtualCard(14,1),-1,108,0.5,NaN,Infinity])assert.equal(royalCardArt(id),null);
});
