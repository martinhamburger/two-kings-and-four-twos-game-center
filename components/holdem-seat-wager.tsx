"use client";
import {useEffect,useRef} from 'react';
import {Coins} from 'lucide-react';
import type {HoldemView} from '@/lib/holdem/engine';
import {TABLE_FEEDBACK_MOTIONS} from '@/lib/motion/catalog';
import {chips} from '@/lib/mahjong/report';
import {useEmotePreferences} from './emote-preferences';
import {TurnClock} from './table-ui';
const labels={fold:'弃牌',check:'过牌',call:'跟注',raise:'加注',allin:'全下'};
export function HoldemSeatWager({seat:s,street,round,active,seconds,userId}:{seat:Pick<HoldemView['seats'][number],'name'|'total'|'bet'|'folded'|'allIn'>&{action?:HoldemView['seats'][number]['action']};street:HoldemView['street'];round:string;active:boolean;seconds:number;userId:string}){
 const {prefs}=useEmotePreferences(userId),amount=useRef<HTMLDivElement>(null),badge=useRef<HTMLSpanElement>(null);
 const previous=useRef({round,total:s.total,id:s.action?.id});
 const kind=s.folded?'fold':s.allIn?'allin':s.action?.street===street?s.action.kind:null;
 useEffect(()=>{
  const old=previous.current;previous.current={round,total:s.total,id:s.action?.id};
  if(old.round!==round||!prefs.effects||window.matchMedia('(prefers-reduced-motion: reduce)').matches||document.hidden)return;
  const animations:Animation[]=[];
  if(old.total!==s.total&&BigInt(s.total)>BigInt(old.total)){const m=TABLE_FEEDBACK_MOTIONS.chips;const a=amount.current?.animate(m.frames,{duration:m.duration,easing:'ease-out'});if(a)animations.push(a);}
  if(s.action&&old.id!==s.action.id&&Date.now()-s.action.at<5000){const m=TABLE_FEEDBACK_MOTIONS.action;const a=badge.current?.animate(m.frames,{duration:m.duration,easing:'ease-out'});if(a)animations.push(a);}
  return()=>animations.forEach(a=>a.cancel());
 },[round,s.total,s.action?.id,prefs.effects]);
 return <div className="th-seat-wager">
  <div className="th-invested" ref={amount} title={`本手累计 ${chips(s.total)} · 本轮 ${chips(s.bet)}`} aria-label={`${s.name}本手累计投入 ${chips(s.total)} 筹码`}><Coins size={17} aria-hidden="true"/><span>投入</span><strong>{chips(s.total)}</strong></div>
  <div className="th-seat-feedback">{kind&&<span ref={badge} title={s.action?`本次投入 ${chips(s.action.paid)}`:undefined} className={`th-action-badge is-${kind}`}>{labels[kind]}</span>}{active&&<TurnClock seconds={seconds} label={s.name+'正在行动'}/>}</div>
 </div>;
}
