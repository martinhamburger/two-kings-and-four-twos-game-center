export type AvatarProfile={id:string;version:number;url:string|null};
export const defaultAvatar:AvatarProfile=Object.freeze({id:'',version:0,url:null});
export function avatarProfile(id:string,version=0,present=false):AvatarProfile{return {id,version,url:present?`/api/avatars/${encodeURIComponent(id)}/${version}`:null};}
/** Keep tombstones as well as pictures: a late heartbeat cannot undo a restore. */
export function mergeProfiles(previous:Record<string,AvatarProfile>,incoming:AvatarProfile[]){let next=previous;for(const p of incoming){if(!p.id||!Number.isSafeInteger(p.version)||p.version<0)continue;const old=next[p.id];if(old&&old.version>=p.version)continue;if(next===previous)next={...previous};next[p.id]=p;}return next;}
