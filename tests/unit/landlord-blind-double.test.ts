import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,deal,bid,doubleChoice,timeout,view,DEFAULT_LANDLORD_RULES,landlordRules,type Game} from '../../lib/game/engine.ts';
import {advanceBot} from '../../lib/practice/room.ts';

function table(version:'landlord-v2'|'landlord-v4'|null='landlord-v4',allowDouble=true){
 const g=newGame('a','甲');
 for(const id of ['b','c'])g.seats.push({id,name:id,hand:[],ready:false,plays:0,last:''});
 if(version)g.rules={...DEFAULT_LANDLORD_RULES,id:version,allowDouble};
 deal(g,1000);bid(g,g.turn,3,2000);return g;
}
function privateViews(g:Game){
 for(const player of g.seats){const v=view(g,player.id);assert.deepEqual(v.bottom,[]);assert.equal(v.seats.find(s=>s.id===player.id)!.hand.length,17);assert(v.seats.every(s=>s.count===17));assert(v.seats.filter(s=>s.id!==player.id).every(s=>s.hand.length===0));assert(v.seats.every(s=>s.hand.every(c=>!g.bottom.includes(c))));}
 assert.equal(new Set([...g.bottom,...g.seats.flatMap(s=>s.hand)]).size,54);
}
test('new rooms default to v4 even when an old create form submits v2',()=>{
 assert.equal(landlordRules(undefined).id,'landlord-v4');assert.equal(landlordRules({id:'landlord-v2'}).id,'landlord-v4');
});
test('all six choice orders keep bottom private until the final atomic transition',()=>{
 for(const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]){
  const g=table(),bottom=[...g.bottom];privateViews(g);
  for(const seat of order.slice(0,2)){doubleChoice(g,seat,true,3000);privateViews(g);}
  // Round trip represents restoring the persisted state after a reconnect.
  const resumed=JSON.parse(JSON.stringify(g)) as Game;doubleChoice(resumed,order[2],false,4000);
  assert.equal(resumed.phase,'playing');assert.equal(resumed.turn,resumed.landlord);assert.equal(resumed.deadline,34000);
  assert.equal(resumed.seats[resumed.landlord].hand.length,20);assert.equal(new Set(resumed.seats.flatMap(s=>s.hand)).size,54);
  for(const player of resumed.seats)assert.deepEqual(view(resumed,player.id).bottom,bottom);
  assert.throws(()=>doubleChoice(resumed,order[2],true,4001));timeout(resumed,4001);assert.equal(resumed.seats[resumed.landlord].hand.length,20);
 }
});
test('partial and complete timeouts reveal exactly once and default undecided players to no',()=>{
 for(const partial of [false,true]){const g=table();if(partial)doubleChoice(g,1,true,3000);privateViews(g);timeout(g,g.deadline);assert.equal(g.phase,'playing');assert.deepEqual(g.doubles,partial?[false,true,false]:[false,false,false]);assert.equal(g.seats[g.landlord].hand.length,20);assert.equal(timeout(g,g.deadline-1),false);}
});
test('disabled doubles, saved v2 and unversioned games retain their own timing',()=>{
 const off=table('landlord-v4',false);assert.equal(off.phase,'playing');assert.equal(off.seats[off.landlord].hand.length,20);
 const old=table('landlord-v2');assert.equal(old.phase,'doubling');assert.equal(old.seats[old.landlord].hand.length,20);assert.equal(view(old,'a').bottom.length,3);timeout(old,old.deadline);assert.equal(old.seats[old.landlord].hand.length,20);assert.equal(old.rules!.id,'landlord-v2');
 const legacy=table(null);assert.equal(legacy.phase,'playing');assert.equal(legacy.seats[legacy.landlord].hand.length,20);
});
test('landlord bot cannot use hidden bottom cards to decide its double',()=>{
 const g=table(),seat=g.landlord;g.seats[seat].bot=true;
 // Four high cards in the original hand; two hidden aces would change the decision.
 g.seats[seat].hand=[0,4,8,12,16,20,24,28,32,36,40,1,5,44,48,52,53];g.bottom=[45,46,47];
 g.practice={difficulty:'advanced',botIds:[g.seats[seat].id],nextAt:1};
 const original=[...g.seats[seat].hand];assert.equal(advanceBot(g,3000),true);assert.equal(g.doubles![seat],false);assert.deepEqual(g.seats[seat].hand,original);privateViewsForBot(g,seat);
});
function privateViewsForBot(g:Game,seat:number){const visible=view(g,g.seats[seat].id);assert.equal(visible.seats[seat].hand.length,17);assert.equal(visible.bottom.length,0);}
