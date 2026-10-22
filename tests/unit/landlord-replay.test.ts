import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_FOUR_RULES,bid,deal,newGame,play,view,type Game} from '../../lib/game/engine.ts';
import {bidV3,newLandlordV3,playV3,readyV3,viewV3} from '../../lib/game/landlord-v3.ts';

function readyGame(capacity:3|4):Game {
 const g=newGame('a','甲');
 if(capacity===4)g.rules={...DEFAULT_FOUR_RULES};
 for(let seat=1;seat<capacity;seat++)g.seats.push({id:String(seat),name:`玩家${seat}`,hand:[],ready:true,plays:0,last:''});
 return g;
}

test('classic and four-player landlord capture complete hands without exposing them through live views',()=>{
 for(const capacity of [3,4] as const){
  const g=readyGame(capacity);deal(g,1000);
  assert.equal(g.replay?.pending.length,1);
  assert.equal(g.replay?.pending[0].scene.seats.length,capacity);
  assert(g.replay?.pending[0].scene.seats.every(seat=>seat.hand.length===(capacity===4?25:17)));
  const unseen=g.seats.find(seat=>seat.id!=='a')!;
  assert.deepEqual(view(g,'a').seats.find(seat=>seat.id===unseen.id)?.hand,[]);
  assert.equal('replay' in view(g,'a'),false);
  bid(g,g.turn,1,1100);
  assert.equal(g.replay?.pending.at(-1)?.actor, g.replay?.pending[1].actor);
  assert.equal(g.replay?.pending.at(-1)?.scene.seats.length,capacity);
 }
});

test('classic landlord records the exact finishing play and completes the replay',()=>{
 const g=readyGame(3);deal(g,1000);
 g.phase='playing';g.turn=0;g.landlord=0;g.bid=1;g.seats[0].hand=[0];
 play(g,0,[0],1200);
 assert.equal(g.replay?.complete,true);
 assert.match(g.replay!.pending.at(-1)!.action,/甲.*3/);
 assert.deepEqual(g.replay!.pending.at(-1)!.scene.seats[0].hand,[]);
 assert.equal(g.replay!.pending.at(-1)!.scene.phase,'finished');
});

test('skill landlord captures deal and each play, seals its subround, and keeps live hands private',()=>{
 const g=newLandlordV3('a','甲');
 g.seats.push({id:'b',name:'乙',hand:[],ready:false,plays:0,last:''},{id:'c',name:'丙',hand:[],ready:false,plays:0,last:''});
 for(let seat=0;seat<3;seat++)readyV3(g,seat,1000);
 assert.equal(g.replay?.pending[0].scene.seats[0].hand.length,17);
 assert.equal('replay' in viewV3(g,'a'),false);
 assert.deepEqual(viewV3(g,'a').seats[1].hand,[]);
 g.phase='playing';g.landlord=0;g.turn=0;g.stake='1';g.bid='1';g.seats[0].hand=[0];g.last=null;
 playV3(g,0,[0],1200);
 assert.equal(g.replay?.complete,true);
 assert(g.replay!.pending.some(frame=>frame.actor===0&&frame.action.includes('3')));
 assert.equal(g.replay!.pending.at(-1)!.scene.phase,'finished');
});

function skillRound(){
 const g=newLandlordV3('a','甲');
 g.seats.push({id:'b',name:'乙',hand:[],ready:false,plays:0,last:''},{id:'c',name:'丙',hand:[],ready:false,plays:0,last:''});
 for(let seat=0;seat<3;seat++)readyV3(g,seat,1000);
 g.phase='playing';g.landlord=0;g.turn=0;g.stake='1';g.bid='1';g.last=null;
 g.seats.forEach((seat,index)=>seat.hand=[index*8,index*8+4]);
 g.equipment=[[],[],[]];g.pending=[];g.pendingEffect=undefined;
 return g;
}

test('skill replay follows the next player and a returned lead without losing prior hands or timing',()=>{
 const g=skillRound(),dealt=g.replay!.pending[0];
 const dealtHand=[...dealt.scene.seats[0].hand];
 g.replay!.window={actor:0,openedAt:1000,deadline:31000,phase:'playing'};
 playV3(g,0,[0],3000);
 const played=g.replay!.pending.at(-1)!;
 assert.equal(played.scene.turn,1);
 assert.equal(played.durationMs,2000);
 assert.equal(played.actor,0);
 assert.deepEqual(played.scene.lastPlay?.cards,[0]);
 assert.deepEqual(played.scene.seats[0].hand,[4]);
 playV3(g,1,[],4000);
 assert.equal(g.replay!.pending.at(-1)!.scene.turn,2);
 playV3(g,2,[],5000);
 const returned=g.replay!.pending.at(-1)!;
 assert.match(returned.action,/丙 不出/);
 assert.equal(returned.scene.turn,0);
 assert.equal(returned.scene.lastPlay,null);
 assert.equal(returned.scene.phase,'playing');
 assert.equal(played.scene.turn,1);
 assert.deepEqual(dealt.scene.seats[0].hand,dealtHand);
});

test('skill replay records the next bidder after a declined bid',()=>{
 const g=skillRound();g.phase='bidding';g.landlord=-1;g.turn=0;g.initialPasses=0;
 bidV3(g,0,false,3000);
 const latest=g.replay!.pending.at(-1)!;
 assert.equal(g.turn,1);
 assert.equal(latest.scene.turn,1);
 assert.equal(latest.scene.phase,'bidding');
 assert.equal(latest.actor,0);
 assert.match(latest.action,/甲 不叫/);
});
