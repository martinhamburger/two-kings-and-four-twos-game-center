"use client";

import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {useParams,useSearchParams} from 'next/navigation';
import {ArrowLeft,RefreshCw} from 'lucide-react';
import Link from '@/components/site-navigation';
import {useClub} from '@/components/club-provider';
import AuthScreen from '@/components/auth-screen';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {api} from '@/lib/client';
import {ReplayPlayer,type ReplayFrame,type ReplayGame,type ReplayMessage} from '@/components/replay-player';
import '@/app/replay.css';
import '@/app/replay-viewer.css';
import '@/app/replay-mahjong.css';

type ReplayData={id:string;game:ReplayGame;created:number;frames:ReplayFrame[];events?:ReplayMessage[];perspective?:number;tv?:{status:'none'|'published';poster?:string;reason?:string;canManage:boolean}};
const names={landlord:'斗地主','landlord-v3':'技能斗地主',mahjong:'麻将',holdem:'德州扑克'};
const date=(at:number)=>new Date(at).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});

export default function ReplayPage(){
 const {id}=useParams<{id:string}>(),{user,setUser,loaded,loadLobby}=useClub();
 const params=useSearchParams(),fromTv=params.get('from')==='tv',fromMine=params.get('from')==='mine';
 const [refresh,setRefresh]=useState(0),[infoOpen,setInfoOpen]=useState(false);
 const infoButton=useRef<HTMLButtonElement>(null);
 const identity=`${user?.id??''}:${id}:${fromTv?'tv':'personal'}`,key=`${identity}:${refresh}`;
 const activeKey=useRef<string|null>(key);
 useLayoutEffect(()=>{activeKey.current=key;return()=>{activeKey.current=null}},[key]);
 const [response,setResponse]=useState<{key:string;data?:ReplayData;error?:string}|null>(null);
 const [mutation,setMutation]=useState<{key:string;busy?:boolean;error?:string;notice?:string}|null>(null);
 const [draft,setDraft]=useState({identity:'',anonymous:false,reason:''});
 const form=draft.identity===identity?draft:{identity,anonymous:false,reason:''};
 const data=response?.key===key?response.data:undefined,busy=!!user&&response?.key!==key;
 const status=mutation?.key===key?mutation:null;
 const error=(response?.key===key?response.error:'')||status?.error||'',submitting=!!status?.busy,notice=status?.notice;
 const {anonymous,reason}=form;
 const setAnonymous=(value:boolean)=>setDraft({...form,anonymous:value});
 const setReason=(value:string)=>setDraft({...form,reason:value});
 useEffect(()=>{void loadLobby().catch(()=>{})},[loadLobby]);
 useEffect(()=>{if(!user?.id||!id)return;let active=true;api(`/api/replays/${encodeURIComponent(id)}${fromTv?'?view=tv':''}`).then((data:ReplayData)=>{if(active)setResponse({key,data})}).catch(e=>{if(active){setResponse({key,error:e.message});if(e.status===401)setUser(null)}});return()=>{active=false}},[user?.id,id,fromTv,key,setUser]);
 async function updateTv(action:'submit'|'withdraw'){
  if(!data||submitting)return;
  const requestKey=key;setMutation({key,busy:true});
  try{const note=reason.trim();await api('/api/tv',{action,id:data.id,...(action==='submit'?{anonymous,reason:note}:{})});if(activeKey.current!==requestKey)return;setResponse(previous=>previous?.key===requestKey?{key:requestKey,data:{...data,tv:{...data.tv!,status:action==='submit'?'published':'none',poster:action==='submit'?(anonymous?'匿名玩家':user?.name):undefined,reason:action==='submit'?note:undefined}}}:previous);setMutation({key:requestKey,notice:action==='submit'?'这局已登上精彩 TV。':'已从精彩 TV 撤下这局。'})}
  catch(e){if(activeKey.current===requestKey)setMutation({key:requestKey,error:(e as Error).message})}
 }
 if(!loaded)return <main className="replay-page"><p>正在打开回放…</p></main>;
 if(!user)return <><AuthScreen onAuth={setUser}/>{error&&<p role="alert" className="form-error">{error}</p>}</>;
 let back=fromMine?'/replay':'/history';
 if(fromTv){back='/tv';try{const url=new URL(params.get('returnTo')??'/tv','https://sly.local');if(url.origin==='https://sly.local'&&url.pathname==='/tv'){const query=new URLSearchParams();const game=url.searchParams.get('game'),page=url.searchParams.get('page');if(game&&['landlord','mahjong','holdem'].includes(game))query.set('game',game);if(page&&/^\d{1,5}$/.test(page)&&Number(page)>0)query.set('page',page);back='/tv'+(query.size?'?'+query:'')}}catch{}}
 return <main className="replay-page replay-watch-page">
  <header className="replay-watch-heading"><Link href={back} className="replay-watch-back" aria-label={fromTv?'返回精彩 TV':fromMine?'返回我的回放':'返回对局记录'}><ArrowLeft size={20}/><span>{fromTv?'精彩 TV':fromMine?'我的回放':'对局记录'}</span></Link><div className="replay-watch-title"><h1>{data?names[data.game]:'对局回放'}</h1><span>{data?.tv?.status==='published'?`投稿人 · ${data.tv.poster??'匿名玩家'}`:'对局回放'}</span></div><Button ref={infoButton} variant="outline" className="replay-info-button" onClick={()=>setInfoOpen(true)} aria-label={data?.tv?.canManage?'投稿':'对局信息'}>{data?.tv?.canManage?'投稿':'详情'}</Button></header>
  {data?.tv?.reason&&<button className="replay-watch-reason" onClick={()=>setInfoOpen(true)}>“{data.tv.reason}”</button>}
  {error&&!data&&<section className="replay-empty" role="alert"><h2>这局暂时打不开</h2><p>{error}</p><Button onClick={()=>setRefresh(n=>n+1)}>重试</Button><Link href={back}>返回列表</Link></section>}
  {busy&&!data?<p role="status">正在读取这一局…</p>:null}
  {data&&<ReplayPlayer key={identity} game={data.game} frames={data.frames} events={data.events} perspective={data.perspective} suspended={infoOpen}/>}
  <Dialog open={infoOpen} onOpenChange={setInfoOpen}><DialogContent className="replay-info-modal" onCloseAutoFocus={e=>{e.preventDefault();infoButton.current?.focus()}}><DialogHeader><DialogTitle>这一局</DialogTitle><DialogDescription>{data?`${names[data.game]} · ${date(data.created)} · ${data.frames.length} 步`:'对局信息'}</DialogDescription></DialogHeader><Button variant="outline" disabled={busy||submitting} onClick={()=>{setInfoOpen(false);setRefresh(n=>n+1)}}><RefreshCw size={16}/>重新读取</Button>
  {data&&<>
   {data.tv?.status==='published'&&<div className="replay-story">{data.tv.reason&&<blockquote>“{data.tv.reason}”</blockquote>}<span>投稿人 · {data.tv.poster}</span></div>}
   {data.tv?.canManage&&data.tv.status==='none'&&<section className="replay-publish"><div><h2>把这局放上精彩 TV</h2><p>大家会看到全场手牌、当局昵称、聊天和表情。匿名只隐藏投稿人昵称。</p><label className="replay-reason-label" htmlFor="replay-reason">一句话推荐这局 <span>选填 · 最多 80 字</span></label><input id="replay-reason" maxLength={80} value={reason} onChange={event=>setReason(event.target.value)} placeholder="比如：最后一手完成逆转"/><fieldset className="replay-poster-options"><legend>投稿时显示</legend><label><input type="radio" name="tv-poster" checked={!anonymous} onChange={()=>setAnonymous(false)}/>我的昵称：{user.name}</label><label><input type="radio" name="tv-poster" checked={anonymous} onChange={()=>setAnonymous(true)}/>匿名玩家</label></fieldset></div><Button disabled={submitting} onClick={()=>void updateTv('submit')}>投稿这局</Button></section>}
   {data.tv?.canManage&&data.tv.status==='published'&&<div className="replay-manage"><span>这局已登上精彩 TV</span><Button variant="outline" disabled={submitting} onClick={()=>void updateTv('withdraw')}>撤下这局</Button></div>}
   {error&&<p role="alert" className="form-error">{error}</p>}{notice&&<p role="status" className="replay-notice">{notice}</p>}</>}
  </DialogContent></Dialog>
 </main>;
}
