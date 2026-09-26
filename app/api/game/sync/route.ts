import {AppError,json,requireUser,safe} from '@/lib/server';
import {advance,getRoom,isHoldem,isMahjong,roomView} from '@/lib/rooms';
import {readRoomMessages} from '@/lib/chat-server';
import type {Game} from '@/lib/game/engine';
export const dynamic='force-dynamic';

/** One authenticated read for game progress and the independently ordered chat feed. */
export async function GET(req:Request){return safe(async()=>{
 const user=await requireUser(req),params=new URL(req.url).searchParams;
 const code=params.get('room'),revision=params.get('revision'),after=params.get('after');
 if(!code||!/^\d{6}$/.test(code))throw new AppError('房间号无效');
 for(const [value,label] of [[revision,'牌桌版本'],[after,'消息游标']]){
  if(value!==null&&(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))))throw new AppError(label+'无效');
 }
 let room=await getRoom(code),game=JSON.parse(room.state) as Game;
 if(isMahjong(game)||isHoldem(game))throw new AppError('请从对应游戏入口进入',409);
 if(!game.seats.some(seat=>seat.id===user.id&&!seat.bot))throw new AppError('你不在这个房间',403);
 room=await advance(room);game=JSON.parse(room.state);
 if(!game.seats.some(seat=>seat.id===user.id&&!seat.bot))throw new AppError('你不在这个房间',403);
 const snapshot=revision!==null&&Number(revision)===room.revision?null:await roomView(room,game,user.id);
 const chat=await readRoomMessages(room,user.id,after);
 return json({room:snapshot,revision:room.revision,serverNow:Date.now(),chat});
});}
