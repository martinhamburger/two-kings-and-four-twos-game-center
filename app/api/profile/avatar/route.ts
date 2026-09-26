import {AppError,db,json,limit,requireUser,safe} from '@/lib/server';
import {boundedImage,profile,sameOrigin} from '@/lib/avatar/server';
import {sanitizeAvatar} from '@/lib/avatar/image';
import {avatarProfile} from '@/lib/avatar/profile';
export const GET=(req:Request)=>safe(async()=>json(await profile((await requireUser(req)).id)));
async function change(req:Request,remove:boolean){return safe(async()=>{
 const user=await requireUser(req);sameOrigin(req);const match=req.headers.get('if-match');if(!match||!/^"?\d+"?$/.test(match))throw new AppError('请重新打开头像编辑',428);const expected=Number(match.replaceAll('"',''));if(!Number.isSafeInteger(expected)||expected<0)throw new AppError('头像版本无效');
 await limit('avatar:'+user.id,30);let image:Uint8Array|null=null;
 if(!remove){if(req.headers.get('content-type')?.split(';')[0]!=='image/jpeg')throw new AppError('请上传裁剪后的 JPEG 头像');const bytes=await boundedImage(req);try{image=sanitizeAvatar(bytes)}catch(e){throw new AppError((e as Error).message);}}
 const result=await db().prepare(`INSERT INTO user_avatars (user_id,version,image,mime,updated) SELECT ?,1,?,'image/jpeg',? WHERE ?=0 OR EXISTS(SELECT 1 FROM user_avatars WHERE user_id=? AND version=?)
 ON CONFLICT(user_id) DO UPDATE SET version=user_avatars.version+1,image=excluded.image,updated=excluded.updated WHERE user_avatars.version=? RETURNING version`).bind(user.id,image?.buffer??null,Date.now(),expected,user.id,expected,expected).first<{version:number}>();
 if(!result)return json({error:'头像已在其他页面更新，请核实后再次保存',profile:await profile(user.id)},409);
 return json(avatarProfile(user.id,result.version,!remove));
});}
export const PUT=(req:Request)=>change(req,false);
export const DELETE=(req:Request)=>change(req,true);
