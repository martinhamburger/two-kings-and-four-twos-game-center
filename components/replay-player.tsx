"use client";

import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,List,Pause,Play,RotateCcw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {ReplayLandlordTable} from '@/components/replay-landlord-table';
import {ReplayMahjongTable} from '@/components/replay-mahjong-table';
import {ReplayHoldemTable} from '@/components/replay-holdem-table';
import type {ChatBubble} from '@/lib/chat-bubbles';
import {EMOTE_MS,emoteText} from '@/lib/emotes';
import type {ReplayFrame,ReplayGame} from '@/lib/replay/types';
import {replayTimeline,replayStepPositions,type ReplayMoment} from '@/lib/replay/playback';

export type {ReplayFrame,ReplayGame} from '@/lib/replay/types';
export type ReplayMessage={id:number;at:number;seat:number;kind:'text'|'emote';text?:string;emoteId?:string};
const EMPTY_EVENTS:ReplayMessage[]=[];

function duration(moment:ReplayMoment,speed:number):number{
 if(moment.kind==='action')return 2000/speed;
 const event=moment.event!;
 if(event.kind==='emote')return 1600/speed;
 return (event.text?.length??0)>45?2200/speed:1100/speed;
}

function thinkTime(frame:ReplayFrame):string{
 const timed=frame as ReplayFrame&{durationMs?:number;timing?:'manual'|'timeout'|'automatic'};
 if(timed.timing==='automatic')return '自动';
 if(timed.durationMs===undefined)return '';
 const seconds=(timed.durationMs/1000).toFixed(1);
 return timed.timing==='timeout'?`超时 · ${seconds} 秒`:`用时 ${seconds} 秒`;
}

