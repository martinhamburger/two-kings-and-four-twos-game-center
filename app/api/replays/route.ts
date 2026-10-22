import {AppError,db,json,requireUser,safe} from '@/lib/server';

export const dynamic='force-dynamic';

export async function GET(req:Request){return safe(async()=>{
 const u=await requireUser(req);
 const rows=await db().prepare(`SELECT id,game,room_code AS roomCode,created,ended,practice
  FROM replay_rounds WHERE ended IS NOT NULL
   AND EXISTS(SELECT 1 FROM json_each(participants) WHERE value=?)
  ORDER BY ended DESC,id DESC LIMIT 100`).bind(u.id).all();
 if(!rows.results)throw new AppError('暂时无法读取回放',503);
 return json({items:rows.results});
});}
