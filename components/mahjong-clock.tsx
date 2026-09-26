"use client";
import {useEffect,useState} from 'react';
import type {MahjongView} from '@/lib/mahjong/game';
export type MahjongClockSource={serverNow:number;receivedAt:number;game:MahjongView};
/** Keep ticks in the small consumers; the table never subscribes to this clock. */
export function useMahjongSeconds(room:MahjongClockSource){
 const end=room.game.deadline-(room.serverNow-room.receivedAt);
 const read=()=>Math.max(0,Math.ceil((end-Date.now())/1000));
 const [seconds,setSeconds]=useState(read);
 useEffect(()=>{const tick=()=>setSeconds(read());tick();const timer=setInterval(tick,250);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick)}},[end]);
 return seconds;
}
export function MahjongCountdown({room}:{room:MahjongClockSource}){const seconds=useMahjongSeconds(room);return <strong className={seconds<=5?'is-urgent':''} aria-label={`剩余 ${seconds} 秒`}>{seconds}</strong>}
