"use client";
import {memo,useEffect,useState} from 'react';
import type {V3Game} from '@/lib/game/landlord-v3';
import type {RoomTiming} from '@/lib/sync/clock';
/** Notices expire once, without asking the entire table to tick every 250 ms. */
export const EquipmentFeed=memo(function EquipmentFeed({game,timing}:{game:V3Game;timing:RoomTiming}){
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  const update=()=>{
   clearTimeout(timer);const current=Date.now();setNow(current);
   const next=game.log.filter(entry=>entry.kind==='equipment').map(entry=>entry.at+6000-timing.offset()).filter(expiry=>expiry>current).sort((a,b)=>a-b)[0];
   if(next!==undefined)timer=setTimeout(update,next-current+5);
  };
  const unsubscribe=timing.subscribe(update);update();return()=>{clearTimeout(timer);unsubscribe();};
 },[game,timing]);
 const feed=game.log.filter(entry=>entry.kind==='equipment'&&entry.at>now+timing.offset()-6000).slice(-3);
 if(!feed.length)return null;
 const names=new Map(game.rules.equipmentCatalog.map(item=>[item.id,item.name]));
 return <div className="v3-equipment-feed" role="status" aria-live="polite">{feed.map((entry,index)=><p key={`${entry.at}-${index}`}>{entry.id&&names.get(entry.id)&&<b>{names.get(entry.id)}</b>}{entry.text}</p>)}</div>;
});
