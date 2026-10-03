import type {FrameMotion} from './motion/timeline.ts';
import {EMOTE_PACK_V2} from './motion/emote-pack.ts';
/** Stable ids are persisted in chat; never reuse an id for a different expression. */
export type Emote = {id:string;name:string;src:string;motion:string;enabled:boolean;sendable?:boolean;audio?:string;frames?:FrameMotion};
export const EMOTE_MS = 6000;
export const EMOTE_COOLDOWN_MS = 3000;
export const LEGACY_EMOTES:readonly Emote[] = [
 ['hello','打招呼','wave'],['laugh','大笑','laugh'],['smug','得意','smug'],
 ['cry','大哭','cry'],['angry','生气','shake'],['shocked','震惊','pop'],
 ['think','思考','tilt'],['like','点赞','bounce'],['clap','鼓掌','clap'],
 ['salute','抱拳','bow'],['celebrate','庆祝','celebrate'],['sigh','无奈','sigh'],
].map(([id,name,motion])=>({id,name,motion,src:`/emotes/royale-v1/${id}.webp`,enabled:true,sendable:false}));
const ORIGINAL_AUDIO_IDS = new Set(['king-laugh','king-cry','king-angry','king-thumbs-up','chicken','skeleton-dance'].map(id=>'royale-v2-'+id));
export const EMOTES:readonly Emote[]=[...LEGACY_EMOTES,...EMOTE_PACK_V2.map(e=>({...e,...(ORIGINAL_AUDIO_IDS.has(e.id)?{audio:`/emotes/royale-v2/${e.id.slice('royale-v2-'.length)}/sound.mp3`}:{})}))];
export const canSendEmote=(id:unknown)=>{const e=getEmote(id);return !!e?.enabled&&e.sendable!==false;};
export function getEmote(id:unknown):Emote|undefined{return typeof id==='string'?EMOTES.find(e=>e.id===id):undefined;}
export function emoteText(id:unknown){return `[表情：${getEmote(id)?.name??'暂不可用'}]`;}
export const EMOTE_SOUND_EVENT='yule:emote-sound';
export type EmoteSoundEvent={code:string;emoteId:string;expires:number};
