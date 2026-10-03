"use client";
import {useEffect,useState} from 'react';
import {MessageSquareHeart,RefreshCw} from 'lucide-react';
import {api} from '@/lib/client';
import {Button} from './ui/button';
type Item={id:string;content:string;created:number;display:string;username:string};
export function AdminFeedback(){
 const [items,setItems]=useState<Item[]>([]),[next,setNext]=useState<number|null>(null),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(before?:number){setBusy(true);setError('');try{const data=await api('/api/admin/feedback'+(before?'?before='+before:''));setItems(old=>before?[...old,...data.items]:data.items);setNext(data.next);setLoaded(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{void load();},[]);
 return <div className="admin-panel"><div className="admin-feedback-heading"><h2><MessageSquareHeart size={21}/>玩家反馈</h2><Button variant="outline" disabled={busy} onClick={()=>void load()}><RefreshCw size={16}/>刷新</Button></div><p className="muted">按收到时间倒序排列，每页 50 条。仅管理员可以查看。</p>{error&&<p role="alert" className="form-error">{error}</p>}{items.map(item=><article className="admin-feedback-item" key={item.id}><header><b>{item.display}<small>@{item.username}</small></b><time dateTime={new Date(item.created).toISOString()}>{new Date(item.created).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</time></header><p>{item.content}</p></article>)}{!items.length&&<div className="admin-empty">{loaded?'还没有收到反馈。':'正在读取反馈…'}</div>}{next&&<Button disabled={busy} variant="outline" onClick={()=>void load(next)}>{busy?'读取中…':'加载更早的反馈'}</Button>}</div>;
}
