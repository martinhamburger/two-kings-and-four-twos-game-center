import {readScoreRecords} from '../reports/server';
import {scoreReport} from '../reports/score';
import {AppError,db} from '../server';
import {getRoom,isMahjong} from '../rooms';
import {isModern} from './game';
import {publicRound,roundReport,tableReport,type Report} from './report';
import type {RoundResult} from './modern';
export async function reportAccess(code:string,userId:string,admin=false){const r=await getRoom(code),g=JSON.parse(r.state);if(!isMahjong(g)||!isModern(g))throw new AppError('这桌使用旧版积分，请查看原对局记录');if(!admin&&!g.seats.some(s=>s.id===userId))throw new AppError('只有同桌玩家可以查看战报',403);return {r,g};}
export async function readRound(code:string,id:string){const row=await db().prepare("SELECT result FROM records WHERE id=? AND room_code=? AND json_extract(result,'$.schemaVersion')=2").bind(id,code).first<{result:string}>();if(!row)throw new AppError('这局尚未结算或记录不存在',404);return JSON.parse(row.result) as RoundResult;}
export async function reportPage(meta:Report,code:string,roundLimit:number,page=0){
 const p=Math.max(0,Math.min(Math.floor(page)||0,Math.max(0,Math.ceil(meta.totalRounds/meta.pageSize)-1)));
 const rows=await db().prepare("SELECT result FROM records WHERE room_code=? AND json_extract(result,'$.schemaVersion')=2 AND json_extract(result,'$.roundNumber')<=? ORDER BY json_extract(result,'$.roundNumber') DESC LIMIT ? OFFSET ?").bind(code,roundLimit,meta.pageSize,p*meta.pageSize).all<{result:string}>();
 const scores=scoreReport(await readScoreRecords(code,roundLimit),meta.title);
 if(scores.points.length-1!==meta.totalRounds)scores.warnings.push('记录局数与战报快照不一致，曲线仅展示已保存的结算。');
 return {...meta,scores,page:p,rounds:rows.results.map(r=>publicRound(JSON.parse(r.result)))};
}
export async function privateReport(code:string,userId:string,roundId?:string|null,page=0,admin=false){
 const {r,g}=await reportAccess(code,userId,admin);
 if(roundId)return roundReport(r.title,await readRound(code,roundId));
 if(g.phase!=='closed')throw new AppError('房主结束整桌后即可生成整桌战报');
 return reportPage(tableReport(r.title,g),code,g.roundNumber,page);
}