export function ReplayPlayer({game,frames,events=EMPTY_EVENTS,perspective=0,suspended=false}:{game:ReplayGame;frames:ReplayFrame[];events?:ReplayMessage[];perspective?:number;suspended?:boolean}){
 const moments=useMemo(()=>replayTimeline(frames,events),[frames,events]);
 const actionPositions=useMemo(()=>replayStepPositions(moments),[moments]);
 const element=useRef<HTMLElement>(null);
 const recordsButton=useRef<HTMLButtonElement>(null);
 const [recordsOpen,setRecordsOpen]=useState(false);
 const [cursor,setCursor]=useState(()=>({index:0,enteredAt:Date.now()})),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[autoplayPending,setAutoplayPending]=useState(true);
 const safePosition=Math.min(cursor.index,Math.max(0,moments.length-1));
 const moment=moments[safePosition],frame=moment?frames[moment.frameIndex]:undefined;
 useEffect(()=>{
  const pause=()=>{if(document.hidden){setAutoplayPending(false);setPlaying(false)}};
  document.addEventListener('visibilitychange',pause);pause();
  return()=>document.removeEventListener('visibilitychange',pause);
 },[]);
 useEffect(()=>{if(!suspended)return;const timer=window.setTimeout(()=>{setAutoplayPending(false);setPlaying(false)},0);return()=>window.clearTimeout(timer)},[suspended]);
 useEffect(()=>{
  if(suspended||!autoplayPending||moments.length<2)return;
  const timer=window.setTimeout(()=>{setAutoplayPending(false);if(!document.hidden)setPlaying(true)},1000);
  return()=>window.clearTimeout(timer);
 },[suspended,autoplayPending,moments.length]);
 useEffect(()=>{
  if(suspended||recordsOpen||!playing||!moment)return;
  const timer=window.setTimeout(()=>{
   if(safePosition>=moments.length-1){setPlaying(false);return;}
   const next=safePosition+1;
   setCursor({index:next,enteredAt:Date.now()});
  },duration(moment,speed));
  return()=>window.clearTimeout(timer);
 },[suspended,recordsOpen,playing,safePosition,moments,moment,speed]);
 useEffect(()=>{
  const node=element.current;if(!node)return;
  const measure=()=>node.style.setProperty('--viewer-height',`${Math.max(240,window.innerHeight-node.getBoundingClientRect().top-12)}px`);
  const observer=new ResizeObserver(measure);observer.observe(node.parentElement!);window.addEventListener('resize',measure);measure();
  return()=>{observer.disconnect();window.removeEventListener('resize',measure)};
 },[]);
 const toggle=()=>{if(suspended||recordsOpen||document.hidden)return;setAutoplayPending(false);if(playing)setPlaying(false);else{if(safePosition===moments.length-1)setCursor({index:0,enteredAt:Date.now()});setPlaying(true)}};
 const previousAction=actionPositions.findLast(i=>i<safePosition),nextAction=actionPositions.find(i=>i>safePosition);
 const jump=(target:number)=>{setAutoplayPending(false);setPlaying(false);setCursor({index:target,enteredAt:Date.now()})};
 useEffect(()=>{
  const keydown=(event:KeyboardEvent)=>{const target=event.target as HTMLElement;if(suspended||recordsOpen||event.defaultPrevented||event.repeat||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||target.closest('input,select,textarea,button,a,[role="dialog"],[contenteditable="true"]'))return;if(event.code==='Space'){event.preventDefault();toggle()}else if(event.code==='ArrowLeft'&&previousAction!==undefined){event.preventDefault();jump(previousAction)}else if(event.code==='ArrowRight'&&nextAction!==undefined){event.preventDefault();jump(nextAction)}else if(event.code==='Home'){event.preventDefault();jump(0)}else if(event.code==='End'&&actionPositions.length){event.preventDefault();jump(actionPositions.at(-1)!)}};
  window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);
 });
 if(!frame)return <p className="replay-empty">这局还没有可播放的记录。</p>;

 const event=moment.event,seat=event?frame.scene.seats[event.seat]:undefined;
 const bubble:ChatBubble|undefined=event&&seat?.id?{message:{id:event.id,senderId:seat.id,name:seat.name,text:event.text??emoteText(event.emoteId),created:event.at,own:0,kind:event.kind,emoteId:event.emoteId},expires:cursor.enteredAt+EMOTE_MS}:undefined;
 const bubbles=bubble&&seat?.id?{[seat.id]:bubble}:{};
 const currentAction=moment.frameIndex;
 const actor=frame.actor===undefined?undefined:frame.scene.seats[frame.actor];
 const tableAction=frame.actor===undefined?undefined:frame.scene.tableActions?.[frame.actor];
 const actionLabel=actor&&tableAction?.kind==='play'?`${actor.name} · ${tableAction.label??'出牌'}`:frame.action;
 const ended=!playing&&!autoplayPending&&safePosition===moments.length-1;

 return <section ref={element} className="replay-player" aria-label="对局回放">
  <div className="replay-table-stage">
   {game==='mahjong'?<ReplayMahjongTable frame={frame} perspective={perspective} bubbles={bubbles} onInspect={()=>{setAutoplayPending(false);setPlaying(false)}}/>:game==='holdem'?<ReplayHoldemTable frame={frame} perspective={perspective} bubbles={bubbles}/>:<ReplayLandlordTable frame={frame} perspective={perspective} bubbles={bubbles}/>}
  </div>
  <div className="replay-viewer-bar">
   <div className="replay-now"><span>{currentAction+1} / {frames.length} 步</span><strong title={event?event.text:frame.action}>{event?`${seat?.name??'玩家'} · ${event.kind==='emote'?'发送表情':'聊天'}`:actionLabel}</strong>{!event&&thinkTime(frame)&&<small>{thinkTime(frame)}</small>}</div>
   <div className="replay-controls" role="group" aria-label="回放控制">
    <Button variant="outline" size="sm" disabled={previousAction===undefined} onClick={()=>jump(previousAction!)} aria-label="上一步"><ChevronLeft size={17}/></Button>
    <Button variant="outline" size="sm" onClick={toggle} aria-label={playing?'暂停':ended?'再看一遍':'播放'}>{playing?<Pause size={17}/>:ended?<RotateCcw size={17}/>:<Play size={17}/>}</Button>
    <Button variant="outline" size="sm" disabled={nextAction===undefined} onClick={()=>jump(nextAction!)} aria-label="下一步"><ChevronRight size={17}/></Button>
    <select aria-label="播放速度" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select>
    <Button ref={recordsButton} variant="outline" size="sm" aria-label="逐步记录与聊天" onClick={()=>{setAutoplayPending(false);setPlaying(false);setRecordsOpen(true)}}><List size={18}/></Button>
   </div>
   <input className="replay-progress" type="range" aria-label="回放进度" aria-valuetext={`第 ${currentAction+1} 步，共 ${frames.length} 步：${frame.action}`} min={0} max={Math.max(0,frames.length-1)} value={currentAction} onChange={e=>jump(actionPositions[Number(e.target.value)])}/>
  </div>
  <Dialog open={recordsOpen} onOpenChange={setRecordsOpen}><DialogContent className="replay-info-modal" onOpenAutoFocus={e=>{const list=document.querySelector('.replay-timeline ol'),current=list?.querySelector<HTMLElement>('[aria-current="step"] button');if(list&&current){e.preventDefault();current.focus({preventScroll:true});list.scrollTop=current.offsetTop-(list as HTMLElement).offsetTop-list.clientHeight/2+current.offsetHeight/2}}} onCloseAutoFocus={e=>{e.preventDefault();recordsButton.current?.focus()}}><DialogHeader><DialogTitle>逐步记录与聊天</DialogTitle><DialogDescription>{frames.length} 步{events.length?` · ${events.length} 条消息`:''} · 点一条回到牌桌</DialogDescription></DialogHeader><div className="replay-timeline"><ol>{moments.map((item,i)=>{const step=frames[item.frameIndex],message=item.event;return <li key={`${item.kind}-${i}`} aria-current={i===safePosition?'step':undefined}><button type="button" onClick={()=>{jump(i);setRecordsOpen(false)}}><span>{item.kind==='action'?`第 ${item.frameIndex+1} 步`:'聊天'}</span><strong>{message?`${step.scene.seats[message.seat]?.name??'玩家'}：${message.kind==='emote'?emoteText(message.emoteId):message.text??''}`:step.action}</strong>{item.kind==='action'&&thinkTime(step)&&<small>{thinkTime(step)}</small>}</button></li>})}</ol></div></DialogContent></Dialog>
 </section>;
}
