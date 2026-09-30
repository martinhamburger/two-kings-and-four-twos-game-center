import {profileSnapshot} from './avatar/server';
import {AppError,db} from './server';
import {INVITE_TTL_MS,PRESENCE_TTL_MS,friendPair,roomInviteProblem,type SocialSnapshot,type RoomInvite} from './club/social';

type Relationship={user_low:string;user_high:string;requested_by:string;accepted:number|null};
export async function relationship(a:string,b:string){const [low,high]=friendPair(a,b);return db().prepare('SELECT * FROM friendships WHERE user_low=? AND user_high=?').bind(low,high).first<Relationship>();}
export async function socialSnapshot(id:string):Promise<SocialSnapshot>{
 const now=Date.now();
 const [people,invitations,profiles]=await Promise.all([
  db().prepare(`SELECT u.id,u.display AS name,f.requested_by,f.accepted,
   EXISTS(SELECT 1 FROM user_presence p JOIN sessions s ON s.hash=p.session_hash WHERE s.user_id=u.id AND s.expires>? AND p.seen>?) AS online
   FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_low=? THEN f.user_high ELSE f.user_low END
   WHERE (f.user_low=? OR f.user_high=?) AND u.banned=0 ORDER BY online DESC,u.display,u.id`).bind(now,now-PRESENCE_TTL_MS,id,id,id).all<{id:string;name:string;requested_by:string;accepted:number|null;online:number}>(),
  db().prepare(`SELECT i.id,i.room_code AS code,r.title,r.state,i.sender,u.display AS name,i.expires FROM room_invites i
   JOIN rooms r ON r.code=i.room_code JOIN users u ON u.id=i.sender
   JOIN friendships f ON f.user_low=min(i.sender,i.recipient) AND f.user_high=max(i.sender,i.recipient) AND f.accepted IS NOT NULL
   JOIN members m ON m.user_id=i.sender AND m.room_code=i.room_code
   WHERE i.recipient=? AND i.expires>? AND i.dismissed=0 AND u.banned=0 ORDER BY i.created DESC LIMIT 50`).bind(id,now).all<{id:string;code:string;title:string;state:string;sender:string;name:string;expires:number}>(),
  profileSnapshot(id),
 ]);
 const friends=people.results.filter(p=>p.accepted!==null).map(p=>({id:p.id,name:p.name,online:!!p.online}));
 const pending=people.results.filter(p=>p.accepted===null),person=(p:typeof pending[number])=>({id:p.id,name:p.name});
 const invites:RoomInvite[]=invitations.results.flatMap(i=>{const g=JSON.parse(i.state);return roomInviteProblem(g,id)?[]:[{id:i.id,code:i.code,title:i.title,game:g.kind??'landlord',from:{id:i.sender,name:i.name},expires:i.expires}];});
 return {profiles,friends,incoming:pending.filter(p=>p.requested_by!==id).map(person),outgoing:pending.filter(p=>p.requested_by===id).map(person),invites};
}
export async function requestFriend(id:string,target:string,code:string){
 const [low,high]=friendPair(id,target);
 // Authorize both identities through actual human membership, never through a supplied seat list.
 const shared=await db().prepare(`SELECT 1 FROM members a JOIN members b ON b.room_code=a.room_code JOIN rooms r ON r.code=a.room_code JOIN users u ON u.id=b.user_id
  WHERE a.user_id=? AND b.user_id=? AND a.room_code=? AND r.phase!='closed' AND u.banned=0`).bind(id,target,code).first();
 if(!shared)throw new AppError('只能向当前同桌的真实玩家发送申请',403);
 const prior=await relationship(id,target);
 if(prior&&prior.accepted!==null)return;
 if(prior&&prior.requested_by!==id)throw new AppError('对方已向你申请，请先同意或忽略该申请',409);
 await db().prepare('INSERT INTO friendships (user_low,user_high,requested_by,created) VALUES (?,?,?,?) ON CONFLICT(user_low,user_high) DO NOTHING').bind(low,high,id,Date.now()).run();
}
export async function respondFriend(id:string,target:string,action:'accept'|'decline'|'cancel'){
 const [low,high]=friendPair(id,target),r=await relationship(id,target);
 if(!r||r.accepted!==null)throw new AppError('这条好友申请已处理，请刷新',409);
 if((action==='cancel')!==(r.requested_by===id))throw new AppError('不能处理别人的好友申请',403);
 const result=action==='accept'
  ?await db().prepare('UPDATE friendships SET accepted=? WHERE user_low=? AND user_high=? AND accepted IS NULL AND requested_by!=?').bind(Date.now(),low,high,id).run()
  :await db().prepare('DELETE FROM friendships WHERE user_low=? AND user_high=? AND accepted IS NULL AND requested_by=?').bind(low,high,r.requested_by).run();
 if(!result.meta.changes)throw new AppError('这条好友申请已处理，请刷新',409);
}
async function availableRoom(code:string,sender:string,recipient:string){
 const r=await db().prepare('SELECT r.code,r.state FROM rooms r JOIN members m ON m.room_code=r.code JOIN users u ON u.id=m.user_id WHERE r.code=? AND m.user_id=? AND u.banned=0').bind(code,sender).first<{code:string;state:string}>();
 if(!r)throw new AppError('邀请人已离开房间，邀请失效',409);
 const g=JSON.parse(r.state),problem=roomInviteProblem(g,recipient);if(problem)throw new AppError(problem,409);
 return {code:r.code,game:g.kind??'landlord'};
}
export async function inviteFriend(id:string,target:string,code:string){
 const f=await relationship(id,target);if(!f||f.accepted===null)throw new AppError('对方同意成为好友后才能邀请',403);
 await availableRoom(code,id,target);
 if(await db().prepare('SELECT 1 FROM members WHERE user_id=?').bind(target).first())throw new AppError('好友已有牌桌，请等对方离桌后再邀请',409);
 if(!await db().prepare('SELECT 1 FROM users WHERE id=? AND banned=0').bind(target).first())throw new AppError('暂时无法邀请这位好友',403);
 const now=Date.now();
 await db().prepare(`INSERT INTO room_invites (id,room_code,sender,recipient,created,expires,dismissed) VALUES (?,?,?,?,?,?,0)
 ON CONFLICT(room_code,recipient) DO UPDATE SET sender=excluded.sender,created=excluded.created,expires=excluded.expires,dismissed=0
 WHERE room_invites.expires<=? OR room_invites.dismissed=1`).bind(crypto.randomUUID(),code,id,target,now,now+INVITE_TTL_MS,now).run();
}
export async function openInvite(id:string,inviteId:string){
 const invite=await db().prepare('SELECT room_code,sender FROM room_invites WHERE id=? AND recipient=? AND dismissed=0 AND expires>?').bind(inviteId,id,Date.now()).first<{room_code:string;sender:string}>();
 if(!invite)throw new AppError('邀请已过期或已处理',409);
 const f=await relationship(id,invite.sender);if(!f||f.accepted===null)throw new AppError('邀请已失效',403);
 if(await db().prepare('SELECT 1 FROM members WHERE user_id=?').bind(id).first())throw new AppError('你已有牌桌，请先离桌再接受邀请',409);
 // This validates the invitation only. The normal game join still performs the atomic seat claim.
 return availableRoom(invite.room_code,invite.sender,id);
}
