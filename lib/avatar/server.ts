import {AppError,db} from '../server';
import {avatarProfile} from './profile';
export function sameOrigin(req:Request){if(req.headers.get('sec-fetch-site')==='cross-site'||req.headers.get('origin')!==new URL(req.url).origin)throw new AppError('请求来源无效',403);}
export async function profile(id:string){const row=await db().prepare('SELECT version,image IS NOT NULL AS present FROM user_avatars WHERE user_id=?').bind(id).first<{version:number;present:number}>();return avatarProfile(id,row?.version??0,!!row?.present);}
export async function profileSnapshot(id:string){
 const rows=await db().prepare(`SELECT u.id,coalesce(a.version,0) AS version,a.image IS NOT NULL AS present FROM users u LEFT JOIN user_avatars a ON a.user_id=u.id
 WHERE u.banned=0 AND (u.id=? OR u.id IN (SELECT CASE WHEN user_low=? THEN user_high ELSE user_low END FROM friendships WHERE user_low=? OR user_high=?)
 OR u.id IN (SELECT peer.user_id FROM members me JOIN members peer ON peer.room_code=me.room_code WHERE me.user_id=?))`).bind(id,id,id,id,id).all<{id:string;version:number;present:number}>();
 return rows.results.map(r=>avatarProfile(r.id,r.version,!!r.present));
}
// Drain rejected bodies without retaining them. Cancelling an upload before EOF can poison
// the local Workers proxy's upstream connection; storage and retained bytes stay bounded.
export async function boundedImage(req:Request){
 const reader=req.body?.getReader();if(!reader)throw new AppError('请选择图片');let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size<=65536)chunks.push(value);}}
 finally{reader.releaseLock();}
 if(size>65536)throw new AppError('头像不能超过 64KB',413);
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}return bytes;
}
