"use client";
import {useState} from 'react';
import {AnimationCacheControl,AnimationPreload} from './animation-cache';
import {MotionImage} from './motion-image';
import {warmMotionSheet} from '@/lib/motion/decoded-sheets';
import Link from './site-navigation';
import {RotateCcw,ArrowLeft,BookOpen,Layers,Smile,Sparkles} from 'lucide-react';
import {Card} from './poker-table';
import {royalCardArt} from '@/lib/game/card-art';
import {EMOTES,canSendEmote} from '@/lib/emotes';
import {TABLE_EFFECTS} from '@/lib/motion/effects';
import {EmoteImage} from './emote';
import {MotionPlayback} from './motion-playback';
const emotes=EMOTES.filter(e=>canSendEmote(e.id));
export function EmotePreview(){
 const [kind,setKind]=useState<'cards'|'emotes'|'effects'>('cards'),[selected,setSelected]=useState(emotes[0].id),[effect,setEffect]=useState(TABLE_EFFECTS[0].id),[replay,setReplay]=useState(0);
 const [rarity,setRarity]=useState<number|null>(null),[card,setCard]=useState(0);
 const cards=Array.from({length:54},(_,id)=>({id,art:royalCardArt(id)!})).filter(item=>rarity===null||item.art.rarity===rarity);
 const art=TABLE_EFFECTS.find(e=>e.id===effect)!;
 return <main className="emote-preview"><AnimationPreload/>
  <Link className="gallery-back" href="/"><ArrowLeft size={16}/>返回娱乐中心</Link>
  <header className="gallery-heading"><span className="section-tag"><BookOpen size={20}/>娱乐中心 · 图鉴</span><h1>卡牌、表情与特效</h1>
  <p>皇室卡牌、21 个经典表情与 15 种牌型特效。点一下看完整动作；这里的重播只给自己看，不会发到房间。</p></header>
  <AnimationCacheControl/><div className="gallery-tabs" role="group" aria-label="预览分类">
   <button data-category="cards" aria-pressed={kind==='cards'} onClick={()=>setKind('cards')}><Layers size={18}/>卡牌 · 54</button>
   <button data-category="emotes" aria-pressed={kind==='emotes'} onClick={()=>setKind('emotes')}><Smile size={18}/>经典表情 · {emotes.length}</button>
   <button data-category="effects" aria-pressed={kind==='effects'} onClick={()=>setKind('effects')}><Sparkles size={18}/>牌型特效 · {TABLE_EFFECTS.length}</button>
  </div>
  {kind==='cards'?<><div className="gallery-rarities" role="group" aria-label="按边框花色筛选">{[{id:null,name:'全部花色'},{id:0,name:'♣ 梅花 · 蓝'},{id:1,name:'♦ 方块 · 橙'},{id:2,name:'♥ 红桃 · 紫'},{id:3,name:'♠ 黑桃 · 五彩'}].map(item=><button key={item.name} data-rarity={item.id??'all'} aria-pressed={rarity===item.id} onClick={()=>setRarity(item.id)}>{item.name}</button>)}</div><section className="gallery-card-stage" aria-label="卡牌详情"><Card card={card} appearance="royal"/><div><strong>{royalCardArt(card)?.label}</strong><p>普通模式专用卡面 · 四种边框对应四种花色。大小王使用五彩六边形边框。</p></div></section><div className="gallery-card-grid">{cards.map(item=><button key={item.id} aria-label={item.art.label} aria-pressed={card===item.id} onClick={()=>setCard(item.id)}><Card card={item.id} appearance="royal"/><b>{item.art.label}</b></button>)}</div></>:<><section className="gallery-stage" aria-label="动作预览">
   <div className="gallery-player" key={`${kind}:${selected}:${effect}:${replay}`}>
    {kind==='emotes'?<EmoteImage id={selected} animate eager/>:art.motion?<MotionPlayback motion={art.motion} animate/>:<MotionImage className="gallery-symbol effect-enter" src={art.src} alt={art.label} draggable={false}/>}
   </div>
   <div><strong>{kind==='emotes'?emotes.find(e=>e.id===selected)?.name:art.label}</strong><button className="gallery-replay" onClick={()=>setReplay(n=>n+1)}><RotateCcw size={15}/>再看一次</button></div>
   <small>播放一次后停留 · 本版表情无声</small>
  </section>
  <div className="emote-preview-grid">{kind==='emotes'?emotes.map(e=><button aria-pressed={selected===e.id} key={e.id} onPointerEnter={()=>e.frames?.sheets.forEach(s=>warmMotionSheet(s.src))} onFocus={()=>e.frames?.sheets.forEach(s=>warmMotionSheet(s.src))} onClick={()=>{setSelected(e.id);setReplay(n=>n+1)}}><EmoteImage id={e.id}/><b>{e.name}</b></button>):TABLE_EFFECTS.map(e=><button aria-pressed={effect===e.id} key={e.id} onPointerEnter={()=>e.motion?.sheets.forEach(s=>warmMotionSheet(s.src))} onFocus={()=>e.motion?.sheets.forEach(s=>warmMotionSheet(s.src))} onClick={()=>{setEffect(e.id);setReplay(n=>n+1)}}><MotionImage src={e.src} alt="" loading="lazy" draggable={false}/><b>{e.label}</b></button>)}</div>
  </>}<p className="gallery-note">经典角色的非官方重绘，动作参考不代表官方授权。<a href="/emotes/royale-v2/SOURCES.json" target="_blank" rel="noreferrer">查看素材来源</a>。哥布林嘘、暗夜女巫鼓掌、野猪骑士飞吻待补。</p>
 </main>;
}
