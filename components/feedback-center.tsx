"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {MessageSquareHeart,Send} from 'lucide-react';
import {api} from '@/lib/client';
import {feedbackLength,FEEDBACK_TEXT_LIMIT} from '@/lib/club/feedback';
import {Button} from './ui/button';
import {Textarea} from './ui/textarea';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from './ui/dialog';
type Quota={day:string;used:number;remaining:number};
export function FeedbackCenter(){
 const [open,setOpen]=useState(false),[content,setContent]=useState(''),[quota,setQuota]=useState<Quota|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const pending=useRef(false),retry=useRef<{clientId:string;content:string}|null>(null);
 useEffect(()=>{if(!open)return;const controller=new AbortController();setQuota(null);setError('');void api('/api/feedback',undefined,controller.signal).then(q=>{if(!controller.signal.aborted)setQuota(q);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[open,refresh]);
 const text=content.trim(),length=feedbackLength(text);
 async function submit(e:FormEvent){
  e.preventDefault();if(pending.current||!quota||quota.remaining===0||!text||length>FEEDBACK_TEXT_LIMIT)return;
  pending.current=true;setBusy(true);setError('');setMessage('');
  const payload=retry.current?.content===text?retry.current:{clientId:crypto.randomUUID(),content:text};retry.current=payload;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const result=await api('/api/feedback',payload,controller.signal);setQuota(result);setContent('');retry.current=null;setMessage('谢谢你的建议！反馈已保存。');}catch(e){setError(controller.signal.aborted?'保存结果暂未确认，请重试；同一反馈不会重复计次。':(e as Error).message);}finally{clearTimeout(timer);pending.current=false;setBusy(false);}
 }
 return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="ghost" size="sm" className="club-feedback-link"><MessageSquareHeart size={19}/><span>反馈中心</span></Button></DialogTrigger><DialogContent className="feedback-dialog"><DialogHeader><span className="feedback-badge" aria-hidden="true"><MessageSquareHeart size={30}/></span><DialogTitle>反馈中心</DialogTitle><DialogDescription>哪里可以更好玩？把你的建议告诉我们。</DialogDescription></DialogHeader><form onSubmit={submit}><label htmlFor="player-feedback">你的意见</label><Textarea id="player-feedback" value={content} onChange={e=>{setContent(e.target.value);setMessage('');}} placeholder="遇到的问题、想要的功能，或一点小建议…" rows={5} disabled={busy} aria-describedby="feedback-count feedback-quota"/><div className="feedback-meta"><span id="feedback-quota">{quota?`今日还可反馈 ${quota.remaining} 次`:'正在读取今日额度…'}</span><span id="feedback-count" className={length>200?'feedback-over-limit':''}>{length} / 200 字</span></div><p className="feedback-note">每人每天最多 5 次，北京时间零点重置。反馈仅管理员可见。</p>{error&&<p role="alert" className="feedback-error">{error}</p>}{message&&<p role="status" className="feedback-success">{message}</p>}<div className="feedback-actions"><Button type="button" variant="ghost" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>刷新额度</Button><Button type="submit" disabled={busy||!quota||quota.remaining===0||!text||length>200}><Send size={16}/>{busy?'正在保存…':quota?.remaining===0?'今日次数已用完':'提交反馈'}</Button></div></form></DialogContent></Dialog>;
}
