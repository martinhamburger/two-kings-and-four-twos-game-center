"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {api} from '@/lib/client';
import {mergeMessages,mergePolledMessages} from '@/lib/chat-messages';
import {createSerialPoller} from '@/lib/sync/poller';
import type {ChatMessage,ChatSnapshot,ChatReceipt} from '@/lib/chat-bubbles';

export type ChatFeed={messages:ChatMessage[];cursor:number;hasMore:boolean;serverNow:number;emoteReadyAt:number;closed:boolean};
export type MessageTransport={scope?:string;load:(after:number|null,signal:AbortSignal,current:()=>boolean)=>Promise<ChatFeed>;interval:()=>number;onError?:(error:unknown)=>void;onConnected?:()=>void};
type Controls={code:string;refresh:()=>void;pause:()=>void;resume:(immediate?:boolean)=>void;signal:AbortSignal;receive:(receipt:ChatReceipt)=>void};
const empty=(code:string)=>({code,messages:[] as ChatMessage[],initialized:false,closed:false,readyAt:0,error:''});

/** One message store, whether driven by chat polling or a combined game transport. */
export function useRoomMessages(code:string,onSnapshot?:(snapshot:ChatSnapshot)=>void,transport?:MessageTransport){
 const [state,setState]=useState(()=>empty(code));
 const callback=useRef(onSnapshot),source=useRef(transport);callback.current=onSnapshot;source.current=transport;
 const controls=useRef<Controls|null>(null),external=!!transport,scope=transport?.scope;
 useEffect(()=>{
  setState(empty(code));if(!code)return;
  let cursor:number|null=null,suppress=true,fullNext=true,blocked=false,mutating=false,readyServer=0;
  const lifetime=new AbortController();let receipts:ChatMessage[]=[];
  const available=()=>!blocked&&!document.hidden&&navigator.onLine&&!mutating;
  const poller=createSerialPoller({
   interval:()=>source.current?.interval()??1000,
   task:async(signal,current)=>{
    const full=fullNext||cursor===null,quiet=suppress;
    const data:ChatFeed=source.current
     ?await source.current.load(full?null:cursor,signal,current)
     :await api('/api/chat?room='+code+(full?'':'&after='+cursor),undefined,signal);
    if(!current())return;
    source.current?.onConnected?.();cursor=data.cursor;fullNext=false;suppress=false;
    const unpolled=receipts;receipts=receipts.filter(m=>m.id>data.cursor);
    const readyAt=data.emoteReadyAt>readyServer?Date.now()+Math.max(0,data.emoteReadyAt-data.serverNow):0;
    readyServer=Math.max(readyServer,data.emoteReadyAt);
    setState(prev=>{
     const messages=!full&&!data.messages.length&&!unpolled.length?prev.messages:mergePolledMessages(prev.messages,data.messages,unpolled,full);
     if(prev.initialized&&prev.closed===data.closed&&!prev.error&&messages===prev.messages&&readyAt<=prev.readyAt)return prev;
     return {code,messages,initialized:true,closed:data.closed,readyAt:Math.max(prev.readyAt,readyAt),error:''};
    });
    if(quiet||data.messages.length)callback.current?.({...data,suppressReplay:quiet});
    blocked=data.closed;if(blocked)poller.pause();else if(data.hasMore)poller.refresh();
   },
   onError:error=>{
    const problem=error as Error&{status?:number};suppress=true;fullNext=true;
    blocked=problem.status===401||problem.status===403;
    if(blocked)poller.pause();
    setState(prev=>({...prev,initialized:blocked?false:prev.initialized,error:blocked?problem.message:'连接中断，正在重连…'}));
    source.current?.onError?.(error);
   },
  });
  const receive=(receipt:ChatReceipt)=>{
   if(lifetime.signal.aborted)return;
   receipts=mergeMessages(receipts,[receipt.message]);
   setState(prev=>({...prev,messages:mergeMessages(prev.messages,[receipt.message]),readyAt:Math.max(prev.readyAt,Date.now()+Math.max(0,receipt.emoteReadyAt-receipt.serverNow))}));
   callback.current?.({delivery:'receipt',messages:[receipt.message],serverNow:receipt.serverNow,suppressReplay:document.hidden});
  };
  controls.current={code,receive,signal:lifetime.signal,
   refresh:()=>{suppress=true;fullNext=true;if(available())poller.refresh();},
   pause:()=>{mutating=true;poller.pause();},
   resume:(immediate=false)=>{mutating=false;if(available())poller.resume(immediate);},
  };
  const visibility=()=>{suppress=true;fullNext=true;poller.pause();if(available())poller.resume(true);};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('offline',visibility);window.addEventListener('online',visibility);
  if(available())poller.resume(true);
  return()=>{lifetime.abort();poller.stop();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('offline',visibility);window.removeEventListener('online',visibility);if(controls.current?.code===code)controls.current=null;};
 },[code,external,scope]);
 const receive=useCallback((receipt:ChatReceipt)=>{if(controls.current?.code===code)controls.current.receive(receipt);},[code]);
 const refresh=useCallback(()=>{if(controls.current?.code===code)controls.current.refresh();},[code]);
 const pause=useCallback(()=>{if(controls.current?.code===code)controls.current.pause();},[code]);
 const resume=useCallback((immediate=false)=>{if(controls.current?.code===code)controls.current.resume(immediate);},[code]);
 const signal=useCallback(()=>controls.current?.code===code?controls.current.signal:AbortSignal.abort(),[code]);
 return useMemo(()=>({...(state.code===code?state:empty(code)),receive,refresh,pause,resume,signal}),[state,code,receive,refresh,pause,resume,signal]);
}
export type RoomMessageStream=ReturnType<typeof useRoomMessages>;
