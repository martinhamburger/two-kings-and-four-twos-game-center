import {AppError,db,json,requireUser,safe} from '@/lib/server';
import type {ReplayEvent,ReplayFrame} from '@/lib/replay/types';

export const dynamic='force-dynamic';

type ReplayRow={id:string;game:string;room_code:string;participants:string;created:number;ended:number|null;practice:number};
type TvRow={submitted_by:string;withdrawn_at:number|null;anonymous:number;poster:string;reason:string};

export const GET=(req:Request,{params}:{params:Promise<{id:string}>})=>safe(async()=>{
 const u=await requireUser(req),{id}=await params;
 if(!/^[a-f0-9-]{36}$/i.test(id))throw new AppError('回放不存在',404);
 const [round,tv]=await Promise.all([
  db().prepare('SELECT id,game,room_code,participants,created,ended,practice FROM replay_rounds WHERE id=?').bind(id).first<ReplayRow>(),
  db().prepare('SELECT t.submitted_by,t.withdrawn_at,t.anonymous,t.reason,u.display AS poster FROM replay_tv t JOIN users u ON u.id=t.submitted_by WHERE t.replay_id=?').bind(id).first<TvRow>()
 ]);
 if(!round||round.ended===null)throw new AppError('回放尚未完成或不存在',404);
 const participant=(JSON.parse(round.participants) as string[]).includes(u.id);
 const published=!!tv&&tv.withdrawn_at===null;
 if(!participant&&!published)throw new AppError('你不能查看这场回放',403);
 const rows=await db().prepare('SELECT frame FROM replay_frames WHERE round_id=? ORDER BY seq').bind(id).all<{frame:string}>();
 if(!rows.results.length)throw new AppError('这场对局没有可播放的步骤',404);
 const frames=rows.results.map(row=>JSON.parse(row.frame) as ReplayFrame);
 const tvView=new URL(req.url).searchParams.get('view')==='tv';
 const perspectiveId=published&&(tvView||!participant)?tv.submitted_by:u.id;
 const perspective=frames[0].scene.seats.findIndex(seat=>seat.id===perspectiveId);
 const eventRows=await db().prepare(`SELECT message_id AS id,at,seat,kind,text,emote_id AS emoteId
  FROM replay_events WHERE round_id=? ORDER BY at,message_id`).bind(id).all<ReplayEvent>();
 const events=eventRows.results.filter(event=>event.kind==='text'||event.kind==='emote').map(event=>({
  id:event.id,at:event.at,seat:event.seat,kind:event.kind,
  ...(event.kind==='text'?{text:event.text}:{}),...(event.kind==='emote'?{emoteId:event.emoteId}:{})
 }));
 return json({id,game:round.game,roomCode:participant?round.room_code:undefined,created:round.created,ended:round.ended,practice:!!round.practice,frames,
  perspective:perspective<0?0:perspective,events,
  tv:{status:published?'published':'none',poster:published?(tv.anonymous?'匿名玩家':tv.poster):undefined,reason:published?tv.reason:undefined,canManage:participant&&(tv===null||published&&tv.submitted_by===u.id)}});
});
