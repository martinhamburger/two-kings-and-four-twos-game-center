"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {royalCue,royalRole,royalMotion,ROYAL_BACKGROUND,type RoyalGame,type RoyalAction} from '@/lib/motion/royal';
import {motionDuration} from '@/lib/motion/timeline';
import {MotionPlayback,useReducedMotion} from './motion-playback';
import {MotionImage} from './motion-image';
import {useEmotePreferences} from './emote-preferences';

export function RoyalBackground(){return <div className="royal-background" aria-hidden="true"><MotionImage src={ROYAL_BACKGROUND} alt="" decoding="async" fetchPriority="high"/></div>}
export function RoyalCharacter({game,seat,userId,connected=true}:{game:RoyalGame;seat:number;userId:string;connected?:boolean}){
 const role=royalRole(game,seat),{prefs}=useEmotePreferences(userId),reduced=useReducedMotion();
 const prior=useRef<RoyalGame|null>(null),[hidden,setHidden]=useState(false),[cue,setCue]=useState<{action:RoyalAction;at:number}|null>(null);
 const enabled=prefs.effects&&!reduced&&!hidden&&connected;
 useEffect(()=>{const change=()=>{prior.current=null;setCue(null);setHidden(document.hidden)};change();document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change)},[]);
 useEffect(()=>{
  if(!enabled){prior.current=null;setCue(null);return;}
  const action=royalCue(prior.current,game,seat);prior.current=game;
  if(action)setCue({action,at:Date.now()});
 },[game,seat,enabled]);
 // Occasional idle animation; no permanent rendering loop and no network synchronization.
 useEffect(()=>{if(!enabled||!role||cue||game.phase==='finished')return;const timer=setTimeout(()=>setCue({action:'idle',at:Date.now()}),5000+seat*700);return()=>clearTimeout(timer)},[enabled,role,cue,seat,game.phase]);
 const motion=useMemo(()=>role?royalMotion(role,cue?.action??'idle'):null,[role,cue?.action]);
 useEffect(()=>{if(!cue||!motion)return;const timer=setTimeout(()=>setCue(null),Math.max(0,cue.at+motionDuration(motion)-Date.now()));return()=>clearTimeout(timer)},[cue,motion]);
 if(!role||!motion)return null;
 return <div className={`royal-character royal-${role}`} aria-label={role==='king'?'国王 · 地主':'公主 · 农民'}><MotionPlayback key={`${motion.id}:${cue?.at??0}`} motion={motion} animate={enabled&&!!cue} startAt={cue?.at} expiresAt={cue?cue.at+motionDuration(motion):undefined}/></div>;
}
