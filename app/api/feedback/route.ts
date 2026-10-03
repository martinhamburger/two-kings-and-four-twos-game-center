import {AppError,body,db,json,limit,requireUser,safe} from '@/lib/server';
import {feedbackDay,feedbackText,FEEDBACK_DAILY_LIMIT} from '@/lib/club/feedback';
export const dynamic='force-dynamic';
async function quota(userId:string,day:string){
 const row=await db().prepare('SELECT COUNT(*) AS used FROM player_feedback WHERE user_id=? AND day=?').bind(userId,day).first<{used:number}>();
 return {day,used:row?.used??0,remaining:Math.max(0,FEEDBACK_DAILY_LIMIT-(row?.used??0))};
}
export async function GET(req:Request){return safe(async()=>{const u=await requireUser(req);return json(await quota(u.id,feedbackDay()));});}
export async function POST(req:Request){return safe(async()=>{
 const u=await requireUser(req),b=await body(req);
 await limit('feedback-request:'+u.id,30,1);
 let content:string;try{content=feedbackText(b?.content);}catch(e){throw new AppError((e as Error).message);}
 if(typeof b.clientId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(b.clientId))throw new AppError('反馈标识无效');
 const now=Date.now(),day=feedbackDay(now),clientId=b.clientId.toLowerCase();
 // One SQLite write allocates one of five slots. The unique indexes also protect retries.
 await db().prepare(`INSERT INTO player_feedback (id,user_id,client_id,day,slot,content,created)
 SELECT ?,?,?,?,candidate.slot,?,? FROM (SELECT 1 AS slot UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) candidate
 WHERE NOT EXISTS (SELECT 1 FROM player_feedback WHERE user_id=? AND day=? AND slot=candidate.slot)
 AND NOT EXISTS (SELECT 1 FROM player_feedback WHERE user_id=? AND client_id=?)
 ORDER BY candidate.slot LIMIT 1 ON CONFLICT(user_id,client_id) DO NOTHING`).bind(crypto.randomUUID(),u.id,clientId,day,content,now,u.id,day,u.id,clientId).run();
 const saved=await db().prepare('SELECT id,content FROM player_feedback WHERE user_id=? AND client_id=?').bind(u.id,clientId).first<{id:string;content:string}>();
 if(!saved)throw new AppError('今天已反馈 5 次，请明天再来',429);
 if(saved.content!==content)throw new AppError('这次反馈已保存，请重新打开后提交新意见',409);
 return json({ok:true,id:saved.id,...await quota(u.id,day)});
});}
