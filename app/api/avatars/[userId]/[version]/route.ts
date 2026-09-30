import {AppError,db,requireUser,safe} from '@/lib/server';
export const GET=(req:Request,{params}:{params:Promise<{userId:string;version:string}>})=>safe(async()=>{
 await requireUser(req);const {userId,version}=await params;if(!/^\d+$/.test(version)||!Number.isSafeInteger(Number(version)))throw new AppError('头像不存在',404);
 const row=await db().prepare('SELECT a.image FROM user_avatars a JOIN users u ON u.id=a.user_id WHERE a.user_id=? AND a.version=? AND a.image IS NOT NULL AND u.banned=0').bind(userId,Number(version)).first<{image:number[]|ArrayBuffer}>();if(!row)throw new AppError('头像不存在',404);
 const headers={'Content-Type':'image/jpeg','Cache-Control':'private, max-age=86400, immutable','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','ETag':`"${userId}-${version}"`};
 if(req.headers.get('if-none-match')===headers.ETag)return new Response(null,{status:304,headers});
 return new Response(new Uint8Array(row.image),{headers});
});
