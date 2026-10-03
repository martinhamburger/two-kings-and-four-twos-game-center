import type {FrameMotion} from './timeline.ts';
import type {TableAction} from '../game/engine.ts';
export const ROYAL_ROOT='/effects/royal-table';
export const ROYAL_BACKGROUND=`${ROYAL_ROOT}/courtyard.webp`;
export const ROYAL_ACTIONS=['idle','enter','play','pass','win','lose'] as const;
export type RoyalAction=typeof ROYAL_ACTIONS[number];
export type RoyalRole='king'|'princess';
export type RoyalAsset={id:string;src:string;motion?:FrameMotion};
const labels={idle:'待机',enter:'入场',play:'出牌',pass:'不出',win:'胜利',lose:'失利'};
export function royalMotion(role:RoyalRole,action:RoyalAction):FrameMotion{
 return {id:`royal-${role}-${action}`,label:`${role==='king'?'国王':'公主'} · ${labels[action]}`,poster:`${ROYAL_ROOT}/${role}/poster.webp`,sheets:[{src:`${ROYAL_ROOT}/${role}/${action}.webp`,columns:4,rows:1,cellWidth:320,cellHeight:320}],frames:[0,1,2,3].map(cell=>({sheet:0,cell,duration:action==='idle'?550:action==='win'||action==='lose'?400:260}))};
}
export const ROYAL_ASSETS:RoyalAsset[]=[{id:'courtyard',src:ROYAL_BACKGROUND},...(['king','princess'] as const).flatMap(role=>ROYAL_ACTIONS.map(action=>({id:`${role}-${action}`,src:`${ROYAL_ROOT}/${role}/poster.webp`,motion:royalMotion(role,action)})))];
export type RoyalGame={round:string;phase:string;landlord:number;winner:number;suddenDeath?:boolean;tableActions?:(TableAction|null)[]};
export function royalRole(g:RoyalGame,seat:number):RoyalRole|null{
 return seat<0||g.suddenDeath||g.landlord<0||['waiting','shopping','bidding','closed'].includes(g.phase)?null:seat===g.landlord?'king':'princess';
}
/** Only confirmed changes in an already observed round produce a local cue. */
export function royalCue(before:RoyalGame|null,after:RoyalGame,seat:number):RoyalAction|null{
 if(!before||before.round!==after.round||!royalRole(after,seat))return null;
 if(before.phase!=='finished'&&after.phase==='finished')return (after.winner===after.landlord)===(seat===after.landlord)?'win':'lose';
 if(!royalRole(before,seat))return 'enter';
 const action=after.tableActions?.[seat];
 if(!action||JSON.stringify(action)===JSON.stringify(before.tableActions?.[seat]))return null;
 return action.kind==='play'?'play':action.kind==='pass'?'pass':action.kind==='double'?'enter':null;
}
