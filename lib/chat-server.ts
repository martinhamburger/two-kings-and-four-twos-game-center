import {EMOTE_COOLDOWN_MS} from './emotes';
import {db} from './server';
import type {Room} from './rooms';
import {CHAT_LIMIT} from './chat-messages';
import type {ChatMessage} from './chat-bubbles';
export const chatColumns='id,client_id AS clientId,author_id AS senderId,display AS name,text,kind,emote_id AS emoteId,created,author_id=? AS own';

/** Caller authenticates and authorizes membership once, before sharing this reader. */
export async function readRoomMessages(room:Room,userId:string,after:string|null){
 const rowsQuery=after===null
  ?db().prepare(`SELECT ${chatColumns} FROM room_messages WHERE room_code=? ORDER BY id DESC LIMIT ?`).bind(userId,room.code,CHAT_LIMIT).all<ChatMessage>()
  :db().prepare(`SELECT ${chatColumns} FROM room_messages WHERE room_code=? AND id>? ORDER BY id LIMIT ?`).bind(userId,room.code,Number(after),CHAT_LIMIT+1).all<ChatMessage>();
 const [rows,latest]=await Promise.all([
  rowsQuery,
  db().prepare("SELECT created FROM room_messages WHERE author_id=? AND kind='emote' ORDER BY created DESC LIMIT 1").bind(userId).first<{created:number}>(),
 ]);
 const messages=after===null?rows.results.reverse():rows.results.slice(0,CHAT_LIMIT),hasMore=after!==null&&rows.results.length>CHAT_LIMIT;
 return {messages,cursor:messages.at(-1)?.id??Number(after??0),hasMore,serverNow:Date.now(),emoteReadyAt:(latest?.created??0)+EMOTE_COOLDOWN_MS,closed:room.phase==='closed'};
}
