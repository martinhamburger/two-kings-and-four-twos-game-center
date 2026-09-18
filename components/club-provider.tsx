"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,useSyncExternalStore,type ReactNode,type SetStateAction} from 'react';
import Link from '@/components/site-navigation';import {usePathname} from 'next/navigation';import {useSiteRouter} from '@/components/site-navigation';
import {Club,History,LogOut,Settings} from 'lucide-react';
import {gamePaths,gameAPIs,roomDestination} from '@/lib/club/routes';
import type {HistoryGame} from '@/lib/club/history';
import {api} from '@/lib/client';import {ClubMemory} from '@/lib/club/memory';import {GameNav} from './game-nav';import {Button} from './ui/button';
import {FriendsProvider} from './friends-provider';
import {FriendsMenu} from './friends-panel';
import {version as appVersion} from '@/package.json';
export type ClubUser={id:string;name:string;username:string;role:string;score:number};
export type ClubLobby={departurePending?:boolean;user:ClubUser;config:{announcement:string;seconds:number;maintenance:boolean};activeRoom:string|null;activeKind:'landlord'|'landlord-v3'|'mahjong'|'holdem'|null};
type ClubContext={user:ClubUser|null;loaded:boolean;error:string;lobby:ClubLobby|null;memory:ClubMemory;setUser:(u:ClubUser|null)=>void;loadLobby:(force?:boolean)=>Promise<ClubLobby|null>;logout:()=>Promise<void>};
const Context=createContext<ClubContext|null>(null);
export function ClubProvider({children}:{children:ReactNode}){
 const [user,setUserState]=useState<ClubUser|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[lobby,setLobby]=useState<ClubLobby|null>(null);
 const memory=useRef(new ClubMemory()).current,identity=useRef<ClubUser|null>(null),current=useRef<ClubLobby|null>(null),at=useRef(0),request=useRef<Promise<ClubLobby|null>|null>(null);
 const setUser=useCallback((u:ClubUser|null)=>{if(identity.current?.id!==u?.id){memory.clear();current.current=null;setLobby(null);at.current=0;request.current=null;}identity.current=u;setUserState(u);setLoaded(true);setError('');},[memory]);
 const loadLobby=useCallback((force=false):Promise<ClubLobby|null>=>{
  if(request.current)return request.current;
  if(!force&&at.current&&Date.now()-at.current<30000)return Promise.resolve(current.current);
  const epoch=memory.epoch;
  const pending=api('/api/lobby').then(d=>{if(memory.epoch!==epoch)return current.current;setUser(d.user);const next=d.user?d as ClubLobby:null;current.current=next;setLobby(next);at.current=Date.now();return next;}).catch(e=>{if(memory.epoch===epoch){if(e.status===401)setUser(null);else setError(e.message);setLoaded(true);}throw e;}).finally(()=>{if(request.current===pending)request.current=null;});
  request.current=pending;return pending;
 },[memory,setUser]);
 const logout=useCallback(async()=>{await api('/api/auth',{action:'logout'});setUser(null);at.current=Date.now();},[setUser]);
 // A successful login updates the shared lobby once, not once per game.
 useEffect(()=>{if(user?.id)void loadLobby().catch(()=>{});},[user?.id,loadLobby]);
 useEffect(()=>{if(!user?.id||!lobby?.departurePending)return;const timer=setInterval(()=>{void loadLobby(true).catch(()=>{});},3000);return()=>clearInterval(timer);},[user?.id,lobby?.departurePending,loadLobby]);
 return <Context.Provider value={{user,loaded,error,lobby,memory,setUser,loadLobby,logout}}><FriendsProvider userId={user?.id??null}><ClubChrome/>{children}</FriendsProvider></Context.Provider>;
}
export function useClub(){const c=useContext(Context);if(!c)throw Error('ClubProvider is required');return c;}
export function useClubState<T>(key:string,initial:T):[T,(value:SetStateAction<T>)=>void]{
 const {memory}=useClub(),fallback=useRef(initial).current,epoch=memory.epoch;
 const subscribe=useCallback((fn:()=>void)=>memory.subscribe(key,fn),[memory,key]);
 const read=useCallback(()=>memory.get(key,fallback),[memory,key,fallback]);
 const server=useCallback(()=>fallback,[fallback]);
 const value=useSyncExternalStore(subscribe,read,server);
 const set=useCallback((next:SetStateAction<T>)=>memory.set(key,next,fallback,epoch),[memory,key,fallback,epoch]);
 return [value,set];
}
function ClubChrome(){const {user,logout}=useClub(),path=usePathname();if(!user||!['/','/mahjong','/holdem','/history'].includes(path))return null;return <header className="app-header club-header"><Link href="/" className="brand"><span className="brand-icon"><Club size={21}/></span><span><span className="club-brand-title">娱乐中心<span className="club-brand-version" title={`版本 ${appVersion}`}>v{appVersion}</span></span><small>好 友 游 戏 室</small></span></Link><GameNav current={path==='/mahjong'?'mahjong':path==='/holdem'?'holdem':path==='/history'?'history':'landlord'}/><div className="header-right"><FriendsMenu/><Link href="/history" className={`club-history-link ${path==='/history'?'is-current':''}`} aria-current={path==='/history'?'page':undefined}><History size={17}/><span>对局记录</span></Link>{user.role==='admin'&&<Button variant="ghost" size="icon" asChild><Link href="/admin" aria-label="管理后台"><Settings size={18}/></Link></Button>}<span className="club-user" title={user.name}>{user.name}</span><Button variant="ghost" size="icon" aria-label="退出登录" onClick={()=>void logout().catch(()=>{})}><LogOut size={18}/></Button></div></header>}
export function HistoryEntry({game}:{game:'landlord'|'mahjong'|'holdem'}){return <Link href={'/history?game='+game} className="club-history-entry"><History size={21}/><div><b>对局记录</b><span>查看过去的输赢与战报</span></div><span aria-hidden="true">→</span></Link>}

export function useRoomNavigation(){const {memory,loadLobby}=useClub(),router=useSiteRouter();
 const enter=useCallback(async(game:HistoryGame|'landlord-v3',code:string,join=false)=>{const routeGame=game==='landlord-v3'?'landlord':game,epoch=memory.epoch;const r=await api(gameAPIs[routeGame]+(join?'':'?room='+code),join?{action:'join',code}:undefined);if(memory.epoch!==epoch)return;if(r.redirect)throw Error('房间类型发生变化，请重试');memory.set<any>(routeGame+':room',(old:any)=>old?.code===r.code&&old.revision>r.revision?old:{...r,receivedAt:Date.now()},null,epoch);await loadLobby(true);if(memory.epoch===epoch)router.push(gamePaths[routeGame]);return r;},[memory,loadLobby,router]);
 const followRoom=useCallback((href:string)=>{const {game,code}=roomDestination(href);return enter(game,code,true)},[enter]);
 return {openRoom:enter,followRoom};
}
