import {AppError,body,config,db,json,limit,publicUser,requireUser,safe} from '@/lib/server';
import {advance,commit,getRoom,type Room} from '@/lib/rooms';
import {isHoldem,holdemRules,newHoldem,holdemSeat,holdemView,startHoldem,moveHoldem,setHoldemTimeoutChoice,rebuyHoldem,closeHoldem,type HoldemGame} from '@/lib/holdem/engine';
import {assertFriendlyReady,assertFriendlyRosterEditable,newFriendlyMatch,interruptFriendlyMatch} from '@/lib/friendly-match';
export const dynamic='force-dynamic';
const visible=(r:Room,g:HoldemGame,id:string)=>({code:r.code,title:r.title,revision:r.revision,serverNow:Date.now(),game:holdemView(g,id)});
export async function GET(req:Request){return safe(async()=>{
 const u=await requireUser(req),code=new URL(req.url).searchParams.get('room');
 if(code){let r=await getRoom(code),g=JSON.parse(r.state);if(!isHoldem(g))throw new AppError('请从对应的游戏入口进入',409);if(!g.seats.some(s=>s.id===u.id))throw new AppError('请先加入房间',403);r=await advance(r);g=JSON.parse(r.state);return json(visible(r,g,u.id));}
 const [c,m,records,tables]=await Promise.all([config(),db().prepare("SELECT room_code,COALESCE(json_extract(state,'$.kind'),'landlord') AS kind FROM members JOIN rooms ON rooms.code=room_code WHERE user_id=?").bind(u.id).first<{room_code:string;kind:string}>(),db().prepare("SELECT result,room_code FROM records WHERE json_extract(result,'$.kind')='holdem' AND EXISTS(SELECT 1 FROM json_each(result,'$.seats') WHERE json_extract(value,'$.id')=?) ORDER BY created DESC LIMIT 12").bind(u.id).all(),db().prepare("SELECT code,title,state FROM rooms WHERE phase='closed' AND json_extract(state,'$.kind')='holdem' AND EXISTS(SELECT 1 FROM json_each(state,'$.seats') WHERE json_extract(value,'$.id')=?) ORDER BY updated DESC LIMIT 12").bind(u.id).all()]);
 return json({tables:tables.results.map(r=>{const g=JSON.parse(r.state as string) as HoldemGame,s=g.seats.find(s=>s.id===u.id)!;return {code:r.code,title:r.title,rounds:g.roundNumber,ended:g.ended,brought:s.brought,stack:s.stack,net:(BigInt(s.stack)-BigInt(s.brought)).toString()}}),user:publicUser(u),config:c,activeRoom:m?.room_code,activeKind:m?.kind,records:records.results.map(x=>({...x,result:JSON.parse(x.result as string)}))});
});}
export async function POST(req:Request){return safe(async()=>{
 const u=await requireUser(req),b=await body(req);await limit('holdem:'+u.id,180,1);
 if(b.action==='create'){
  const c=await config();if(c.maintenance)throw new AppError('暂时暂停开新桌');let g:HoldemGame;try{g=newHoldem(u.id,u.display,holdemRules({...b,seconds:b.seconds??c.seconds}));g.friendlyMatch=newFriendlyMatch(b.friendlyRounds,'筹码');}catch(e){throw new AppError((e as Error).message);}
  const title=typeof b.title==='string'&&b.title.trim()?b.title.trim():u.display+' 的德州桌';if(title.length>24)throw new AppError('房间名最多 24 字');
  const code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000),now=Date.now();
  if(b.mode!==undefined&&!['friends','practice'].includes(b.mode))throw new AppError('房间模式无效');if(b.mode==='practice')while(g.seats.length<g.rules.capacity)addBot(g);
  try{await db().batch([db().prepare("INSERT INTO rooms (code,title,state,phase,revision,op,created,updated) VALUES (?,?,?,'waiting',0,?,?,?)").bind(code,title,JSON.stringify(g),crypto.randomUUID(),now,now),db().prepare('INSERT INTO members (user_id,room_code) VALUES (?,?)').bind(u.id,code)]);}catch(e){if(String(e).includes('UNIQUE'))throw new AppError('你已有房间，或房间号重复，请返回大厅后重试',409);throw e;}
  return json(visible(await getRoom(code),g,u.id));
 }
 if(typeof b.code!=='string'||!/^\d{6}$/.test(b.code))throw new AppError('请输入 6 位房间号');let r=await getRoom(b.code);const g=JSON.parse(r.state);if(!isHoldem(g)){if(b.action==='join')return json({redirect:(g.kind==='mahjong'?'/mahjong':'/')+'?room='+r.code});throw new AppError('这不是德州扑克房间',409);}
 if(b.action==='join'){
  if(g.phase==='closed')throw new AppError('房间已结束');if(g.seats.some(s=>s.id===u.id))return json(visible(r,g,u.id));if(g.fixed||g.phase!=='waiting'||g.seats.length>=g.rules.capacity)throw new AppError('本桌已满或已开局');if((await config()).maintenance)throw new AppError('暂时暂停加入新桌');
  try{assertFriendlyRosterEditable(g);}catch(e){throw new AppError((e as Error).message);}
  g.seats.push(holdemSeat(u.id,u.display,g.rules.initial));g.seats.forEach(s=>s.ready=s.bot);r=await commit(r,g,(guard,op)=>[db().prepare(`INSERT INTO members (user_id,room_code) SELECT ?,? WHERE ${guard}`).bind(u.id,r.code,r.code,op)]);return json(visible(r,g,u.id));
 }
 const s=g.seats.find(s=>s.id===u.id);if(!s)throw new AppError('你不在这个房间',403);if(b.revision!==r.revision)throw new AppError('牌桌已更新，请重试',409);
 try{
  if(b.action==='timeout_choice'){
   if(g.deadline<=Date.now()){await advance(r);throw new AppError('操作已超时，请刷新牌桌',409);}
   setHoldemTimeoutChoice(g,u.id,b.choice,{round:b.round,street:b.street,bet:b.bet,stack:b.stack});
  }else if(b.action==='ready'){
   assertFriendlyReady(g);
   if(!['waiting','finished'].includes(g.phase))throw Error('对局中不能准备');if(s.stack==='0')throw Error('请先补入筹码');s.ready=!s.ready;
   for(const bot of g.seats.filter(x=>x.bot)){if(bot.stack==='0')rebuyHoldem(g,bot.id);bot.ready=true;}
   if(g.seats.length===g.rules.capacity&&g.seats.every(x=>x.ready&&x.stack!=='0'))startHoldem(g);
  }else if(b.action==='rebuy')rebuyHoldem(g,u.id);
  else if(b.action==='add_bot'||b.action==='remove_bot'){
   if(g.host!==u.id)throw new AppError('只有房主能调整人机座位',403);assertFriendlyRosterEditable(g);if(g.fixed||g.phase!=='waiting')throw Error('只能在首局开始前调整座位');
   if(b.action==='add_bot')addBot(g);else{const i=g.seats.findIndex(x=>x.id===b.botId&&x.bot);if(i<0)throw Error('人机座位无效');g.seats.splice(i,1);}g.seats.forEach(x=>x.ready=x.bot);
  }else if(b.action==='end_table'){
   if(g.host!==u.id)throw new AppError('只有房主能结束整桌',403);closeHoldem(g);r=await commit(r,g,(guard,op)=>[db().prepare(`DELETE FROM members WHERE room_code=? AND ${guard}`).bind(r.code,r.code,op)]);return json(visible(r,g,u.id));
  }else if(b.action==='leave'){
   if(g.friendlyMatch?.startedAt!==undefined&&g.phase==='finished'){interruptFriendlyMatch(g,'有玩家离桌');closeHoldem(g);await commit(r,g);return json({left:true});}
   if(g.phase==='closed')return json({left:true});if(g.fixed)throw Error('本桌已固定玩家，请让房主在局间结束整桌后离开');if(g.phase!=='waiting')throw Error('对局中不能离座');g.seats=g.seats.filter(x=>x.id!==u.id);g.host=g.seats.find(x=>!x.bot)?.id??'';g.seats.forEach(x=>x.ready=x.bot);if(!g.host)closeHoldem(g);
   r=await commit(r,g,(guard,op)=>[db().prepare(`DELETE FROM members WHERE user_id=? AND ${guard}`).bind(u.id,r.code,op)]);return json({left:true});
  }else {if(g.deadline<=Date.now()){await advance(r);throw new AppError('操作已超时，请刷新牌桌',409);}moveHoldem(g,u.id,b);}
 }catch(e){if(e instanceof AppError)throw e;throw new AppError((e as Error).message);}
 r=await commit(r,g);return json(visible(r,g,u.id));
});}
function addBot(g:HoldemGame){if(g.seats.length>=g.rules.capacity)throw new AppError('座位已满');const names=['小满','阿竹','阿青','阿松','阿棠','小夏','阿禾','小秋','阿栗'];g.seats.push(holdemSeat('bot:'+crypto.randomUUID(),names.find(name=>!g.seats.some(s=>s.name===name))??'陪练',g.rules.initial,true));}
