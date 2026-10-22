"use client";

import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {ArrowLeft,ArrowUpRight,RefreshCw,TvMinimalPlay} from 'lucide-react';
import Link,{useSiteRouter} from '@/components/site-navigation';
import {useClub} from '@/components/club-provider';
import AuthScreen from '@/components/auth-screen';
import {Button} from '@/components/ui/button';
import {api} from '@/lib/client';
import '@/app/tv.css';

type TvItem={id:string;game:'landlord'|'landlord-v3'|'mahjong'|'holdem';created:number;submitted:number;poster:string;reason:string};
const names={landlord:'斗地主','landlord-v3':'技能斗地主',mahjong:'麻将',holdem:'德州扑克'};
const minute=(at:number)=>new Date(at).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
type GameFilter='all'|'landlord'|'mahjong'|'holdem';

export default function TvPage(){
 const {user,setUser,loaded,loadLobby}=useClub(),params=useSearchParams(),{push,replace}=useSiteRouter();
 const rawGame=params.get('game'),game:GameFilter=rawGame==='landlord'||rawGame==='mahjong'||rawGame==='holdem'?rawGame:'all';
 const rawPage=params.get('page')??'0',page=/^\d{1,5}$/.test(rawPage)?Number(rawPage):0;
 const returnTo=`/tv?game=${game}&page=${page}`;
 const [feed,setFeed]=useState<{key:string;items:TvItem[];total:number;pageSize:number;error:string}|null>(null),[lobbyError,setLobbyError]=useState(''),[refresh,setRefresh]=useState(0);
 const key=`${user?.id??''}:${game}:${page}:${refresh}`;
 const busy=feed?.key!==key,items=busy?[]:feed?.items??[],total=busy?0:feed?.total??0,pageSize=busy?12:feed?.pageSize??12,error=busy?'':feed?.error??'';
 useEffect(()=>{let active=true;void loadLobby().catch(e=>{if(active)setLobbyError((e as Error).message)});return()=>{active=false}},[loadLobby]);
 useEffect(()=>{if(!user?.id)return;let active=true;api(`/api/tv?page=${page}&game=${game}`).then((result:{items:TvItem[];total:number;pageSize:number})=>{if(active){setFeed({key,...result,error:''});const lastPage=Math.max(0,Math.ceil(result.total/result.pageSize)-1);if(page>lastPage)replace(`/tv?game=${game}&page=${lastPage}`,{scroll:false})}}).catch(e=>{if(active){setFeed({key,items:[],total:0,pageSize:12,error:e.message});if(e.status===401)setUser(null)}});return()=>{active=false}},[user?.id,key,page,game,setUser,replace]);
 function filter(nextGame:GameFilter,nextPage=0){push(`/tv?game=${nextGame}&page=${nextPage}`,{scroll:false})}
 if(!loaded)return <main className="club-history tv-page"><p>正在打开精彩对局 TV…</p></main>;
 if(!user)return <><AuthScreen onAuth={setUser}/>{lobbyError&&<p role="alert" className="form-error">{lobbyError}</p>}</>;
 return <main className="club-history tv-page"><div className="club-history-heading"><div><Link href="/" className="history-back"><ArrowLeft size={16}/>返回游戏室</Link><h1>精彩对局 TV</h1><p>玩家投稿的完整对局回放，明牌看每一步。</p></div><Button variant="outline" disabled={busy} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={16}/>刷新</Button></div>
  <div className="tv-entry"><span>你也有一局想让大家看看？</span><Button asChild variant="outline"><Link href="/replay">我的回放 · 去投稿<ArrowUpRight size={16}/></Link></Button></div>
  <div className="history-filters"><div className="history-game-filters" role="group" aria-label="按游戏筛选">{(['all','landlord','mahjong','holdem'] as const).map(key=><Button key={key} variant={game===key?'default':'ghost'} aria-pressed={game===key} onClick={()=>filter(key)}>{key==='all'?'全部游戏':names[key]}</Button>)}</div></div>
  {error&&<p role="alert" className="form-error">{error}</p>}
  <div className="history-list-meta"><span>玩家投稿{total?` · ${total} 场`:''}</span><span role="status">{busy?'正在更新…':error?'读取失败，可刷新重试':'明牌看看大家怎么打'}</span></div>
  {items.length?<section className="tv-list" aria-label="精彩对局列表" aria-busy={busy}>{items.map(item=><Link href={`/replay/${encodeURIComponent(item.id)}?from=tv&returnTo=${encodeURIComponent(returnTo)}`} className="history-item tv-card" key={item.id}><span className={`history-game-mark ${item.game}`} aria-hidden="true">{item.game.startsWith('landlord')?'♠':item.game==='mahjong'?'萬':'♣'}</span><span className="history-item-copy"><span className="history-item-tags"><span>{names[item.game]}</span><span>公开回放</span></span><strong className="tv-card-title">{names[item.game]} · 精彩对局</strong>{item.reason&&<span className="tv-card-reason">“{item.reason}”</span>}<span className="tv-card-poster">投稿人：{item.poster}</span><span className="tv-card-time">投稿 {minute(item.submitted)} · 对局 {minute(item.created)}</span></span><span className="tv-card-open">观看回放<ArrowUpRight size={18}/></span></Link>)}</section>:<div className="history-empty"><TvMinimalPlay size={32}/><h2>{busy?'正在读取投稿':error?'暂时没能读取投稿':'本页还没有这类投稿'}</h2><p>{busy?'稍等片刻。':error?'点刷新再试一次。':'去我的回放，挑一局分享给大家。'}</p></div>}
  {!busy&&!error&&(total>pageSize||page>0)&&<div className="history-pagination"><Button variant="outline" disabled={page===0} onClick={()=>filter(game,page-1)}>上一页</Button><span>{page+1} / {Math.max(1,Math.ceil(total/pageSize))}</span><Button variant="outline" disabled={(page+1)*pageSize>=total} onClick={()=>filter(game,page+1)}>下一页</Button></div>}
 </main>;
}
