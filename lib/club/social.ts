import type {AvatarProfile} from '../avatar/profile';
export const PRESENCE_TTL_MS = 90_000;
export const SOCIAL_POLL_MS = 30_000;
export const INVITE_TTL_MS = 10 * 60_000;
export type SocialPerson = {id:string;name:string};
export type Friend = SocialPerson & {online:boolean};
export type RoomInvite = {id:string;code:string;title:string;game:'landlord'|'landlord-v3'|'mahjong'|'holdem';from:SocialPerson;expires:number};
export type SocialSnapshot = {friends:Friend[];incoming:SocialPerson[];outgoing:SocialPerson[];invites:RoomInvite[];profiles?:AvatarProfile[]};
export const emptySocial = ():SocialSnapshot => ({friends:[],incoming:[],outgoing:[],invites:[]});
export function friendPair(a:string,b:string):[string,string] {
 if(!a||!b||a===b)throw Error('请选择同桌的其他玩家');
 return a<b?[a,b]:[b,a];
}
export function roomInviteProblem(g:{kind?:string;phase:string;seats:{id:string;bot?:boolean}[];practice?:{roomType?:string}|null;fixed?:boolean;fixedIds?:string[];roundNumber?:number;rules?:{id?:string;capacity?:number}},recipient?:string):string|null {
 if(g.phase==='closed')return '这个房间已结束';
 if(g.practice&&g.practice.roomType!=='mixed')return '人机测试房不能邀请其他玩家';
 if(recipient&&g.seats.some(s=>s.id===recipient))return '好友已经在这桌了';
 const capacity=g.kind==='holdem'?g.rules?.capacity??4:g.kind==='mahjong'?4:3;
 if(g.phase!=='waiting'||g.fixed||g.fixedIds?.length||g.kind==='landlord-v3'&&(g.roundNumber??0)>0)return '这桌已经开局，暂不能邀请入座';
 if(g.seats.length>=capacity)return '这桌已满，请先留一个空位';
 return null;
}
