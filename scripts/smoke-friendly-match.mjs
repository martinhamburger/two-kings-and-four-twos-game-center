import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {globSync} from 'node:fs';
import {bid,doubleChoice,hintsFor,play} from '../lib/game/engine.ts';
import {modernOptions,moveModern} from '../lib/mahjong/modern.ts';
import {moveHoldem} from '../lib/holdem/engine.ts';

// These fixtures use only the disposable database created by smoke-local.mjs.
// Rooms, players and the first deal are real API operations. To avoid hundreds
// of HTTP turns, engines prepare a legal predecessor; a real POST settles it.
export async function verifyFriendlyMatchApis({request,signup,state,outsider}){
 const path=globSync(state+'/v3/d1/miniflare-D1DatabaseObject/*.sqlite').find(p=>!p.endsWith('metadata.sqlite'));
 assert(path,'Friendly-match smoke requires the isolated local D1 database');
 const withDb=fn=>{const db=new DatabaseSync(path);db.exec('PRAGMA busy_timeout=5000');try{return fn(db);}finally{db.close();}};
 const rawRoom=code=>withDb(db=>{const row=db.prepare('SELECT state,revision FROM rooms WHERE code=?').get(code);return{game:JSON.parse(row.state),revision:row.revision};});
 const storePredecessor=(code,game)=>withDb(db=>{
  assert.notEqual(game.phase,'finished');assert.notEqual(game.phase,'closed');
  // Prevent timeouts from racing the intended final POST, without changing cards.
  game.deadline=Date.now()+60_000;
  db.prepare('UPDATE rooms SET state=?,phase=?,revision=revision+1 WHERE code=?').run(JSON.stringify(game),game.phase,code);
 });
 const accountScores=players=>withDb(db=>players.map(p=>db.prepare('SELECT score FROM users WHERE id=?').get(p.data.user.id).score));
 // Completed cases release their seats, so reuse four real accounts across
 // scenarios instead of exhausting the production auth-IP quota in one run.
 const playerPool=[];
 const createPlayers=async(count,prefix)=>{while(playerPool.length<count)playerPool.push(await signup('fm'+prefix+playerPool.length+crypto.randomUUID().slice(0,8)));return playerPool.slice(0,count);};
 const summaryIsPublic=m=>{
  assert(m);assert.equal(m.version,1);
  assert.deepEqual(Object.keys(m.roster[0]).sort(),['bot','id','name']);
  for(const round of m.rounds){assert.deepEqual(Object.keys(round).sort(),['deltas','ended','id']);assert(round.deltas.every(d=>typeof d==='string'&&/^-?\d+$/.test(d)));}
  for(const key of ['hand','hands','wall','deck','pending','choice','password'])assert.equal(key in m,false);
 };
 const joinAndStart=async(endpoint,players,options)=>{
  let room=(await request(endpoint,{action:'create',title:'友谊赛接口验收',...options},players[0].cookie)).data;
  for(const player of players.slice(1))room=(await request(endpoint,{action:'join',code:room.code},player.cookie)).data;
  for(const player of players)room=(await request(endpoint,{action:'ready',code:room.code,revision:room.revision},player.cookie)).data;
  assert.equal(room.game.friendlyMatch.status,'playing');
  assert.deepEqual(room.game.friendlyMatch.roster.map(s=>s.id),players.map(p=>p.data.user.id));
  assert.deepEqual(room.game.friendlyMatch.totals,players.map(()=>'0'));
  assert(room.game.seats.filter(s=>s.id!==players.at(-1).data.user.id).every(s=>s.hand.length===0),'The first deal must not reveal opponents hands');
  return room;
 };
 const record=code=>withDb(db=>{
  const rows=db.prepare('SELECT id,result FROM records WHERE room_code=?').all(code);assert.equal(rows.length,1,'One committed terminal action creates exactly one round');
  return{id:rows[0].id,result:JSON.parse(rows[0].result)};
 });
 const verifyClosed=async(endpoint,room,players,expected,outsiderPlayer=outsider)=>{
  assert.equal(room.game.phase,'closed');assert.equal(room.game.friendlyMatch.status,'finished');
  assert.equal(room.game.friendlyMatch.rounds.length,1);summaryIsPublic(room.game.friendlyMatch);
  assert.deepEqual(room.game.friendlyMatch.totals,expected.map(String));
  assert.equal(withDb(db=>db.prepare('SELECT COUNT(*) n FROM members WHERE room_code=?').get(room.code).n),0);
  const saved=record(room.code);assert.equal(saved.id,room.game.friendlyMatch.rounds[0].id);
  assert.deepEqual(saved.result.friendlyMatch,room.game.friendlyMatch,'Original round includes the settled match summary');
  for(const player of players)assert.equal((await request('/api/lobby',undefined,player.cookie)).data.activeRoom,null);
  await request(endpoint,{action:'ready',code:room.code,revision:room.revision},players[0].cookie,400);
  const again=(await request(endpoint+'?room='+room.code,undefined,players[0].cookie)).data;
  assert.deepEqual(again.game.friendlyMatch,room.game.friendlyMatch);record(room.code);
  const report=(await request('/api/history?room='+room.code,undefined,players[0].cookie)).data;
  assert.equal(report.points.length,2);assert.deepEqual(report.points[1].values,expected.map(String));
  assert.equal(JSON.stringify(report).includes('"hand"'),false);
  const original=(await request('/api/history?id='+saved.id,undefined,players[0].cookie)).data;
  assert.deepEqual(original.result.friendlyMatch,room.game.friendlyMatch);
  if(outsiderPlayer){await request('/api/history?room='+room.code,undefined,outsiderPlayer.cookie,403);await request('/api/history?id='+saved.id,undefined,outsiderPlayer.cookie,404);}
 };

 // Creation validates the contract before creating any room/member rows.
 for(const endpoint of ['/api/game','/api/mahjong','/api/holdem']){
  const owner=(await createPlayers(1,'param'))[0];
  for(const value of [-1,2,3,5,13,'4',null,true,{},[]])await request(endpoint,{action:'create',friendlyRounds:value},owner.cookie,400);
  for(const value of [undefined,0,1,4,8,12]){
   const payload={action:'create',...(value===undefined?{}:{friendlyRounds:value})};
   const room=(await request(endpoint,payload,owner.cookie)).data;
   if(value){assert.equal(room.game.friendlyMatch.target,value);assert.equal(room.game.friendlyMatch.status,'waiting');assert.deepEqual(room.game.friendlyMatch.rounds,[]);}
   else assert.equal(room.game.friendlyMatch,undefined,'Legacy/default free rooms have no match restriction');
   await request(endpoint,{action:'end_table',code:room.code,revision:room.revision},owner.cookie);
   const persisted=rawRoom(room.code).game;
   if(value){assert.equal(persisted.friendlyMatch.status,'interrupted');assert.equal(persisted.friendlyMatch.rounds.length,0);}
   else assert.equal(persisted.friendlyMatch,undefined);
   assert.equal(withDb(db=>db.prepare('SELECT COUNT(*) n FROM records WHERE room_code=?').get(room.code).n),0);
  }
 }
 const skillOwner=(await createPlayers(1,'skill'))[0];
 await request('/api/game',{action:'create',rules:{id:'landlord-v3'},friendlyRounds:4},skillOwner.cookie,400);
 const skill=(await request('/api/game',{action:'create',rules:{id:'landlord-v3'},friendlyRounds:0},skillOwner.cookie)).data;
 assert.equal(skill.game.friendlyMatch,undefined);
 await request('/api/game',{action:'end_table',code:skill.code,revision:skill.revision},skillOwner.cookie);

 function prepareLandlord(game){
  bid(game,game.turn,3);
  while(game.phase==='doubling')doubleChoice(game,game.doubles.findIndex(v=>v===null),false);
  for(let turns=0;turns<600;turns++){
   const seat=game.turn,options=hintsFor(game,game.seats[seat].hand,game.last?.combo??null).sort((a,b)=>b.length-a.length),cards=options[0]??[];
   const before=structuredClone(game);play(game,seat,cards);
   if(game.phase==='finished')return{before,expected:game.deltas,move:{action:cards.length?'play':'pass',cards},seat};
  }
  throw Error('Landlord fixture did not reach a legal terminal action');
 }
 for(const capacity of [3,4]){
  const players=await createPlayers(capacity,'ddz'+capacity),scores=accountScores(players);
  const room=await joinAndStart('/api/game',players,{friendlyRounds:1,...(capacity===4?{rules:{id:'landlord-four-v1'}}:{})});
  const prepared=prepareLandlord(rawRoom(room.code).game);storePredecessor(room.code,prepared.before);
  const revision=rawRoom(room.code).revision,payload={...prepared.move,code:room.code,revision};
  // Both requests carry the same last move/revision. The losing request must
  // fail the CAS; the successful batch alone changes scores and records.
  const raced=await Promise.allSettled([1,2].map(()=>request('/api/game',payload,players[prepared.seat].cookie)));
  assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);
  const rejected=raced.find(r=>r.status==='rejected');assert.equal(rejected.reason.actual,409);
  const final=raced.find(r=>r.status==='fulfilled').value.data;
  await verifyClosed('/api/game',final,players,prepared.expected);
  assert.deepEqual(accountScores(players),scores.map((score,i)=>score+prepared.expected[i]),'Concurrent final moves apply account points once');
  await request('/api/game',payload,players[prepared.seat].cookie,409);
  assert.deepEqual(accountScores(players),scores.map((score,i)=>score+prepared.expected[i]));
 }

 // One genuinely dealt BASIC hand is advanced using only legal discard/pass
 // engine actions; no fabricated winning cards or final status are inserted.
 const mjPlayers=await createPlayers(4,'mj'),mjRoom=await joinAndStart('/api/mahjong',mjPlayers,{friendlyRounds:1,rulesId:'basic-136-v2'});
 const mj=rawRoom(mjRoom.code).game;let mjFinal;
 for(let turns=0;turns<800;turns++){
  const seat=mj.pending?mj.pending.eligible.find(i=>!Object.hasOwn(mj.pending.responses,String(i))):mj.turn;
  assert.notEqual(seat,undefined);
  const options=modernOptions(mj,seat),move=mj.pending?{action:'pass'}:{action:'discard',tile:options.discardable.includes(mj.drawn)?mj.drawn:options.discardable.at(-1)};
  const before=structuredClone(mj);moveModern(mj,seat,move);
  if(mj.phase==='finished'){mjFinal={before,seat,move,expected:mj.deltas};break;}
 }
 assert(mjFinal,'Mahjong fixture must reach a real draw');assert.equal(mj.winType,'draw');
 storePredecessor(mjRoom.code,mjFinal.before);
 const mjEnded=(await request('/api/mahjong',{...mjFinal.move,code:mjRoom.code,revision:rawRoom(mjRoom.code).revision},mjPlayers[mjFinal.seat].cookie)).data;
 await verifyClosed('/api/mahjong',mjEnded,mjPlayers,mjFinal.expected);
 assert.equal(mjEnded.game.result.winType,'draw','A draw counts as a completed match round');

 const thPlayers=await createPlayers(4,'th'),thRoom=await joinAndStart('/api/holdem',thPlayers,{friendlyRounds:1,capacity:4}),thScores=accountScores(thPlayers);
 const th=rawRoom(thRoom.code).game;let thFinal;
 for(let turns=0;turns<4;turns++){
  const before=structuredClone(th),seat=th.turn;moveHoldem(th,th.seats[seat].id,{action:'fold'});
  if(th.phase==='finished'){thFinal={before,seat,expected:th.result.seats.map(s=>s.delta)};break;}
 }
 assert(thFinal);storePredecessor(thRoom.code,thFinal.before);
 const thEnded=(await request('/api/holdem',{action:'fold',code:thRoom.code,revision:rawRoom(thRoom.code).revision},thPlayers[thFinal.seat].cookie)).data;
 await verifyClosed('/api/holdem',thEnded,thPlayers,thFinal.expected);
 assert.deepEqual(accountScores(thPlayers),thScores,'Holdem match does not modify landlord account points');

 // A longer match really reaches the inter-round state. The same roster stays
 // fixed, and an intentional early finish preserves the played points.
 const partialPlayers=await createPlayers(3,'partial'),partialRoom=await joinAndStart('/api/game',partialPlayers,{friendlyRounds:4});
 const partial=prepareLandlord(rawRoom(partialRoom.code).game);storePredecessor(partialRoom.code,partial.before);
 const played=(await request('/api/game',{...partial.move,code:partialRoom.code,revision:rawRoom(partialRoom.code).revision},partialPlayers[partial.seat].cookie)).data;
 assert.equal(played.game.phase,'finished');assert.equal(played.game.friendlyMatch.status,'playing');assert.equal(played.game.friendlyMatch.rounds.length,1);
 assert.deepEqual(played.game.friendlyMatch.totals,partial.expected.map(String));
 await request('/api/game',{action:'add_bot',code:played.code,revision:played.revision},partialPlayers[0].cookie,400);
 await request('/api/game',{action:'join',code:played.code},outsider.cookie,400);
 await request('/api/game',{action:'end_table',code:played.code,revision:played.revision},partialPlayers[0].cookie);
 const interrupted=rawRoom(played.code).game;
 assert.equal(interrupted.friendlyMatch.status,'interrupted');assert.deepEqual(interrupted.friendlyMatch.totals,partial.expected.map(String));
 assert.equal(interrupted.friendlyMatch.rounds.length,1);record(played.code);
 const partialReport=(await request('/api/history?room='+played.code,undefined,partialPlayers[0].cookie)).data;
 assert.deepEqual(partialReport.points.at(-1).values,partial.expected.map(String));
}
