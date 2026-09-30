import {Bot} from 'lucide-react';
/** Shared portrait shell; account pictures can replace the fallback without moving seats. */
export function PlayerAvatar({name,bot=false,className=''}:{name:string;bot?:boolean;className?:string}){return <span className={`avatar player-avatar ${className}`} role="img" aria-label={bot?`${name}，人机`:`${name}的头像`}>{bot?<Bot aria-hidden="true"/>:<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="26" r="16" fill="currentColor"/><path d="M8 80v-9c0-18 14-29 32-29s32 11 32 29v9" fill="currentColor"/></svg>}</span>}
