import {AppError,body,db,json,limit,requireUser,safe} from '@/lib/server';

export const dynamic='force-dynamic';

export async function GET(req:Request){return safe(async()=>{
 await requireUser(req);
 const raw=new URL(req.url).searchParams.get('page')??'0';
 if(!/^\d{1,5}$/.test(raw))throw new AppError('页码无效');
 const game=new URL(req.url).searchParams.get('game')??'all';
 if(!['all','landlord','mahjong','holdem'].includes(game))throw new AppError('游戏筛选无效');
 const page=Number(raw),pageSize=12;
 const filter=" AND (?='all' OR (?='landlord' AND r.game IN ('landlord','landlord-v3')) OR r.game=?)";
 const [rows,total]=await Promise.all([
  db().prepare(`SELECT r.id,r.game,r.created,r.ended,r.practice,t.submitted_at AS submitted,t.reason,
   CASE WHEN t.anonymous=1 THEN NULL ELSE u.display END AS poster
   FROM replay_tv t JOIN replay_rounds r ON r.id=t.replay_id JOIN users u ON u.id=t.submitted_by
   WHERE t.withdrawn_at IS NULL AND r.ended IS NOT NULL ${filter}
   ORDER BY t.submitted_at DESC,r.id DESC LIMIT ? OFFSET ?`).bind(game,game,game,pageSize,page*pageSize).all(),
  db().prepare(`SELECT COUNT(*) AS n FROM replay_tv t JOIN replay_rounds r ON r.id=t.replay_id WHERE t.withdrawn_at IS NULL AND r.ended IS NOT NULL ${filter}`).bind(game,game,game).first<{n:number}>()
 ]);
 return json({items:rows.results.map(row=>({...row,poster:row.poster??'匿名玩家'})),total:total?.n??0,page,pageSize});
});}

export async function POST(req:Request){return safe(async()=>{
 const u=await requireUser(req),b=await body(req);
 if(!['submit','withdraw','remove'].includes(b?.action)||typeof b.id!=='string'||!/^[a-f0-9-]{36}$/i.test(b.id))throw new AppError('投稿请求无效');
 await limit('tv:'+u.id,12,60);
 const round=await db().prepare(`SELECT id,participants,ended FROM replay_rounds WHERE id=?`).bind(b.id).first<{id:string;participants:string;ended:number|null}>();
 if(!round||round.ended===null)throw new AppError('只能投稿已完成的对局',409);
 const participant=(JSON.parse(round.participants) as string[]).includes(u.id);
 if(b.action==='submit'){
  if(!participant)throw new AppError('只有参与者可以投稿',403);
  if(b.anonymous!==undefined&&typeof b.anonymous!=='boolean')throw new AppError('投稿身份无效');
  if(b.reason!==undefined&&typeof b.reason!=='string')throw new AppError('投稿理由无效');
  const reason=(b.reason??'').trim();
  if(reason.length>80||/[\r\n\u0000-\u001f\u007f]/.test(reason))throw new AppError('投稿理由请写成一句话，最多 80 字');
  const frame=await db().prepare('SELECT 1 FROM replay_frames WHERE round_id=? LIMIT 1').bind(b.id).first();
  if(!frame)throw new AppError('这场对局缺少回放步骤',409);
  const now=Date.now();
  const saved=await db().prepare('INSERT INTO replay_tv (replay_id,submitted_by,submitted_at,anonymous,reason,withdrawn_at) VALUES (?,?,?,?,?,NULL) ON CONFLICT(replay_id) DO NOTHING').bind(b.id,u.id,now,b.anonymous===true?1:0,reason).run();
  if(!saved.meta.changes)throw new AppError('这场回放已投稿或已被下架',409);
 }else{
  const tv=await db().prepare('SELECT submitted_by,submitted_at,withdrawn_at FROM replay_tv WHERE replay_id=?').bind(b.id).first<{submitted_by:string;submitted_at:number;withdrawn_at:number|null}>();
  if(!tv||tv.withdrawn_at!==null)throw new AppError('这场回放未发布',409);
  if(b.action==='remove'&&u.role!=='admin')throw new AppError('仅管理员可下架',403);
  if(b.action==='withdraw'&&tv.submitted_by!==u.id)throw new AppError('只有投稿人可以撤稿',403);
  // Compare the publication we authorized, so an intervening removal or new
  // submission cannot be deleted or moderated by this stale request.
  if(b.action==='withdraw'){
   const saved=await db().prepare('DELETE FROM replay_tv WHERE replay_id=? AND submitted_by=? AND submitted_at=? AND withdrawn_at IS NULL').bind(b.id,u.id,tv.submitted_at).run();
   if(!saved.meta.changes)throw new AppError('投稿状态已变化，请刷新后重试',409);
  }else{
   const now=Date.now();
   const results=await db().batch([
    db().prepare('UPDATE replay_tv SET withdrawn_at=? WHERE replay_id=? AND submitted_by=? AND submitted_at=? AND withdrawn_at IS NULL').bind(now,b.id,tv.submitted_by,tv.submitted_at),
    db().prepare('INSERT INTO audit (id,actor,action,created) SELECT ?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),u.display,'下架 TV 回放 '+b.id,now)
   ]);
   if(!results[0].meta.changes)throw new AppError('投稿状态已变化，请刷新后重试',409);
  }
 }
 return json({ok:true});
});}
