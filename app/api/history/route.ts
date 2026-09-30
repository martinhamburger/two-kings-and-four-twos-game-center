import {AppError,db,json,requireUser,safe} from '@/lib/server';
import {roundSummary,tableSummary} from '@/lib/club/history';
import {scoreReport} from '@/lib/reports/score';
import {tableScores,landlordTableSummary} from '@/lib/reports/server';
export const dynamic='force-dynamic';
const PAGE_SIZE=12;
export async function GET(req:Request){return safe(async()=>{
 const u=await requireUser(req),p=new URL(req.url).searchParams,id=p.get('id');
 const room=p.get('room');if(room){if(!/^\d{6}$/.test(room))throw new AppError('房间号无效');return json(await tableScores(room,u.id));}
 if(id){if(id.length>100)throw new AppError('记录标识无效');const r=await db().prepare("SELECT id,room_code,created,result FROM records WHERE id=? AND EXISTS(SELECT 1 FROM json_each(result,'$.seats') WHERE json_extract(value,'$.id')=?)").bind(id,u.id).first<{id:string;room_code:string;created:number;result:string}>();if(!r)throw new AppError('找不到你的这条对局记录',404);const result=JSON.parse(r.result);return json({...r,result,scores:scoreReport([{id:r.id,created:r.created,result}], '本局得分',r.room_code)});}
 const game=p.get('game')??'all',scope=p.get('scope')??'rounds',raw=p.get('page')??'0';
 if(!['all','landlord','mahjong','holdem'].includes(game)||!['rounds','tables'].includes(scope)||!/^\d{1,6}$/.test(raw))throw new AppError('记录筛选条件无效');
 const page=Number(raw);
 if(scope==='rounds'){
  const where="EXISTS(SELECT 1 FROM json_each(result,'$.seats') WHERE json_extract(value,'$.id')=?)"+(game==='all'?'':game==='landlord'?" AND COALESCE(json_extract(result,'$.kind'),'landlord') IN ('landlord','landlord-v3')":" AND json_extract(result,'$.kind')=?"),args=game==='all'||game==='landlord'?[u.id]:[u.id,game];
  const [rows,total]=await Promise.all([db().prepare(`SELECT id,room_code,created,result FROM records WHERE ${where} ORDER BY created DESC,id DESC LIMIT ? OFFSET ?`).bind(...args,PAGE_SIZE,page*PAGE_SIZE).all<{id:string;room_code:string;created:number;result:string}>(),db().prepare(`SELECT COUNT(*) n FROM records WHERE ${where}`).bind(...args).first<{n:number}>()]);
  return json({items:rows.results.map(r=>roundSummary(r,u.id)),total:total?.n??0,page,pageSize:PAGE_SIZE,scope,game});
 }
 const participation="(EXISTS(SELECT 1 FROM json_each(rooms.state,'$.seats') WHERE json_extract(value,'$.id')=?) OR EXISTS(SELECT 1 FROM records WHERE records.room_code=rooms.code AND EXISTS(SELECT 1 FROM json_each(records.result,'$.seats') WHERE json_extract(value,'$.id')=?)))";
 const where="phase='closed' AND "+participation+(game==='all'?'':game==='landlord'?" AND COALESCE(json_extract(state,'$.kind'),'landlord') IN ('landlord','landlord-v3')":" AND json_extract(state,'$.kind')=?"),args=game==='all'||game==='landlord'?[u.id,u.id]:[u.id,u.id,game];
 const [rows,total]=await Promise.all([db().prepare(`SELECT code,title,updated,state FROM rooms WHERE ${where} ORDER BY updated DESC,code DESC LIMIT ? OFFSET ?`).bind(...args,PAGE_SIZE,page*PAGE_SIZE).all<{code:string;title:string;updated:number;state:string}>(),db().prepare(`SELECT COUNT(*) n FROM rooms WHERE ${where}`).bind(...args).first<{n:number}>()]);
 return json({items:await Promise.all(rows.results.map(r=>{const g=JSON.parse(r.state);return g.kind==='holdem'||g.kind==='mahjong'&&g.schemaVersion===2?tableSummary(r,u.id):landlordTableSummary(r,u.id)})),total:total?.n??0,page,pageSize:PAGE_SIZE,scope,game});
});}
