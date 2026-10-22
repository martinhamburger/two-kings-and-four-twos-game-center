import {test} from 'node:test';
import assert from 'node:assert/strict';
import {friendlyRounds,newFriendlyMatch,assertFriendlyReady,assertFriendlyRosterEditable,lockFriendlyMatch,settleFriendlyMatch,interruptFriendlyMatch,friendlyStandings} from '../../lib/friendly-match.ts';
import {newGame,deal,view} from '../../lib/game/engine.ts';
import {newModern,modernSeat,dealModern,modernView} from '../../lib/mahjong/modern.ts';
import {newHoldem,holdemSeat,holdemRules,startHoldem,holdemView,rebuyHoldem} from '../../lib/holdem/engine.ts';
import {royalRole} from '../../lib/motion/royal.ts';
const room=(target=4)=>({friendlyMatch:newFriendlyMatch(target,'积分'),seats:[{id:'a',name:'同名'},{id:'b',name:'同名',bot:true},{id:'c',name:'长昵称玩家'}]});
test('only supported explicit numbers select a friendly match; legacy omission stays free',()=>{
 for(const v of [undefined,0]){assert.equal(friendlyRounds(v),undefined);assert.equal(newFriendlyMatch(v,'积分'),undefined);}
 for(const n of [1,4,8,12])assert.equal(friendlyRounds(n),n);
 for(const v of [null,false,true,'4',-1,2,3,5,13,NaN,Infinity,{},[]])assert.throws(()=>friendlyRounds(v));
 const legacy={seats:[{id:'a',name:'甲'}]};assert.doesNotThrow(()=>assertFriendlyReady(legacy));assert.doesNotThrow(()=>lockFriendlyMatch(legacy));assert.equal(settleFriendlyMatch(legacy,{id:'round',ended:1,deltas:[1]}),false);
});
test('first readiness does not lock roster; actual start snapshots names, ids and robots without private data',()=>{
 const g=room();assert.equal(g.friendlyMatch!.status,'waiting');assertFriendlyRosterEditable(g);g.seats[0].name='开赛昵称';
 lockFriendlyMatch(g,0);assert.equal(g.friendlyMatch!.startedAt,0);assert.equal(g.friendlyMatch!.status,'playing');assert.equal(g.friendlyMatch!.roster[0].name,'开赛昵称');assert.equal(g.friendlyMatch!.roster[1].bot,true);
 assert.deepEqual(Object.keys(g.friendlyMatch!.roster[0]).sort(),['bot','id','name']);
 assert.throws(()=>assertFriendlyRosterEditable(g));g.seats[0].name='后来昵称';assertFriendlyReady(g);lockFriendlyMatch(g,9);assert.equal(g.friendlyMatch!.roster[0].name,'开赛昵称');
});
test('roster is fixed by identity and order, not nickname or online presence',()=>{
 const g=room();lockFriendlyMatch(g);const saved=structuredClone(g.seats);g.seats.reverse();assert.throws(()=>assertFriendlyReady(g));g.seats=saved.slice(1);assert.throws(()=>assertFriendlyReady(g));g.seats=saved;g.seats[0].id='replacement';assert.throws(()=>assertFriendlyReady(g));
 const duplicate=room();duplicate.seats[1].id='a';assert.throws(()=>lockFriendlyMatch(duplicate));
});
for(const target of [1,4,8,12])test(`exactly ${target} unique settlements finish a match and reject the next start`,()=>{
 const g=room(target);lockFriendlyMatch(g,1);
 for(let i=0;i<target;i++){
  assertFriendlyReady(g);const round={id:`r${i}`,ended:10+i,deltas:[-2,1,1]};assert.equal(settleFriendlyMatch(g,round),true);assert.equal(settleFriendlyMatch(g,round),false);assert.equal(g.friendlyMatch!.rounds.length,i+1);
 }
 assert.equal(g.friendlyMatch!.status,'finished');assert.deepEqual(g.friendlyMatch!.totals,[String(-2*target),String(target),String(target)]);assert.equal(g.friendlyMatch!.endedAt,9+target);
 assert.throws(()=>assertFriendlyReady(g));assert.equal(settleFriendlyMatch(g,{id:'extra',ended:99,deltas:[3,-2,-1]}),false);assert.equal(g.friendlyMatch!.rounds.length,target);
 assert.deepEqual(friendlyStandings(g.friendlyMatch!).filter(p=>p.champion).map(p=>p.id),['b','c']);assert.deepEqual(friendlyStandings(g.friendlyMatch!).map(p=>p.rank),[1,1,3]);
});
test('big chips, signed kong/draw totals and repeated rounds retain integer precision',()=>{
 const g=room();g.friendlyMatch!.unit='筹码';const big='999999999999999999999999999999';settleFriendlyMatch(g,{id:'draw-with-kongs',ended:5,deltas:[big,'-'+big,'0']});settleFriendlyMatch(g,{id:'hu',ended:6,deltas:['2','-1','-1']});
 assert.deepEqual(g.friendlyMatch!.totals,['1000000000000000000000000000001','-1000000000000000000000000000000','-1']);assert.equal(g.friendlyMatch!.rounds[0].deltas[0],big);
 assert.throws(()=>settleFriendlyMatch(g,{id:'bad',ended:7,deltas:[1.2,0,-1.2]}));assert.throws(()=>settleFriendlyMatch(g,{id:'missing',ended:7,deltas:[0,0]}));assert.equal(g.friendlyMatch!.rounds.length,2);
});
test('interruption keeps completed standings but never grants a champion or counts a refund',()=>{
 const g=room();settleFriendlyMatch(g,{id:'complete',ended:10,deltas:[8,-4,-4]});interruptFriendlyMatch(g,'有玩家离桌',11);
 assert.equal(g.friendlyMatch!.status,'interrupted');assert.equal(g.friendlyMatch!.rounds.length,1);assert.deepEqual(g.friendlyMatch!.totals,['8','-4','-4']);assert(friendlyStandings(g.friendlyMatch!).every(p=>!p.champion));assert.throws(()=>assertFriendlyReady(g));
 assert.equal(settleFriendlyMatch(g,{id:'refund',ended:12,deltas:[0,0,0]}),false);
 const waiting=room();interruptFriendlyMatch(waiting,'取消开赛',13);assert.equal(waiting.friendlyMatch!.rounds.length,0);assert.equal(waiting.friendlyMatch!.roster.length,3);assert.deepEqual(waiting.friendlyMatch!.totals,['0','0','0']);
});
test('departure requested during the final round cancels the award after that round settles',()=>{
 const g=room(1);settleFriendlyMatch(g,{id:'last',ended:10,deltas:[2,-1,-1]});interruptFriendlyMatch(g,'离桌请求在结算前已提交',11,true);assert.equal(g.friendlyMatch!.status,'interrupted');assert.equal(g.friendlyMatch!.rounds.length,1);assert(friendlyStandings(g.friendlyMatch!).every(p=>!p.champion));
 const completed=room(1);settleFriendlyMatch(completed,{id:'last',ended:10,deltas:[2,-1,-1]});interruptFriendlyMatch(completed,'赛后返回大厅',11);assert.equal(completed.friendlyMatch!.status,'finished');
});
test('landlord redeals change round id without counting or replacing the fixed roster',()=>{
 const g=newGame('a','甲');g.friendlyMatch=newFriendlyMatch(4,'积分');g.seats.push({...g.seats[0],id:'b'},{...g.seats[0],id:'c'});deal(g,1);lockFriendlyMatch(g,1);const first=g.round;deal(g,2);lockFriendlyMatch(g,2);assert.notEqual(g.round,first);assert.equal(g.friendlyMatch!.rounds.length,0);assert.equal(g.friendlyMatch!.startedAt,1);assertFriendlyReady(g);
});
test('modern Mahjong and Holdem public views include only the public match snapshot',()=>{
 const m=newModern('a','甲');m.seats.push(modernSeat('b','乙',m.initialChips),modernSeat('c','丙',m.initialChips),modernSeat('d','丁',m.initialChips));m.friendlyMatch=newFriendlyMatch(4,'筹码');dealModern(m,1);lockFriendlyMatch(m,1);assert.deepEqual(modernView(m,'a').friendlyMatch,m.friendlyMatch);assert(modernView(m,'a').seats.slice(1).every(s=>s.hand.length===0));
 const h=newHoldem('a','甲',holdemRules({capacity:4}));for(const id of ['b','c','d'])h.seats.push(holdemSeat(id,id,h.rules.initial));h.seats.forEach(s=>s.ready=true);h.friendlyMatch=newFriendlyMatch(4,'筹码');startHoldem(h,1);lockFriendlyMatch(h,1);assert.deepEqual(holdemView(h,'a').friendlyMatch,h.friendlyMatch);assert(holdemView(h,'a').seats.slice(1).every(s=>s.hand.length===0));
 h.phase='finished';h.seats[0].stack='0';rebuyHoldem(h,'a',3);assert.deepEqual(h.friendlyMatch!.totals,['0','0','0','0']);assert.equal(h.friendlyMatch!.rounds.length,0);
});
test('completed closed matches keep final landlord and Mahjong hand visibility; interrupted hands remain private',()=>{
 const g=newGame('a','甲');g.seats.push({...g.seats[0],id:'b',hand:[10,11]},{...g.seats[0],id:'c',hand:[12]});g.friendlyMatch=newFriendlyMatch(1,'积分');settleFriendlyMatch(g,{id:'won',ended:1,deltas:[2,-1,-1]});g.phase='closed';assert.deepEqual(view(g,'a').seats[1].hand,[10,11]);g.friendlyMatch!.status='interrupted';assert.deepEqual(view(g,'a').seats[1].hand,[]);
 const m=newModern('a','甲');m.seats.push(modernSeat('b','乙',m.initialChips),modernSeat('c','丙',m.initialChips),modernSeat('d','丁',m.initialChips));m.friendlyMatch=newFriendlyMatch(1,'筹码');dealModern(m,1);settleFriendlyMatch(m,{id:m.round,ended:2,deltas:['0','0','0','0']});m.phase='closed';assert.deepEqual(modernView(m,'a').seats[1].hand,m.seats[1].hand);assert(m.seats[1].hand.length>0);m.friendlyMatch!.status='interrupted';assert.deepEqual(modernView(m,'a').seats[1].hand,[]);
});

test('the completed final table retains confirmed royal roles instead of returning to waiting identities',()=>{
 const game={round:'final',phase:'closed',landlord:0,winner:1,friendlyMatch:{status:'finished'}};
 assert.equal(royalRole(game,0),'king');assert.equal(royalRole(game,1),'princess');
 game.friendlyMatch.status='interrupted';assert.equal(royalRole(game,0),null);
});
