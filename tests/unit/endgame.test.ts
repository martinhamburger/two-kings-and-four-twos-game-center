import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyEndgame,readEndgame,startEndgame,moveEndgame,type Endgame} from '../../lib/game/endgame.ts';
const position=():Endgame=>({version:1,hands:[[0,4],[8,12],[16,20]],landlord:0,turn:0});
test('portable endgames validate physical cards, capacities and seats',()=>{
 assert.deepEqual(readEndgame(emptyEndgame(),false),emptyEndgame());
 assert.throws(()=>startEndgame(emptyEndgame()));
 for(const hands of [[[0],[0],[4]],[[54],[1],[2]],[[0.5],[1],[2]],[[],[1],[2]],[Array.from({length:21},(_,i)=>i),[30],[31]],[[30],Array.from({length:18},(_,i)=>i),[31]]])assert.throws(()=>readEndgame({...position(),hands}));
 for(const turn of [-1,3,0.5])assert.throws(()=>readEndgame({...position(),turn}));
 assert.throws(()=>readEndgame({...position(),version:2}));
 assert.deepEqual(readEndgame({...position(),extra:'untrusted'}),readEndgame(position()));
});
test('all seats share ordinary rules; immutable moves preserve undo and restart',()=>{
 const p=position(),g=startEndgame(p),before=structuredClone(g);
 assert.equal(g.turn,0);assert.equal(g.phase,'playing');
 assert.throws(()=>moveEndgame(g,[]));assert.throws(()=>moveEndgame(g,[8]));assert.throws(()=>moveEndgame(g,[0,4]));
 const a=moveEndgame(g,[0]);assert.deepEqual(g,before);assert.deepEqual(p,position());assert.equal(a.turn,1);assert.equal(a.deadline,0);assert.deepEqual(a.deltas,[]);
 const b=moveEndgame(a,[]),c=moveEndgame(b,[]);assert.equal(c.turn,0);assert.equal(c.last,null);assert.throws(()=>moveEndgame(c,[]));
 const done=moveEndgame(c,[4]);assert.equal(done.phase,'finished');assert.equal(done.winner,0);assert.deepEqual(done.deltas,[]);assert.throws(()=>moveEndgame(done,[8]));
 assert.deepEqual(startEndgame(p),before);
});
test('design supports farmer lead, farmer victory and legal overcalls',()=>{
 const g=startEndgame({...position(),turn:2});assert.equal(g.turn,2);
 const a=moveEndgame(g,[16]);assert.equal(a.turn,0);assert.throws(()=>moveEndgame(a,[4]));
 const b=moveEndgame(moveEndgame(a,[]),[]),done=moveEndgame(b,[20]);assert.equal(done.winner,2);assert.equal(done.phase,'finished');
 const over=moveEndgame(moveEndgame(startEndgame(position()),[0]),[8]);assert.equal(over.last?.seat,1);
});

// The visible rank tile represents shared stock across all three seats.
test('rank editor allocates unique physical cards, returns stock, and rejects excess',async()=>{
 const {changeEndgameRank,endgameRankStock}=await import('../../lib/game/endgame.ts');
 let p=emptyEndgame();const before=structuredClone(p);
 for(let i=0;i<4;i++)p=changeEndgameRank(p,i%3,14,1);
 assert.equal(endgameRankStock(p,14).length,0);assert.equal(new Set(p.hands.flat()).size,4);assert.deepEqual(before,emptyEndgame());
 assert.throws(()=>changeEndgameRank(p,0,14,1));
 p=changeEndgameRank(p,1,14,-1);assert.equal(endgameRankStock(p,14).length,1);p=changeEndgameRank(p,2,14,1);assert.equal(endgameRankStock(p,14).length,0);
 p=changeEndgameRank(p,0,17,1);assert.throws(()=>changeEndgameRank(p,1,17,1));
 assert.throws(()=>changeEndgameRank(p,3,3,1));assert.throws(()=>changeEndgameRank(p,0,18,1));
 const full={...emptyEndgame(),hands:[[],Array.from({length:17},(_,i)=>i),[]]};assert.throws(()=>changeEndgameRank(full,1,15,1));assert.equal(full.hands[1].length,17);
});
