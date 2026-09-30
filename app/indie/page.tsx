"use client";
import {useEffect,useState} from 'react';
import {Club} from 'lucide-react';
import AuthScreen from '@/components/auth-screen';
import {LastPixelEntry} from '@/components/last-pixel-entry';
import {MinesweeperEntry} from '@/components/minesweeper-entry';
import {useClub} from '@/components/club-provider';

export default function IndiePage(){
 const {user,setUser,loaded,loadLobby}=useClub(),[error,setError]=useState('');
 useEffect(()=>{void loadLobby().catch(e=>setError(e.message));},[loadLobby]);
 if(!loaded)return <main className="mj-loading"><span className="brand-icon"><Club size={22}/></span><p>正在打开游戏室…</p></main>;
 if(!user)return <><AuthScreen onAuth={setUser}/>{error&&<div className="floating-error" role="alert">{error}<button onClick={()=>loadLobby(true).catch(()=>{})}>重试</button></div>}</>;
 return <div className="app-shell indie-shell"><main className="indie-lobby"><header className="indie-heading"><span>娱 乐 中 心 / 更 多</span><h1>换一种玩法</h1><p>这里收录独立作品与实验玩法。成熟版本可以直接打开，开发中的内容会明确标注。</p></header><div className="indie-game-list"><LastPixelEntry/><MinesweeperEntry/></div></main></div>;
}
