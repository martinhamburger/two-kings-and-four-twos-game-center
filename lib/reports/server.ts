import {AppError,db} from '../server';
import {getRoom} from '../rooms';
import {scoreReport,type ScoreRecord} from './score';
import type {HistoryItem} from '../club/history';

// Select score facts only: avoid loading hands, wall/deck, equipment choices or logs.
const projection=`json_object(
 'kind',COALESCE(json_extract(result,'$.kind'),'landlord'),
 'schemaVersion',json_extract(result,'$.schemaVersion'),'roundNumber',json_extract(result,'$.roundNumber'),
 'winner',json_extract(result,'$.winner'),'landlord',json_extract(result,'$.landlord'),
 'winType',json_extract(result,'$.winType'),'type',json_extract(result,'$.type'),
 'bid',json_extract(result,'$.bid'),'multiplier',json_extract(result,'$.multiplier'),
 'spring',json_extract(result,'$.spring'),'doubles',json_extract(result,'$.doubles'),
 'rounds',json_extract(result,'$.rounds'),'practice',json_extract(result,'$.practice'),
 'seats',(SELECT json_group_array(json_object('id',json_extract(value,'$.id'),'name',json_extract(value,'$.name'),
 'bot',json_extract(value,'$.bot'),'delta',json_extract(value,'$.delta'),
 'coins',json_extract(value,'$.coins'),'victoryPoints',json_extract(value,'$.victoryPoints')))
 FROM json_each(result,'$.seats'))) AS result`;
export async function readScoreRecords(code:string,roundLimit?:number){
 const all:ScoreRecord[]=[];
 for(let offset=0;;offset+=200){const rows=await db().prepare(`SELECT id,created,${projection} FROM records WHERE room_code=?${roundLimit===undefined?'':" AND json_extract(result,'$.kind')='mahjong' AND json_extract(result,'$.schemaVersion')=2 AND json_extract(result,'$.roundNumber')<=?"} ORDER BY created,id LIMIT 200 OFFSET ?`).bind(...(roundLimit===undefined?[code,offset]:[code,roundLimit,offset])).all<{id:string;created:number;result:string}>();
  all.push(...rows.results.map(r=>({...r,result:JSON.parse(r.result)})));if(rows.results.length<200)break;
 }return all;
}
export async function tableScores(code:string,userId:string){
 const room=await getRoom(code),g=JSON.parse(room.state);
 // Former players remain participants even when classic room cleanup erased seats.
 const participant=g.seats?.some((s:any)=>s.id===userId)||await db().prepare("SELECT 1 FROM records WHERE room_code=? AND EXISTS(SELECT 1 FROM json_each(result,'$.seats') WHERE json_extract(value,'$.id')=?) LIMIT 1").bind(code,userId).first();
 if(!participant)throw new AppError('只有同桌玩家可以查看战报',403);
 if(room.phase!=='closed')throw new AppError('结束整桌后即可查看整桌战报');
 const records=await readScoreRecords(code);
 // V3 retains settled rounds in the room when the table ended before a champion.
 if(g.kind==='landlord-v3'&&!records.length)records.push({id:code,created:room.updated,result:{kind:g.kind,seats:g.seats,rounds:g.roundHistory,winner:g.champion}});
 const report=scoreReport(records,room.title,code);
 if(g.kind==='holdem'||g.kind==='mahjong'&&g.schemaVersion===2)report.balances=g.seats.map((s:any)=>{const initial=String(g.kind==='holdem'?s.brought:g.initialChips),balance=String(g.kind==='holdem'?s.stack:s.balance);return {name:s.name,initial,balance,delta:(BigInt(balance)-BigInt(initial)).toString()};});
 if(!records.length){report.game=g.kind??'landlord';report.warnings.push('本桌没有已保存的结算，暂时无法绘制分数曲线。');}
 if(g.kind==='mahjong'&&g.schemaVersion===2&&records.length!==g.stats.completed+g.stats.aborted||g.kind==='holdem'&&records.length!==g.roundNumber)report.warnings.push('保存的局数与牌桌总局数不一致，曲线仅累计可读取的结算。');
 return report;
}
export async function landlordTableSummary(row:{code:string;title:string;updated:number;state:string},userId:string):Promise<HistoryItem>{
 const g=JSON.parse(row.state),rows=await readScoreRecords(row.code);
 if(g.kind==='landlord-v3'&&!rows.length)rows.push({id:row.code,created:row.updated,result:{kind:g.kind,seats:g.seats,rounds:g.roundHistory,winner:g.champion}});
 const ids=[...new Set<string>(rows.flatMap(r=>r.result.seats.map((s:any)=>s.id)))],report=scoreReport(rows,row.title,row.code),i=ids.indexOf(userId),last=report.points.at(-1);
 return {id:row.code,code:row.code,title:row.title,created:row.updated,game:g.kind==='mahjong'?'mahjong':'landlord',label:'整桌结束',delta:last?.values[i]??'0',unit:report.unit,practice:rows.some(r=>r.result.practice)||report.players.some(p=>p.bot),rounds:report.points.length-1};
}
