"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {api} from '@/lib/client';
import {emptySocial,SOCIAL_POLL_MS,type SocialSnapshot} from '@/lib/club/social';
type SocialContext={data:SocialSnapshot;ready:boolean;busy:boolean;error:string;refresh:()=>Promise<void>;send:(payload:Record<string,unknown>)=>Promise<any>};
const Context=createContext<SocialContext|null>(null);
const RefreshContext=createContext<(()=>Promise<void>)|null>(null);
export function FriendsProvider({userId,children}:{userId:string|null;children:ReactNode}){
 const [state,setState]=useState<{owner:string|null;data:SocialSnapshot;ready:boolean;error:string}>({owner:null,data:emptySocial(),ready:false,error:''});
 const [busy,setBusy]=useState(false),serial=useRef(0),identity=useRef(userId),mutating=useRef(false),poll=useRef<AbortController|null>(null);
 identity.current=userId;
 const refresh=useCallback(async()=>{
  if(!userId||mutating.current||document.hidden)return;
  poll.current?.abort();const controller=new AbortController();poll.current=controller;const ticket=++serial.current;
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{const data=await api('/api/friends',{action:'heartbeat'},controller.signal);if(identity.current===userId&&ticket===serial.current)setState({owner:userId,data,ready:true,error:''});}
  catch(e){if(identity.current===userId&&ticket===serial.current&&!document.hidden)setState(s=>({owner:userId,data:s.owner===userId?s.data:emptySocial(),ready:false,error:'好友列表暂时连接不上，请重试'}));}
  finally{clearTimeout(timeout);if(poll.current===controller)poll.current=null;}
 },[userId]);
 useEffect(()=>{
  setState({owner:userId,data:emptySocial(),ready:false,error:''});setBusy(false);mutating.current=false;
  let generation=0,stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
  const run=async(epoch=generation)=>{await refresh();if(!stopped&&epoch===generation&&!document.hidden)timer=setTimeout(()=>void run(epoch),SOCIAL_POLL_MS);};
  const visibility=()=>{generation++;if(timer)clearTimeout(timer);poll.current?.abort();serial.current++;if(!document.hidden)void run();};
  if(userId)void run();document.addEventListener('visibilitychange',visibility);
  return()=>{stopped=true;if(timer)clearTimeout(timer);serial.current++;poll.current?.abort();document.removeEventListener('visibilitychange',visibility);};
 },[userId,refresh]);
 const send=useCallback(async(payload:Record<string,unknown>)=>{
  if(!userId||identity.current!==userId)throw Error('请先登录');
  if(mutating.current)throw Error('正在处理上一项操作，请稍候');
  mutating.current=true;setBusy(true);poll.current?.abort();const ticket=++serial.current;
  try{const data=await api('/api/friends',payload,AbortSignal.timeout(12000));if(identity.current!==userId)throw Error('账号已切换，请重新操作');if(ticket===serial.current&&Array.isArray(data.friends))setState({owner:userId,data,ready:true,error:''});return data;}
  finally{if(identity.current===userId){mutating.current=false;setBusy(false);}}
 },[userId]);
 const own=state.owner===userId;
 return <Context.Provider value={{data:own?state.data:emptySocial(),ready:own&&state.ready,busy,error:own?state.error:'',refresh,send}}><RefreshContext.Provider value={refresh}>{children}</RefreshContext.Provider></Context.Provider>;
}
export function useFriends(){const value=useContext(Context);if(!value)throw Error('FriendsProvider is required');return value;}

export function useFriendsRefresh(){const refresh=useContext(RefreshContext);if(!refresh)throw Error('FriendsProvider is required');return refresh;}
