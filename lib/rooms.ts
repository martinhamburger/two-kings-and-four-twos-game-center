import {settleDepartures} from './mahjong/departure';
import {isHoldem,timeoutHoldem,type HoldemGame} from './holdem/engine';
import {advanceHoldemBot} from './holdem/bot';
export {isHoldem} from './holdem/engine';
import {AppError,db} from './server';
import {type Game,view,timeout} from './game/engine';
import {isLandlordV3,timeoutV3,viewV3,type V3Game} from './game/landlord-v3';
import {type MahjongGame,timeoutMahjong,isModern} from './mahjong/game';
import {advanceBot,scheduleBots} from './practice/room';
import {interruptFriendlyMatch,lockFriendlyMatch,settleFriendlyMatch} from './friendly-match';
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
export async function commit(r:Room,g:RoomGame,extra?:(guard:string,op:string)=>D1PreparedStatement[]){const op=crypto.randomUUID(),now=Date.now(),before=JSON.parse(r.state) as RoomGame;
 const freshClassic=!isHoldem(g)&&!isLandlordV3(g)&&!(isMahjong(g)&&isModern(g))&&g.phase==='finished'&&before.phase!=='finished';
 const freshResult=isHoldem(g)?g.result&&g.result.id!==(isHoldem(before)?before.result?.id:undefined)?g.result:null:isMahjong(g)&&isModern(g)?g.result&&g.result.id!==(isMahjong(before)&&isModern(before)?before.result?.id:undefined)?g.result:null:null;
 if(!isLandlordV3(g)&&g.friendlyMatch){
  if(!['waiting','finished','closed'].includes(g.phase))lockFriendlyMatch(g,now);
  if(freshResult&&(!('type' in freshResult)||freshResult.type!=='aborted')&&(!('winType' in freshResult)||freshResult.winType!=='aborted'))settleFriendlyMatch(g,{id:freshResult.id,ended:freshResult.ended,deltas:freshResult.seats.map(s=>s.delta)},now);
  else if(freshClassic)settleFriendlyMatch(g,{id:g.round,ended:now,deltas:g.deltas},now);
 }
 const departed=isMahjong(g)&&isModern(g)?settleDepartures(g,now):[];
 if(!isLandlordV3(g)&&g.friendlyMatch){
  if(g.phase==='closed'||departed.length)interruptFriendlyMatch(g,departed.length?'有玩家离桌':'本场提前结束',now,!!departed.length);
  if(['finished','interrupted'].includes(g.friendlyMatch.status)){
   g.phase='closed';g.deadline=0;g.seats.forEach(s=>s.ready=false);
   if(isHoldem(g)||isMahjong(g)&&isModern(g))g.ended=now;
   if(isMahjong(g)){g.pending=null;if(isModern(g)){g.choice=null;g.reveal=null;}}
  }
 }
 if(!isHoldem(g)&&(!isMahjong(g)||isModern(g)))scheduleBots(g,now);
 const guard='EXISTS (SELECT 1 FROM rooms WHERE code=? AND op=?)',statements=[db().prepare('UPDATE rooms SET state=?,phase=?,revision=revision+1,op=?,updated=? WHERE code=? AND revision=?').bind(JSON.stringify(g),g.phase,op,now,r.code,r.revision)];
 const resultJSON=(result:unknown)=>JSON.stringify({...result as object,...(!isLandlordV3(g)&&g.friendlyMatch?{friendlyMatch:g.friendlyMatch}:{})});
 if(isHoldem(g)){
 if(freshResult)statements.push(db().prepare(`INSERT INTO records (id,room_code,result,created) SELECT ?,?,?,? WHERE ${guard}`).bind(freshResult.id,r.code,resultJSON(freshResult),freshResult.ended,r.code,op));
 }else if(isMahjong(g)&&isModern(g)){
 const prior=isMahjong(before)&&isModern(before)?before:null;
 const oldIds=new Set(prior?.entries.map(e=>e.id)||[]);
 for(const e of g.entries.filter(e=>!oldIds.has(e.id)))statements.push(db().prepare(`INSERT INTO chip_entries (id,room_code,round_id,kind,entry,created) SELECT ?,?,?,?,?,? WHERE ${guard}`).bind(e.id,r.code,e.round,e.kind,JSON.stringify(e),e.at,r.code,op));
 if(freshResult)statements.push(db().prepare(`INSERT INTO records (id,room_code,result,created) SELECT ?,?,?,? WHERE ${guard}`).bind(freshResult.id,r.code,resultJSON(freshResult),freshResult.ended,r.code,op));
 }else if(isLandlordV3(g)){
 if(g.champion>=0&&(!isLandlordV3(before)||before.champion<0))statements.push(db().prepare(`INSERT INTO records (id,room_code,result,created) SELECT ?,?,?,? WHERE ${guard}`).bind(g.round, r.code,JSON.stringify({kind:'landlord-v3',...(g.practice?{practice:true}:{}),rules:g.rules,seats:g.seats.map((s,i)=>({id:s.id,name:s.name,bot:!!s.bot,coins:g.coins[i],victoryPoints:g.victoryPoints[i],equipment:g.equipment[i]})),winner:g.champion,rounds:g.roundHistory,log:g.log}),now,r.code,op));
 }else if(freshClassic){
 statements.push(db().prepare(`INSERT INTO records (id,room_code,result,created) SELECT ?,?,?,? WHERE ${guard}`).bind(g.round,r.code,resultJSON({...(g.practice?{practice:true}:{}),seats:g.seats.map((s,i)=>({id:s.id,name:s.name,bot:!!s.bot,delta:g.deltas[i]})),winner:g.winner,log:g.log,...(isMahjong(g)?{kind:'mahjong',rules:g.rules,winType:g.winType,source:g.source}:{kind:'landlord',landlord:g.landlord,bid:g.bid,multiplier:g.multiplier,spring:g.spring,rules:g.rules,doubles:g.doubles})}),now,r.code,op));
 if(!g.practice)g.seats.forEach((s,i)=>statements.push(db().prepare(`UPDATE users SET score=score+? WHERE id=? AND ${guard}`).bind(g.deltas[i],s.id,r.code,op)));
 }
 for(const id of departed)statements.push(db().prepare(`DELETE FROM members WHERE user_id=? AND room_code=? AND ${guard}`).bind(id,r.code,r.code,op));
 if(!isLandlordV3(g)&&g.friendlyMatch&&g.phase==='closed')statements.push(db().prepare(`DELETE FROM members WHERE room_code=? AND ${guard}`).bind(r.code,r.code,op));
 if(extra)statements.push(...extra(guard,op));
 let results;try{results=await db().batch(statements)}catch(e){if(String(e).includes('UNIQUE'))throw new AppError('你已在另一个房间，请先返回该房间',409);throw e;}
 if(!results[0].meta.changes)throw new AppError('牌桌已更新，请重试',409);
 return{...r,state:JSON.stringify(g),phase:g.phase,revision:r.revision+1,op,updated:now};
}
export async function advance(r:Room){const g=JSON.parse(r.state) as RoomGame;const botChanged=isHoldem(g)?advanceHoldemBot(g):(!isMahjong(g)||isModern(g))&&advanceBot(g as Game);if(botChanged||(isHoldem(g)?timeoutHoldem(g):isMahjong(g)?timeoutMahjong(g):isLandlordV3(g)?timeoutV3(g):timeout(g as Game))){try{return await commit(r,g)}catch(e){if(e instanceof AppError&&e.status===409)return getRoom(r.code);throw e;}}return r;}
