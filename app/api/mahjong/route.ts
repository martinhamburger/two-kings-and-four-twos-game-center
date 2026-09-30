import {requestDeparture} from '@/lib/mahjong/departure';
import {AppError,body,config,db,json,limit,publicUser,requireUser,safe} from '@/lib/server';
import {advance,commit,getRoom,isMahjong,isHoldem,type Room} from '@/lib/rooms';
import {dealMahjong,moveMahjong,mahjongView,isModern,type MahjongGame} from '@/lib/mahjong/game';
import {newSeat} from '@/lib/mahjong/engine';
import {newModern,modernSeat,closeModern} from '@/lib/mahjong/modern';
import {HAM,MODERN_PRESETS,customMahjongRules} from '@/lib/mahjong/rules';
import {fillBots,addRoomBot,removeRoomBot,resetRosterReady,transferHumanHost} from '@/lib/practice/room';
import {practiceMode,soloPractice} from '@/lib/practice/types';
export const dynamic='force-dynamic';
function visible(r:Room,g:MahjongGame,id:string){return {code:r.code,title:r.title,revision:r.revision,serverNow:Date.now(),game:mahjongView(g,id)};}
export async function GET(req:Request){return safe(async()=>{
 const u=await requireUser(req),code=new URL(req.url).searchParams.get('room');
 if(code){let r=await getRoom(code);let g=JSON.parse(r.state);if(isHoldem(g))throw new AppError('这是德州扑克房间，请从德州入口进入',409);if(!isMahjong(g))throw new AppError('这是斗地主房间，请从斗地主入口进入',409);if(!g.seats.some(s=>s.id===u.id))throw new AppError('请先加入这个房间',403);r=await advance(r);g=JSON.parse(r.state);return json(visible(r,g,u.id));}
 const [c,member,records,tables]=await Promise.all([
  config(),db().prepare("SELECT room_code,COALESCE(json_extract(rooms.state,'$.kind'),'landlord') AS kind FROM members JOIN rooms ON rooms.code=members.room_code WHERE user_id=?").bind(u.id).first<{room_code:string;kind:string}>(),
  db().prepare("SELECT id,result,room_code,created FROM records WHERE json_extract(result,'$.kind')='mahjong' AND EXISTS(SELECT 1 FROM json_each(records.result,'$.seats') WHERE json_extract(value,'$.id')=?) ORDER BY created DESC LIMIT 12").bind(u.id).all(),
  db().prepare("SELECT code,title,updated,json_extract(state,'$.stats') AS stats FROM rooms WHERE phase='closed' AND json_extract(state,'$.kind')='mahjong' AND json_extract(state,'$.schemaVersion')=2 AND EXISTS(SELECT 1 FROM json_each(rooms.state,'$.seats') WHERE json_extract(value,'$.id')=?) ORDER BY updated DESC LIMIT 12").bind(u.id).all(),
 ]);
 return json({user:publicUser(u),config:c,rules:MODERN_PRESETS,activeRoom:member?.room_code||null,activeKind:member?.kind||null,tables:tables.results,records:records.results.map(r=>({...r,result:JSON.parse(r.result as string)}))});
});}
export async function POST(req:Request){return safe(async()=>{
 const u=await requireUser(req),b=await body(req);await limit('mahjong:'+u.id,180,1);
 if(b.action==='create'){
  const c=await config();if(c.maintenance)throw new AppError('暂时暂停开新桌，请稍后再来');
  const rules=MODERN_PRESETS.find(r=>r.id===(b.rulesId??HAM.id));if(!rules)throw new AppError('请选择当前可用的麻将规则');
  const title=typeof b.title==='string'&&b.title.trim()?b.title.trim():`${u.display} 的麻将桌`;if(title.length>24)throw new AppError('房间名最多 24 个字符');
  let g;try{g=newModern(u.id,u.display,c.seconds,customMahjongRules(rules,b.customRules),b.initialChips,b.baseChips);if(practiceMode(b.mode))fillBots(g);}catch(e){throw new AppError((e as Error).message);}
  const code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000),now=Date.now();
  try{await db().batch([
   db().prepare("INSERT INTO rooms (code,title,state,phase,revision,op,created,updated) VALUES (?,?,?,'waiting',0,?,?,?)").bind(code,title,JSON.stringify(g),crypto.randomUUID(),now,now),
   db().prepare('INSERT INTO members (user_id,room_code) VALUES (?,?)').bind(u.id,code),
  ]);}catch(e){if(String(e).includes('UNIQUE'))throw new AppError('你已有房间，或房间号重复，请回大厅后重试',409);throw e;}
  return json(visible(await getRoom(code),g,u.id));
 }
 if(typeof b.code!=='string'||!/^\d{6}$/.test(b.code))throw new AppError('请输入 6 位房间号');
 let r=await getRoom(b.code),g=JSON.parse(r.state) as MahjongGame;if(isHoldem(g)){if(b.action==='join')return json({redirect:'/holdem?room='+r.code});throw new AppError('请从德州入口进入',409);}
 if(!isMahjong(g)){if(b.action==='join')return json({redirect:'/?room='+r.code});throw new AppError('这是斗地主房间',409);}
 if(b.action==='join'){
  if(g.phase==='closed')throw new AppError('该房间已关闭');if(isModern(g)&&g.departedIds?.includes(u.id))throw new AppError('你已离开这桌，请创建或加入其他房间',403);if(g.seats.some(s=>s.id===u.id))return json(visible(r,g,u.id));
  if(soloPractice(g))throw new AppError('这是个人的人机测试房，不能加入其他玩家',403);
  if(g.phase!=='waiting'||g.seats.length>=4||(isModern(g)&&g.fixedIds.length))throw new AppError('该房间已满或已经开局');
  if((await config()).maintenance)throw new AppError('暂时暂停加入新桌');
  if(isModern(g)){g.seats.push(modernSeat(u.id,u.display,g.initialChips));resetRosterReady(g);}else g.seats.push(newSeat(u.id,u.display));
  r=await commit(r,g,(guard,op)=>[db().prepare(`INSERT INTO members (user_id,room_code) SELECT ?,? WHERE ${guard}`).bind(u.id,r.code,r.code,op)]);return json(visible(r,g,u.id));
 }
 const seat=g.seats.findIndex(s=>s.id===u.id);if(seat<0)throw new AppError('你不在这个房间',403);
 if(isModern(g)&&g.departedIds?.includes(u.id)&&b.action==='leave')return json({left:true});
 if(isModern(g)&&(g.departedIds?.includes(u.id)||g.leavingIds?.includes(u.id)&&!['leave','end_practice'].includes(b.action)))throw new AppError('你已申请离桌，本局由系统托管，结算后退出',403);
 if(b.revision!==r.revision)throw new AppError('牌桌已更新，请重试',409);
 if(b.action==='add_bot'||b.action==='remove_bot'){
  if(g.host!==u.id)throw new AppError('只有房主可以调整人机座位',403);
  if(!isModern(g))throw new AppError('旧版麻将房不支持添加人机，请新建基础试玩或 ham 规房间');
  try{if(b.action==='add_bot')addRoomBot(g);else removeRoomBot(g,b.botId);}catch(e){throw new AppError((e as Error).message);}
  r=await commit(r,g);return json(visible(r,g,u.id));
 }
 if(b.action==='ready'){
  if(!['waiting','finished'].includes(g.phase))throw new AppError('对局中不能修改准备状态');if(isModern(g)&&g.departedIds?.length)throw new AppError('有玩家已离桌，请由房主结束整桌后重新开桌');g.seats[seat].ready=!g.seats[seat].ready;if(g.seats.length===4&&g.seats.every(s=>s.ready))dealMahjong(g);
 }else if(b.action==='end_practice'){
  if(!isModern(g)||!soloPractice(g)||g.host!==u.id)throw new AppError('只有个人测试房的房主可以使用结束测试',403);
  closeModern(g,true,Date.now(),'practice');r=await commit(r,g,(guard,op)=>[db().prepare(`DELETE FROM members WHERE room_code=? AND ${guard}`).bind(r.code,r.code,op)]);return json(visible(r,g,u.id));
 }else if(b.action==='end_table'){
  if(!isModern(g))throw new AppError('旧房间请使用离桌');if(g.host!==u.id)throw new AppError('只有房主可以结束整桌',403);
  try{closeModern(g);}catch(e){throw new AppError((e as Error).message);}
  r=await commit(r,g,(guard,op)=>[db().prepare(`DELETE FROM members WHERE room_code=? AND ${guard}`).bind(r.code,r.code,op)]);return json(visible(r,g,u.id));
 }else if(b.action==='leave'){
  if(g.phase==='closed')return json({left:true});
  if(isModern(g)&&(g.fixedIds.length||soloPractice(g))){requestDeparture(g,u.id);r=await commit(r,g);return json({left:true,departurePending:!!g.leavingIds?.includes(u.id)});}
  if(!['waiting','finished'].includes(g.phase))throw new AppError('对局中不能离座；掉线后会按时限自动操作');
  g.seats.splice(seat,1);g.phase=g.seats.length?'waiting':'closed';g.seats.forEach(s=>{s.ready=false;s.hand=[];s.melds=[];s.river=[];s.last='';});g.host=g.seats[0]?.id||'';
  if(isModern(g))transferHumanHost(g);
  g.wall=[];g.pending=null;g.deadline=0;g.drawn=null;g.lastDiscard=null;g.winner=-1;g.source=-1;g.winType=null;g.deltas=[];g.dealer=0;g.turn=0;g.roundNumber=0;
  if(isModern(g)&&g.phase==='closed')g.ended=Date.now();
  await commit(r,g,(guard,op)=>[db().prepare(`DELETE FROM members WHERE user_id=? AND ${guard}`).bind(u.id,r.code,op)]);return json({left:true});
 }else if(['discard','claim','pass','hu','kong','confirm_win','flip_award'].includes(b.action)){
  if(!['playing','choosing','revealing'].includes(g.phase)||g.deadline<=Date.now()){await advance(r);throw new AppError('本次操作已结束或超时，请刷新牌桌',409);}
  try{moveMahjong(g,seat,b);}catch(e){throw new AppError((e as Error).message);}
 }else throw new AppError('未知操作');
 r=await commit(r,g);return json(visible(r,g,u.id));
});}
