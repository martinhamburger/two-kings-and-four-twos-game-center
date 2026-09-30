import {AppError,body,db,json,limit,requireUser,safe} from '@/lib/server';
import {getRoom} from '@/lib/rooms';
import {getEmote,canSendEmote,emoteText,EMOTE_COOLDOWN_MS} from '@/lib/emotes';
import {sameMessage} from '@/lib/chat-messages';
import type {ChatMessage} from '@/lib/chat-bubbles';
import {chatColumns as columns,readRoomMessages} from '@/lib/chat-server';
export const dynamic='force-dynamic';
async function member(code:unknown,id:string){
 if(typeof code!=='string'||!/^\d{6}$/.test(code))throw new AppError('房间号无效');
 const room=await getRoom(code),game=JSON.parse(room.state);
 if(!game.seats.some((s:{id:string;bot?:boolean})=>s.id===id&&!s.bot))throw new AppError('只有同桌玩家可以查看聊天',403);
 return room;
}
export async function GET(req:Request){return safe(async()=>{
 const user=await requireUser(req),params=new URL(req.url).searchParams,room=await member(params.get('room'),user.id),after=params.get('after');
 if(after!==null&&(!/^\d+$/.test(after)||!Number.isSafeInteger(Number(after))))throw new AppError('消息游标无效');
 return json(await readRoomMessages(room,user.id,after));
});}
export async function POST(req:Request){return safe(async()=>{
 const user=await requireUser(req),b=await body(req),room=await member(b.code,user.id);
 if(JSON.parse(room.state).departedIds?.includes(user.id))throw new AppError('你已离开房间，聊天记录只读',403);
 const kind=b.kind??'text';if(kind!=='text'&&kind!=='emote')throw new AppError('消息类型无效');
 if(kind==='emote'&&(!getEmote(b.emoteId)?.enabled||b.text!==undefined))throw new AppError('这个表情暂不可用');
 if(kind==='text'&&b.emoteId!==undefined)throw new AppError('消息格式无效');
 const text=kind==='emote'?emoteText(b.emoteId):typeof b.text==='string'?b.text.trim():'';
 if(!text||text.length>500||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))throw new AppError('请输入 1–500 个字的聊天内容');
 if(typeof b.clientId!=='string'||!/^[-a-f0-9]{36}$/.test(b.clientId))throw new AppError('消息标识无效');
 const expected={kind,emoteId:kind==='emote'?b.emoteId:null,text};
 const find=()=>db().prepare(`SELECT ${columns} FROM room_messages WHERE room_code=? AND author_id=? AND client_id=?`).bind(user.id,room.code,user.id,b.clientId).first<ChatMessage>();
 const receipt=(message:ChatMessage)=>json({sent:true,id:message.id,created:message.created,message,serverNow:Date.now(),emoteReadyAt:message.kind==='emote'?message.created+EMOTE_COOLDOWN_MS:0});
 const existing=await find();
 if(existing){if(!sameMessage(existing,expected))throw new AppError('这条消息已发送，请勿重复修改',409);return receipt(existing);}
 if(kind==='emote'&&!canSendEmote(b.emoteId))throw new AppError('这款表情已退出发送面板，历史消息仍可查看');
 if(room.phase==='closed')throw new AppError('牌桌已结束，聊天记录只读');
 const now=Date.now();
 if(kind==='emote'){
  const recent=await db().prepare("SELECT created FROM room_messages WHERE author_id=? AND kind='emote' AND created>? ORDER BY created DESC LIMIT 1").bind(user.id,now-EMOTE_COOLDOWN_MS).first<{created:number}>();
  if(recent){const retried=await find();if(retried){if(!sameMessage(retried,expected))throw new AppError('这条消息已发送，请勿重复修改',409);return receipt(retried);}return json({error:'慢一点，3 秒可以发一次表情',retryAfterMs:recent.created+EMOTE_COOLDOWN_MS-now},429);}
 }
 await limit('chat:'+user.id,20,1);
 // Cooldown and insertion are one SQLite write. Chat never changes game state or timers.
 await db().prepare(`INSERT INTO room_messages (room_code,author_id,client_id,display,text,kind,emote_id,created)
 SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM rooms r,json_each(r.state,'$.seats') s WHERE r.code=? AND r.phase!='closed' AND json_extract(s.value,'$.id')=? AND COALESCE(json_extract(s.value,'$.bot'),0)=0 AND NOT EXISTS(SELECT 1 FROM json_each(r.state,'$.departedIds') d WHERE d.value=json_extract(s.value,'$.id')))
 AND (?!='emote' OR NOT EXISTS(SELECT 1 FROM room_messages WHERE author_id=? AND kind='emote' AND created>?))
 ON CONFLICT(room_code,author_id,client_id) DO NOTHING`).bind(room.code,user.id,b.clientId,user.display,text,kind,expected.emoteId,now,room.code,user.id,kind,user.id,now-EMOTE_COOLDOWN_MS).run();
 const sent=await find();
 if(!sent){await member(room.code,user.id);const current=await getRoom(room.code);if(current.phase==='closed')throw new AppError('牌桌已结束，聊天记录只读',409);if(kind==='emote')return json({error:'慢一点，3 秒可以发一次表情',retryAfterMs:EMOTE_COOLDOWN_MS},429);throw new AppError('你已离开房间，或牌桌已结束',409);}
 if(!sameMessage(sent,expected))throw new AppError('这条消息已发送，请勿重复修改',409);
 return receipt(sent);
});}
