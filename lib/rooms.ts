import {settleDepartures} from './mahjong/departure';
import {isHoldem,timeoutHoldem,type HoldemGame} from './holdem/engine';
import {advanceHoldemBot} from './holdem/bot';
export {isHoldem} from './holdem/engine';
import {AppError,db} from './server';
import {type Game,view,timeout} from './game/engine';
import {isLandlordV3,timeoutV3,viewV3,type V3Game} from './game/landlord-v3';
import {type MahjongGame,timeoutMahjong,isModern} from './mahjong/game';
import {advanceBot,scheduleBots} from './practice/room';
import type {ReplayState} from './replay/types';
import {refreshReplayScene} from './replay/capture';
export type RoomGame=Game|V3Game|MahjongGame|HoldemGame;
export function isMahjong(g:RoomGame):g is MahjongGame{return 'kind' in g&&g.kind==='mahjong';}
export type Room={code:string;title:string;state:string;phase:string;revision:number;op:string;created:number;updated:number};
export async function getRoom(code:string){const r=await db().prepare('SELECT * FROM rooms WHERE code=?').bind(code).first<Room>();if(!r)throw new AppError('没有找到这个房间',404);return r;}
export async function roomView(r:Room,g:Game|V3Game,id:string){
 if(isLandlordV3(g))return{code:r.code,title:r.title,revision:r.revision,game:viewV3(g,id),serverNow:Date.now()};
 // Derive the table total from committed results, including older rooms and practice rounds.
 const scores=await db().prepare(`WITH totals AS (
  SELECT json_extract(s.value,'$.id') AS id,SUM(json_extract(s.value,'$.delta')) AS total
  FROM records r,json_each(r.result,'$.seats') s WHERE r.room_code=?
  GROUP BY json_extract(s.value,'$.id')
 ) SELECT json_extract(s.value,'$.id') AS id,u.score AS accountScore,COALESCE(t.total,0) AS tableScore
 FROM json_each(?) s LEFT JOIN users u ON u.id=json_extract(s.value,'$.id')
 LEFT JOIN totals t ON t.id=json_extract(s.value,'$.id')`).bind(r.code,JSON.stringify(g.seats.map(s=>({id:s.id})))).all<{id:string;accountScore:number|null;tableScore:number}>();
 const byId=new Map(scores.results.map(s=>[s.id,s])),visible=view(g,id);
 return{code:r.code,title:r.title,revision:r.revision,game:{...visible,seats:visible.seats.map(s=>({...s,accountScore:s.bot?null:byId.get(s.id)?.accountScore??null,tableScore:byId.get(s.id)?.tableScore??0}))},serverNow:Date.now()};
}
export async function commit(r:Room,g:RoomGame,extra?:(guard:string,op:string)=>D1PreparedStatement[]){const op=crypto.randomUUID(),now=Date.now();const departed=isMahjong(g)&&isModern(g)?settleDepartures(g,now):[];if(!isHoldem(g)&&(!isMahjong(g)||isModern(g)))scheduleBots(g,now);const guard='EXISTS (SELECT 1 FROM rooms WHERE code=? AND op=?)';
 const before=JSON.parse(r.state) as RoomGame;
 const beforeReplay=(before as RoomGame&{replay?:ReplayState}).replay;
 if(isLandlordV3(g))refreshReplayScene(g);
 const replay=(g as RoomGame&{replay?:ReplayState}).replay;
 const replayEndedAt=replay?.complete?replay.pending.at(-1)?.at??now:null;
 if(replay?.pending.length&&replay.game==='landlord'){
  if(!replay.tableScores){
   const totals=await db().prepare(`SELECT json_extract(s.value,'$.id') AS id,
    SUM(json_extract(s.value,'$.delta')) AS total
    FROM records r,json_each(r.result,'$.seats') s WHERE r.room_code=?
    GROUP BY json_extract(s.value,'$.id')`).bind(r.code).all<{id:string;total:number}>();
   const byId=new Map(totals.results.map(row=>[row.id,row.total]));
   replay.tableScores=g.seats.map(seat=>byId.get(seat.id)??0);
  }
  for(const frame of replay.pending)frame.scene.seats.forEach((seat,i)=>{
   seat.tableScore=replay.tableScores![i]+(frame.scene.phase==='finished'?Number(frame.scene.deltas?.[i]??0):0);
  });
 }
 if(replay&&!replay.complete){
  const seat=g.seats[g.turn];
  const seconds=isHoldem(g)?seat?.bot?1.2:g.rules.seconds:isMahjong(g)&&isModern(g)
   ?g.phase==='choosing'?g.rules.chooseSeconds:g.pending?g.rules.claimSeconds:g.seconds:g.seconds;
  replay.window=g.deadline>now&&seat&&['playing','bidding','doubling','shopping','equipment','choosing'].includes(g.phase)
   ?{actor:g.turn,openedAt:g.deadline-seconds*1000,deadline:g.deadline,phase:g.phase}:undefined;
 }
 const savedGame=replay?{...g,replay:{...replay,pending:[]}}:g;
 const savedState=JSON.stringify(savedGame);
 const statements=[db().prepare('UPDATE rooms SET state=?,phase=?,revision=revision+1,op=?,updated=? WHERE code=? AND revision=?').bind(savedState,g.phase,op,now,r.code,r.revision)];
 if(replay?.pending.length){
  const firstSeq=replay.nextSeq-replay.pending.length;
  if(firstSeq===0)statements.push(db().prepare(`INSERT INTO replay_rounds (id,room_code,game,participants,practice,created,ended) SELECT ?,?,?,?,?,?,? WHERE ${guard}`).bind(replay.roundId,r.code,replay.game,JSON.stringify(g.seats.filter(s=>!s.bot).map(s=>s.id)),'practice' in g&&g.practice?1:0,replay.pending[0].at,replayEndedAt,r.code,op));
  replay.pending.forEach((frame,i)=>statements.push(db().prepare(`INSERT INTO replay_frames (round_id,seq,frame) SELECT ?,?,? WHERE ${guard}`).bind(replay.roundId,firstSeq+i,JSON.stringify(frame),r.code,op)));
 }
 if(replay?.complete&&!beforeReplay?.complete){
  statements.push(db().prepare(`UPDATE replay_rounds SET ended=COALESCE(ended,?) WHERE id=? AND ${guard}`).bind(replayEndedAt,replay.roundId,r.code,op));
  statements.push(db().prepare(`INSERT OR IGNORE INTO replay_events (round_id,message_id,at,seat,kind,text,emote_id)
   SELECT ?,m.id,m.created,CAST(s.key AS INTEGER),m.kind,m.text,m.emote_id
   FROM room_messages m JOIN replay_rounds rr ON rr.id=?
   JOIN json_each(?, '$.seats') s ON json_extract(s.value,'$.id')=m.author_id
   WHERE m.room_code=? AND m.created>=rr.created AND m.created<=? AND m.kind IN ('text','emote') AND ${guard}`).bind(replay.roundId,replay.roundId,savedState,r.code,replayEndedAt,r.code,op));
 }
 if(isHoldem(g)){
 if(g.result&&g.result.id!==(isHoldem(before)?before.result?.id:undefined))statements.push(db().prepare(`INSERT INTO records (id,room_code,result,created) SELECT ?,?,?,? WHERE ${guard}`).bind(g.result.id,r.code,JSON.stringify(g.result),g.result.ended,r.code,op));
 }else if(isMahjong(g)&&isModern(g)){
 const prior=isMahjong(before)&&isModern(before)?before:null;
 const oldIds=new Set(prior?.entries.map(e=>e.id)||[]);
 for(const e of g.entries.filter(e=>!oldIds.has(e.id)))statements.push(db().prepare(`INSERT INTO chip_entries (id,room_code,round_id,kind,entry,created) SELECT ?,?,?,?,?,? WHERE ${guard}`).bind(e.id,r.code,e.round,e.kind,JSON.stringify(e),e.at,r.code,op));
 if(g.result&&g.result.id!==prior?.result?.id)statements.push(db().prepare(`INSERT INTO records (id,room_code,result,created) SELECT ?,?,?,? WHERE ${guard}`).bind(g.result.id,r.code,JSON.stringify(g.result),g.result.ended,r.code,op));
 }else if(isLandlordV3(g)){
 if(g.champion>=0&&(!isLandlordV3(before)||before.champion<0))statements.push(db().prepare(`INSERT INTO records (id,room_code,result,created) SELECT ?,?,?,? WHERE ${guard}`).bind(g.round, r.code,JSON.stringify({kind:'landlord-v3',...(g.practice?{practice:true}:{}),rules:g.rules,seats:g.seats.map((s,i)=>({id:s.id,name:s.name,bot:!!s.bot,coins:g.coins[i],victoryPoints:g.victoryPoints[i],equipment:g.equipment[i]})),winner:g.champion,rounds:g.roundHistory,log:g.log}),now,r.code,op));
 }else if(g.phase==='finished'&&before.phase!=='finished'){
 statements.push(db().prepare(`INSERT INTO records (id,room_code,result,created) SELECT ?,?,?,? WHERE ${guard}`).bind(g.round,r.code,JSON.stringify({...(g.practice?{practice:true}:{}),seats:g.seats.map((s,i)=>({id:s.id,name:s.name,bot:!!s.bot,delta:g.deltas[i]})),winner:g.winner,log:g.log,...(isMahjong(g)?{kind:'mahjong',rules:g.rules,winType:g.winType,source:g.source}:{kind:'landlord',landlord:g.landlord,bid:g.bid,multiplier:g.multiplier,spring:g.spring,rules:g.rules,doubles:g.doubles})}),now,r.code,op));
 if(!g.practice)g.seats.forEach((s,i)=>statements.push(db().prepare(`UPDATE users SET score=score+? WHERE id=? AND ${guard}`).bind(g.deltas[i],s.id,r.code,op)));
 }
 for(const id of departed)statements.push(db().prepare(`DELETE FROM members WHERE user_id=? AND room_code=? AND ${guard}`).bind(id,r.code,r.code,op));
 if(extra)statements.push(...extra(guard,op));
 let results;try{results=await db().batch(statements)}catch(e){if(String(e).includes('UNIQUE'))throw new AppError('你已在另一个房间，请先返回该房间',409);throw e;}
 if(!results[0].meta.changes)throw new AppError('牌桌已更新，请重试',409);
 if(replay)replay.pending=[];
 return{...r,state:savedState,phase:g.phase,revision:r.revision+1,op,updated:now};
}
export async function advance(r:Room){const g=JSON.parse(r.state) as RoomGame;const botChanged=isHoldem(g)?advanceHoldemBot(g):(!isMahjong(g)||isModern(g))&&advanceBot(g as Game);if(botChanged||(isHoldem(g)?timeoutHoldem(g):isMahjong(g)?timeoutMahjong(g):isLandlordV3(g)?timeoutV3(g):timeout(g as Game))){try{return await commit(r,g)}catch(e){if(e instanceof AppError&&e.status===409)return getRoom(r.code);throw e;}}return r;}
