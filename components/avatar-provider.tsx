"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {defaultAvatar,mergeProfiles,type AvatarProfile} from '@/lib/avatar/profile';
import {useFriends} from './friends-provider';
import {AvatarEditor} from './avatar-editor';
class AvatarStore{
 profiles:Record<string,AvatarProfile>={};listeners=new Set<()=>void>();
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn)}};
 merge=(profiles:AvatarProfile[])=>{const next=mergeProfiles(this.profiles,profiles);if(next===this.profiles)return;this.profiles=next;for(const fn of this.listeners)fn();};
 read=(id?:string)=>id?this.profiles[id]??defaultAvatar:defaultAvatar;
}
const emptyStore=new AvatarStore();
const Context=createContext<{store:AvatarStore;userId:string|null;edit:()=>void}>({store:emptyStore,userId:null,edit:()=>{}});
export function AvatarProvider({userId,children}:{userId:string|null;children:ReactNode}){return <AccountAvatars key={userId??'anonymous'} userId={userId}>{children}</AccountAvatars>}
function AccountAvatars({userId,children}:{userId:string|null;children:ReactNode}){
 const store=useRef(new AvatarStore()).current,{data}=useFriends(),[open,setOpen]=useState(false);
 const edit=useCallback(()=>setOpen(true),[]),value=useRef({store,userId,edit}).current;
 useEffect(()=>{store.merge(data.profiles??[])},[data.profiles,store]);
 return <Context.Provider value={value}>{children}{userId&&open&&<AvatarEditor userId={userId} profile={store.read(userId)} accept={store.merge} close={()=>setOpen(false)}/>}</Context.Provider>;
}
export function useAvatar(id?:string){const context=useContext(Context),read=useCallback(()=>context.store.read(id),[context.store,id]);const profile=useSyncExternalStore(context.store.subscribe,read,()=>defaultAvatar);return {profile,editable:!!id&&id===context.userId,edit:context.edit};}
export function useRoomAvatarSync(code?:string){const {refresh}=useFriends();useEffect(()=>{if(code)void refresh()},[code,refresh]);}
