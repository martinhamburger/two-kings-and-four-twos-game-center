"use client";
import {useState} from 'react';
import {Bot} from 'lucide-react';
import {useAvatar} from './avatar-provider';
export function PlayerAvatar({name,userId,bot=false,className=''}:{name:string;userId?:string;bot?:boolean;className?:string}){
 const {profile,editable,edit}=useAvatar(bot?undefined:userId),[failed,setFailed]=useState<string|null>(null),url=profile.url;
 const children=url&&failed!==url?<img src={url} alt="" draggable={false} onError={()=>setFailed(url)}/>:bot?<Bot aria-hidden="true"/>:<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="26" r="16" fill="currentColor"/><path d="M8 80v-9c0-18 14-29 32-29s32 11 32 29v9" fill="currentColor"/></svg>;
 const classes=`avatar player-avatar ${className}`;
 return editable?<button type="button" className={classes} aria-label={`更换头像，${name}`} title="更换头像" onClick={edit}>{children}</button>:<span className={classes} role="img" aria-label={bot?`${name}，人机`:`${name}的头像`}>{children}</span>;
}
