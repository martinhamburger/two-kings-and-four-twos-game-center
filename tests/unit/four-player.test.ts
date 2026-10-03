import {logCue} from '../../lib/audio/events.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,deal,bid,doubleChoice,play,view,timeout,DEFAULT_FOUR_RULES,landlordCapacity,rank,suit,classify,hintsFor,type Game} from '../../lib/game/engine.ts';
import {classifyFour,beatsFour,hintsFour} from '../../lib/game/four-player.ts';
import {fillBots,addRoomBot,scheduleBots,advanceBot} from '../../lib/practice/room.ts';
import {royalCardArt} from '../../lib/game/card-art.ts';
const cards=(r:number,n:number)=>[...Array(108).keys()].filter(c=>rank(c)===r).slice(0,n);
function game(){const g=newGame('a','甲');g.rules={...DEFAULT_FOUR_RULES};for(const id of ['b','c','d'])g.seats.push({id,name:id,hand:[],ready:false,plays:0,last:''});return g;}
function start(){const g=game();deal(g,0);bid(g,g.turn,3,1);return g;}
test('four decks preserve 108 unique instances and reveal only after all four doubles',()=>{
 for(let n=0;n<25;n++){const g=start(),all=[...g.seats.flatMap(s=>s.hand),...g.bottom];assert.equal(new Set(all).size,108);assert.deepEqual(g.seats.map(s=>s.hand.length),[25,25,25,25]);
 for(let i=0;i<4;i++){const v=view(g,g.seats[i].id);assert.equal(v.bottom.length,0);assert.equal(v.seats.filter(s=>s.hand.length).length,1);}
 for(let i=0;i<3;i++)doubleChoice(g,i,false,2);assert.equal(view(g,'a').bottom.length,0);doubleChoice(g,3,true,3);assert.equal(g.phase,'playing');assert.equal(g.seats[g.landlord].hand.length,33);assert.equal(view(g,'b').bottom.length,8);assert.equal(new Set(g.seats.flatMap(s=>s.hand)).size,108);}
});
test('each of four seats bids once and all-pass redeals; old three rules stay three',()=>{
 let g=game();deal(g,0);const begin=g.turn;bid(g,g.turn,1,1);bid(g,g.turn,0,2);bid(g,g.turn,2,3);assert.equal(g.phase,'bidding');bid(g,g.turn,0,4);assert.equal(g.phase,'doubling');assert.equal(g.landlord,(begin+2)%4);
 g=game();deal(g,0);const round=g.round;for(let i=0;i<4;i++)bid(g,g.turn,0,i+1);assert.notEqual(g.round,round);assert.equal(g.phase,'bidding');assert.equal(landlordCapacity(newGame('x','X')),3);assert.equal(classify([54]),null);
});
test('four-player bombs and pairs distinguish physical copies and all four jokers',()=>{
 assert.equal(rank(54),3);assert.equal(suit(54),suit(0));assert.deepEqual(royalCardArt(54),royalCardArt(0));
 assert.equal(classifyFour([52,106])?.kind,'对子');assert.equal(classifyFour([52,53]),null);assert.equal(classifyFour([52,53,106,107])?.kind,'王炸');assert.equal(classifyFour([0,0]),null);assert.equal(classifyFour([108]),null);
 assert(beatsFour(classifyFour(cards(3,5))!,classifyFour(cards(15,4))!));assert(!beatsFour(classifyFour(cards(15,4))!,classifyFour(cards(3,5))!));assert(beatsFour(classifyFour([52,53,106,107])!,classifyFour(cards(15,8))!));
});
test('only pair wings are allowed and continuous patterns cannot contain two or jokers',()=>{
 assert.equal(classifyFour([...cards(3,3),...cards(4,1)]),null);assert.equal(classifyFour([...cards(3,3),...cards(4,2)])?.kind,'三带二');
 assert.equal(classifyFour([...cards(3,3),...cards(4,3),...cards(7,2),...cards(8,2)])?.kind,'飞机带对');
 assert.equal(classifyFour([...cards(3,4),...cards(4,2),...cards(5,2)]),null);assert.equal(classifyFour([12,16,20,24,28,32,36,40,44,48]),null);
});
test('three passes reset lead and four-party settlement is zero-sum with separate doubles',()=>{
 const g=start();for(let i=0;i<4;i++)doubleChoice(g,i,false,2);const leader=g.turn;play(g,g.turn,[g.seats[g.turn].hand[0]],3);for(let i=0;i<2;i++)play(g,g.turn,[],4+i);assert(g.last);play(g,g.turn,[],6);assert.equal(g.last,null);assert.equal(g.turn,leader);
 g.rules!.springDouble=false;g.bid=2;g.doubles=[true,false,true,false];g.landlord=0;g.turn=2;g.last=null;g.seats[2].hand=[0];play(g,2,[0],8);assert.equal(g.phase,'finished');assert.deepEqual(g.deltas,[-16,4,8,4]);assert.equal(g.deltas.reduce((a,b)=>a+b),0);
});
test('timeout and bot fill use all four seats without revealing private cards',()=>{
 const g=newGame('a','甲');g.rules={...DEFAULT_FOUR_RULES};fillBots(g);assert.equal(g.seats.length,4);deal(g,0);bid(g,g.turn,3,1);assert(timeout(g,100000));assert.equal(g.phase,'playing');assert.equal(g.doubles!.length,4);assert(g.doubles!.every(v=>v===false));
 const mixed=newGame('a','甲');mixed.rules={...DEFAULT_FOUR_RULES};addRoomBot(mixed);addRoomBot(mixed);addRoomBot(mixed);assert.throws(()=>addRoomBot(mixed),/座位已满/);
});
test('random four games have legal hints and always terminate with exact zero-sum results',()=>{
 for(let n=0;n<80;n++){const g=start();for(let i=0;i<4;i++)doubleChoice(g,i,false,2);let moves=0;
 while(g.phase==='playing'&&moves++<1000){const hand=g.seats[g.turn].hand,options=hintsFour(hand,g.last?.combo??null);for(const cs of options){assert(classifyFour(cs));assert(cs.every(c=>hand.includes(c)));assert(beatsFour(classifyFour(cs)!,g.last?.combo??null));}const move=options.sort((a,b)=>b.length-a.length)[0]??[];play(g,g.turn,move,moves+3);}
 assert.equal(g.phase,'finished');assert.equal(g.deltas.length,4);assert.equal(g.deltas.reduce((a,b)=>a+b),0);assert(g.deltas.every(Number.isSafeInteger));}
});
test('four-player practice bots use legal moves through a full round',()=>{
 const g=newGame('a','甲');g.rules={...DEFAULT_FOUR_RULES};fillBots(g);deal(g,0);let now=100,steps=0;
 while(g.phase!=='finished'&&steps++<1500){if(g.phase==='doubling'&&g.doubles?.[0]===null)doubleChoice(g,0,false,now);else if(g.turn===0){if(g.phase==='bidding')bid(g,0,3,now);else if(g.phase==='playing')play(g,0,hintsFor(g,g.seats[0].hand,g.last?.combo??null).sort((a,b)=>b.length-a.length)[0]??[],now);}else{scheduleBots(g,now);now+=1000;assert(advanceBot(g,now));}now+=1000;}
 assert.equal(g.phase,'finished');
});

test('four-player public audio recognizes five-to-eight card bombs and paired jokers',()=>{
 const g={rules:{id:'landlord-four-v1'},round:'a',phase:'playing',turn:0,deadline:30,seats:[{id:'a',name:'甲'}],log:[]};
 assert.equal(logCue({text:'甲：炸弹 3 3 3 3 3',at:1},g)?.speech,'五个三，炸弹');
 assert.equal(logCue({text:'甲：王炸 大王 大王 小王 小王',at:2},g)?.speech,'王炸');
 assert.equal(logCue({text:'甲：对子 大王 大王',at:3},g)?.speech,'对大王');
});
