import {db,json,requireUser,safe} from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(req:Request){return safe(async()=>{
 await requireUser(req,true);
 const cursor=Number(new URL(req.url).searchParams.get('before'));
 const rows=await db().prepare(`SELECT f.rowid AS cursor,f.id,f.content,f.created,u.display,u.username FROM player_feedback f JOIN users u ON u.id=f.user_id WHERE f.rowid<? ORDER BY f.rowid DESC LIMIT 51`).bind(Number.isSafeInteger(cursor)&&cursor>0?cursor:Number.MAX_SAFE_INTEGER).all<{cursor:number;id:string;content:string;created:number;display:string;username:string}>();
 const items=rows.results.slice(0,50);return json({items,next:rows.results.length>50?items.at(-1)?.cursor:null});
});}
