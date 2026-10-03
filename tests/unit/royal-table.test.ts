import test from 'node:test';
import assert from 'node:assert/strict';
import {royalHandLayout} from '../../lib/game/royal-layout.ts';
import {ROYAL_ASSETS,royalCue,royalRole,type RoyalGame} from '../../lib/motion/royal.ts';
import {collectMotionAssets} from '../../lib/motion/catalog.ts';
import {MOTION_ASSETS} from '../../lib/motion/asset-manifest.ts';

test('royal rack exposes every rank without overflowing portrait or landscape widths',()=>{
 for(const width of [240,296,366,620,850,1300])for(const count of [1,5,17,20,24,28,36]){
  const l=royalHandLayout(count,width);assert(l.cardWidth+(l.perRow-1)*l.step<=width+.01);assert(l.step>=22);assert(l.rankSize>=22);
  if(width<620&&count===20)assert(Math.ceil(count/l.perRow)>=2);
  if(width>=850&&count<=20)assert.equal(Math.ceil(count/l.perRow),1);
 }
});
const game:RoyalGame={round:'one',phase:'bidding',landlord:0,winner:-1,tableActions:[null,null,null]};
test('characters follow confirmed identities, not the provisional highest bidder',()=>{
 assert.equal(royalRole(game,0),null);assert.equal(royalRole({...game,phase:'doubling'},0),'king');assert.equal(royalRole({...game,phase:'playing'},1),'princess');assert.equal(royalRole({...game,phase:'playing',suddenDeath:true},0),null);
});
test('character cues never replay initial, repeated, unrelated, or another-round snapshots',()=>{
 const after:RoyalGame={...game,phase:'playing',tableActions:[{kind:'play',cards:[4],label:'单张'},null,null]};
 assert.equal(royalCue(null,after,0),null);assert.equal(royalCue(after,{...after},0),null);assert.equal(royalCue({...after,round:'old'},after,0),null);
 assert.equal(royalCue(game,{...game,phase:'doubling'},0),'enter');assert.equal(royalCue({...after,tableActions:[null,null,null]},after,0),'play');assert.equal(royalCue({...after,tableActions:[null,null,null]},after,1),null);
 const finish={...after,phase:'finished',winner:1};assert.equal(royalCue(after,finish,0),'lose');assert.equal(royalCue(after,finish,2),'win');assert.equal(royalCue(finish,finish,2),null);
});
test('royal art uses the common catalog without global prefetch or exceeding the agreed budget',()=>{
 const assets=collectMotionAssets([],[],ROYAL_ASSETS);assert.equal(assets.length,15);assert(assets.every(a=>!a.active));
 const bytes=(sources:typeof assets)=>sources.reduce((n,a)=>n+MOTION_ASSETS[a.src].bytes,0);
 assert(bytes(assets)<=8_000_000);assert(bytes(assets.filter(a=>a.role==='cover'))<=1_500_000);
});
