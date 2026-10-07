import {isHoldem,closeHoldem} from '@/lib/holdem/engine';
import {AppError,body,config,db,json,requireUser,safe} from '@/lib/server';
import {commit,getRoom,isMahjong,type RoomGame} from '@/lib/rooms';
import {isModern} from '@/lib/mahjong/game';
import {closeModern} from '@/lib/mahjong/modern';
export const dynamic='force-dynamic';
export async function GET(req:Request){return safe(async()=>{await requireUser(req,true);const [c,users,rooms,records,audit,shares]=await Promise.all([config(),db().prepare('SELECT id,display,username,role,banned,score,created FROM users ORDER BY created DESC LIMIT 200').all(),db().prepare("SELECT code,title,phase,updated,state FROM rooms WHERE phase!='closed' ORDER BY updated DESC LIMIT 100").all(),db().prepare('SELECT id,room_code,result,created FROM records ORDER BY created DESC LIMIT 100').all(),db().prepare('SELECT actor,action,created FROM audit ORDER BY created DESC LIMIT 30').all(),db().prepare('SELECT s.id,s.room_code,s.scope,s.created,s.revoked,u.display AS creator FROM mahjong_shares s JOIN users u ON u.id=s.creator ORDER BY s.created DESC LIMIT 100').all()]);return json({config:c,users:users.results,rooms:rooms.results.map(r=>{const g=JSON.parse(r.state as string);return {code:r.code,title:r.title,phase:r.phase,updated:r.updated,practice:!!g.practice,kind:g.kind||'landlord',count:g.seats.length,capacity:g.kind==='holdem'?g.rules.capacity:g.kind==='mahjong'||g.rules?.id==='landlord-four-v1'?4:3,rules:g.rules?.name,rulesSnapshot:g.rules,baseChips:g.baseChips,balances:g.kind==='holdem'?g.seats.map((s:{name:string;stack:string})=>({name:s.name,balance:s.stack,brought:(s as any).brought})):g.schemaVersion===2?g.seats.map((s:{name:string;balance:string})=>({name:s.name,balance:s.balance})):null,entries:g.schemaVersion===2?g.entries:[]};}),records:records.results.map(r=>({...r,result:JSON.parse(r.result as string)})),audit:audit.results,shares:shares.results});})}
export async function POST(req:Request){return safe(async()=>{const u=await requireUser(req,true),b=await body(req);let description='';
 if(b.action==='settings'){
 if(![15,30,45,60].includes(b.seconds)||typeof b.announcement!=='string'||b.announcement.length>300||typeof b.maintenance!=='boolean')throw new AppError('设置内容无效');
 await db().batch(Object.entries({seconds:String(b.seconds),announcement:b.announcement,maintenance:String(b.maintenance)}).map(([k,v])=>db().prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k,v)));description='更新公告、开桌状态和对局时限';
 }else if(b.action==='ban'){
 if(typeof b.id!=='string'||typeof b.banned!=='boolean')throw new AppError('用户参数无效');const target=await db().prepare('SELECT role,display FROM users WHERE id=?').bind(b.id).first<{role:string;display:string}>();if(!target||target.role==='admin')throw new AppError('不能停用管理员账号');
 await db().batch([db().prepare('UPDATE users SET banned=? WHERE id=? AND role!=\'admin\'').bind(b.banned?1:0,b.id),db().prepare('DELETE FROM sessions WHERE user_id=?').bind(b.id)]);description=`${b.banned?'停用':'恢复'}账号 ${target.display}`;
 }else if(b.action==='close'){
 if(typeof b.code!=='string')throw new AppError('房间号无效');const r=await getRoom(b.code),g=JSON.parse(r.state) as RoomGame;
 if(isHoldem(g))closeHoldem(g,true);else if(isMahjong(g)&&isModern(g))closeModern(g,true);else{g.phase='closed';g.deadline=0;g.log.push({text:'管理员已关闭房间，本局不计分',at:Date.now()});}
 await commit(r,g,(guard,op)=>[db().prepare(`DELETE FROM members WHERE room_code=? AND ${guard}`).bind(r.code,r.code,op)]);description=`关闭房间 ${r.code}`;
 }else if(b.action==='revoke_share'){
 if(typeof b.id!=='string'||!/^[a-f0-9]{48}$/.test(b.id))throw new AppError('分享标识无效');
 await db().prepare('UPDATE mahjong_shares SET revoked=1 WHERE id=?').bind(b.id).run();description='撤销麻将战报分享';
 }else throw new AppError('未知操作');
 await db().prepare('INSERT INTO audit (id,actor,action,created) VALUES (?,?,?,?)').bind(crypto.randomUUID(),u.display,description,Date.now()).run();return json({ok:true});
});}
