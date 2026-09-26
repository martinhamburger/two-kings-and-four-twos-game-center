"use client";
import {useEffect,useState,type ComponentProps} from 'react';
import {remainingSeconds,type RoomTiming} from '@/lib/sync/clock';
import {TurnClock} from './table-ui';
import {Button} from './ui/button';

export function useRemainingSeconds(deadline:number,timing?:RoomTiming){
 const [seconds,setSeconds]=useState(()=>remainingSeconds(deadline,Date.now(),timing?.offset()??0));
 useEffect(()=>{
  if(!timing||!deadline){setSeconds(0);return;}
  let timer:ReturnType<typeof setTimeout>|undefined;
  const tick=()=>{
   clearTimeout(timer);const left=deadline-Date.now()-timing.offset();
   setSeconds(remainingSeconds(deadline,Date.now(),timing.offset()));
   if(left>0&&!document.hidden)timer=setTimeout(tick,(left%1000||1000)+5);
  };
  const unsubscribe=timing.subscribe(tick);document.addEventListener('visibilitychange',tick);tick();
  return()=>{clearTimeout(timer);unsubscribe();document.removeEventListener('visibilitychange',tick);};
 },[deadline,timing]);
 return seconds;
}
export function DeadlineClock({deadline,timing,label}:{deadline:number;timing:RoomTiming;label:string}){
 const seconds=useRemainingSeconds(deadline,timing);return <TurnClock seconds={seconds} label={label}/>;
}

export function DeadlineButton({deadline,timing,disabled,...props}:ComponentProps<typeof Button>&{deadline:number;timing:RoomTiming}){
 const seconds=useRemainingSeconds(deadline,timing);return <Button {...props} disabled={disabled||seconds<=0}/>;
}
