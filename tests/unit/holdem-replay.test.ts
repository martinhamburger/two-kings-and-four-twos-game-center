import {test} from 'node:test';
import assert from 'node:assert/strict';
import {closeHoldem,holdemRules,holdemSeat,holdemView,moveHoldem,newHoldem,startHoldem,timeoutHoldem} from '../../lib/holdem/engine.ts';

function game(){
 const g=newHoldem('p0','玩家0',holdemRules({capacity:4}));
 g.seats=Array.from({length:4},(_,i)=>holdemSeat('p'+i,'玩家'+i,'1000'));
 g.seats.forEach(s=>s.ready=true);startHoldem(g,1000);return g;
}

test('Holdem replay records the full deal and each fold through settlement without exposing private frames in live views',()=>{
 const g=game(),initial=g.replay?.pending[0];
 assert.equal(initial?.action,'发牌并投入前注、盲注');
 assert.deepEqual(initial?.scene.seats.map(s=>s.hand.length),[2,2,2,2]);
 const live=holdemView(g,'p0');
 assert.equal(Object.hasOwn(live,'replay'),false);
 assert.deepEqual(live.seats.map(s=>s.hand.length),[2,0,0,0]);
 while(g.phase==='playing')moveHoldem(g,g.seats[g.turn].id,{action:'fold'},1100+g.replay!.pending.length);
 assert.equal(g.result?.type,'fold');
 assert.equal(g.replay?.complete,true);
 assert.equal(g.replay?.pending.length,5);
 assert.deepEqual(g.replay?.pending.slice(1,4).map(f=>f.actor),[3,0,1]);
 assert.equal(g.replay?.pending.at(-1)?.scene.phase,'finished');
 assert.equal(g.replay?.pending.at(-1)?.scene.seats.reduce((sum,s)=>sum+BigInt(s.chips??'0'),0n),4000n);
 assert.deepEqual(initial?.scene.seats.map(s=>s.hand.length),[2,2,2,2]);
});

test('Holdem replay captures all-in runout streets and completed showdown',()=>{
 const g=game();
 for(let i=0;i<4;i++)moveHoldem(g,g.seats[g.turn].id,{action:'allin'},2000+i);
 assert.equal(g.phase,'runout');
 assert.equal(g.replay?.pending.at(-1)?.scene.phase,'runout');
 assert.equal(g.replay?.pending.at(-1)?.scene.turn,-1);
 for(let i=0;i<3;i++)assert.equal(timeoutHoldem(g,g.deadline),true);
 assert.equal(g.result?.type,'showdown');
 assert.equal(g.replay?.complete,true);
 assert.deepEqual(g.replay?.pending.filter(f=>f.action.startsWith('发出')).map(f=>f.scene.board?.length),[3,4,5]);
 const last=g.replay!.pending.at(-1)!;
 assert.equal(last.scene.phase,'finished');
 assert.equal(last.scene.board?.length,5);
 assert.equal(last.scene.pot,'4000');
 assert.equal(last.scene.seats.reduce((sum,s)=>sum+BigInt(s.chips??'0'),0n),4000n);
});

test('forced abort completes its replay without publishing it in a live room view',()=>{
 const g=game();closeHoldem(g,true,3000);
 assert.equal(g.replay?.complete,true);
 assert.equal(g.result?.type,'aborted');
 assert.equal(g.replay?.pending.at(-1)?.scene.phase,'closed');
 assert.equal(Object.hasOwn(holdemView(g,'p0'),'replay'),false);
});

test('replay highlights the next eligible player after the deal and each fold',()=>{
 const g=game(),dealt=g.replay!.pending[0];
 assert.equal(dealt.scene.turn,g.turn);
 assert.equal(dealt.scene.turn,3);
 moveHoldem(g,'p3',{action:'fold'},2000);
 const folded=g.replay!.pending.at(-1)!;
 assert.equal(folded.actor,3);
 assert.equal(folded.scene.seats[3].folded,true);
 assert.equal(folded.scene.turn,g.turn);
 assert.equal(folded.scene.turn,0);
 assert.equal(dealt.scene.seats[3].folded,false);
 assert.equal(dealt.scene.turn,3);
});

test('a street transition preserves the completed wager before recording the new board and next turn',()=>{
 const g=game();
 for(let i=0;i<3;i++)moveHoldem(g,g.seats[g.turn].id,{action:'call'},2000+i);
 moveHoldem(g,g.seats[g.turn].id,{action:'check'},2003);
 const frames=g.replay!.pending,checked=frames.at(-2)!,flop=frames.at(-1)!;
 assert.equal(frames.length,6);
 assert.equal(checked.actor,2);
 assert.equal(checked.scene.street,'preflop');
 assert.deepEqual(checked.scene.board,[]);
 assert.equal(checked.scene.seats[2].action?.kind,'check');
 assert.equal(checked.scene.seats[2].bet,'30');
 assert.equal(checked.scene.turn,-1);
 assert.equal(flop.action,'发出翻牌');
 assert.equal(flop.scene.street,'flop');
 assert.equal(flop.scene.board?.length,3);
 assert.equal(flop.scene.turn,g.turn);
 assert.equal(flop.scene.turn,1);
 assert(flop.scene.seats.every(seat=>seat.bet==='0'));
 assert.equal(g.replay!.pending[0].scene.turn,3);
});
