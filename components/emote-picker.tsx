"use client";
import {useState} from 'react';
import {AnimationCacheControl} from './animation-cache';
import {warmMotionSheet} from '@/lib/motion/decoded-sheets';
import {Smile,Star,X} from 'lucide-react';
import {EMOTES} from '@/lib/emotes';
import {EmoteImage} from './emote';
import {useEmotePreferences} from './emote-preferences';
import {Button} from './ui/button';
import {Popover,PopoverContent,PopoverTrigger} from './ui/popover';
import {Switch} from './ui/switch';
import {Tabs,TabsList,TabsTrigger,TabsContent} from './ui/tabs';
export function EmotePicker({userId,disabled,cooldown,error,onSend}:{userId:string;disabled:boolean;cooldown:number;error:string;onSend:(id:string)=>boolean}){
 const [open,setOpen]=useState(false),[tab,setTab]=useState('all');const {prefs,update}=useEmotePreferences(userId);
 return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="outline" className="emote-launch" aria-label="发送表情" aria-expanded={open}><Smile size={22}/></Button></PopoverTrigger><PopoverContent align="end" side="top" sideOffset={12} collisionPadding={12} className="emote-picker"><header><div><b>牌桌表情</b><small>给同桌一个表情</small></div><Button variant="ghost" size="icon" aria-label="收起表情" onClick={()=>setOpen(false)}><X size={17}/></Button></header>
 <Tabs value={tab} onValueChange={setTab}><TabsList className="emote-tabs" aria-label="表情分类">{[['all','全部'],['favorites','收藏']].map(([id,label])=><TabsTrigger key={id} value={id}>{label}</TabsTrigger>)}</TabsList>
 <TabsContent value={tab}><div className="emote-grid">{EMOTES.filter(e=>e.enabled&&e.sendable!==false&&(tab==='all'||prefs.favorites.includes(e.id))).map(e=><div className="emote-cell" key={e.id}><button aria-label={'发送表情：'+e.name} disabled={disabled||cooldown>0} onPointerEnter={()=>e.frames?.sheets.forEach(s=>warmMotionSheet(s.src))} onFocus={()=>e.frames?.sheets.forEach(s=>warmMotionSheet(s.src))} onClick={()=>{if(onSend(e.id)){if(window.matchMedia('(max-width:580px)').matches)setOpen(false)}}}><EmoteImage id={e.id}/><span className="emote-name">{e.name}</span></button><button className="emote-favorite" aria-label={(prefs.favorites.includes(e.id)?'取消收藏':'收藏')+e.name} aria-pressed={prefs.favorites.includes(e.id)} onClick={()=>update({favorites:prefs.favorites.includes(e.id)?prefs.favorites.filter(id=>id!==e.id):[...prefs.favorites,e.id]})}><Star size={13}/></button></div>)}{tab==='favorites'&&!prefs.favorites.length&&<p className="emote-empty">点亮小星星，把常用表情放在这里。</p>}</div></TabsContent></Tabs>
 <div className="emote-status" role={error?'alert':'status'}>{error||(cooldown>0?`${cooldown} 秒后可以再发`:disabled?'暂时不能发送':'每 3 秒可发一次 · 点击即发送')}</div>
 <a className="emote-gallery-link" href="/emotes" target="_blank" rel="noreferrer">打开表情与特效图鉴 ↗</a>
 <AnimationCacheControl/><div className="emote-settings"><label htmlFor="table-effects">牌型特效<Switch id="table-effects" checked={prefs.effects} onCheckedChange={effects=>update({effects})}/></label><label htmlFor="emote-animate">显示他人表情动画<Switch id="emote-animate" checked={prefs.animateOthers} onCheckedChange={animateOthers=>update({animateOthers})}/></label><label htmlFor="emote-sound">表情声音<Switch id="emote-sound" checked={prefs.sound} onCheckedChange={sound=>update({sound})}/></label></div>
 </PopoverContent></Popover>;
}
