"use client";
import {useEffect,useRef,useState} from 'react';
import {Sparkles,Timer,Check,ArrowRight} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';
import {Button} from './ui/button';
import {MahjongTile} from './mahjong-tile';
import type {MahjongView} from '@/lib/mahjong/game';
import {chips} from '@/lib/mahjong/report';
import {typeName} from '@/lib/mahjong/solver';

export function MahjongAwards({g,seconds,busy,serverNow,onFlip,autoOpenFinished=true,onOpenChange}:{autoOpenFinished?:boolean;onOpenChange?:(open:boolean)=>void;g:MahjongView;seconds:number;busy:boolean;serverNow:number;onFlip:(index:number)=>void}){
 const [open,setOpen]=useState(false),[shown,setShown]=useState(0),[settledFace,setSettledFace]=useState(0);
 const opened=useRef(false),revealing=g.phase==='revealing',r=g.awardReveal;
 const awards=r?.awards??g.result?.awards??[],plan=r?.plan??g.result?.plan;
 const winner=g.seats[g.winner]?.name??'',canFlip=!!r?.canFlip;
 useEffect(()=>{if(!opened.current&&(revealing||(autoOpenFinished&&g.phase==='finished'&&awards.length===2&&g.result&&serverNow-g.result.ended<15000))){opened.current=true;setOpen(true);}},[revealing,g.phase,g.result?.id,awards.length,serverNow]);
 useEffect(()=>{onOpenChange?.(open);},[open,onOpenChange]);
 // A slow observer can receive both flips in one poll. Still show them in order.
 useEffect(()=>{if(shown>=awards.length)return;const timer=setTimeout(()=>setShown(n=>Math.min(n+1,awards.length)),shown?850:40);return()=>clearTimeout(timer);},[shown,awards.length]);
 useEffect(()=>{if(settledFace>=shown)return;const timer=setTimeout(()=>setSettledFace(shown),500);return()=>clearTimeout(timer);},[shown,settledFace]);
 if(!revealing&&!(g.phase==='finished'&&awards.length===2))return null;
 const hits=awards.filter(a=>a.hit).length,multiplier=plan?.multiplier??'1',base=g.session?.baseChips??'1',amount=(BigInt(base)*BigInt(1+hits)*BigInt(multiplier)).toString();
 return <><Button variant="outline" onClick={()=>setOpen(true)}><Sparkles size={16}/>{revealing?'翻开奖牌':'查看奖牌'}</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="mj-award-modal"><DialogHeader><div className="mj-award-eyebrow"><Sparkles size={16}/>这 一 手 的 好 运</div><DialogTitle>{settledFace===2?'奖牌已揭晓':'两张奖牌，逐张揭晓。'}</DialogTitle><DialogDescription>{revealing?(canFlip?'点击发亮的牌背，看看这一张能否命中。':`等待 ${winner} 点击翻牌，全桌同步揭晓。`):`${winner} 的胡牌方案已锁定，按所选牌张身份判定。`}</DialogDescription></DialogHeader>
 <div className="mj-award-pair">{[0,1].map(i=>{
  const face=awards[i],flipped=shown>i,judged=settledFace>i,enabled=canFlip&&awards.length===i&&shown===i&&settledFace===i&&!busy;
  return <div className={`mj-award-slot ${judged&&face?.hit?'is-hit':''}`} key={i}><span className="mj-award-number">第 {i+1} 张</span><button type="button" className={`mj-award-card ${flipped?'is-flipped':''} ${enabled?'is-next':''}`} disabled={!enabled} onClick={()=>onFlip(i)} aria-label={flipped?`第${i+1}张奖牌，${typeName(face.type)}，${judged?face.hit?'命中':'未命中':'正在揭晓'}`:`翻开第${i+1}张奖牌`}><span className="mj-award-turn"><span className="mj-award-back"><MahjongTile hidden/><b>{enabled?'点击翻开':i===0?'等待翻开':'下一张'}</b></span><span className="mj-award-front">{flipped&&face&&<MahjongTile tile={face.tile}/>}</span></span></button><div className="mj-award-verdict" aria-live="polite">{judged&&face?<><b>{face.hit?<><Check size={16}/>命中 +1</>:'未命中'}</b><span>{(face.tile/4|0)!==face.type?'白板代 '+typeName(face.type):typeName(face.type)}</span></>:<span>{flipped?'正在判断…':'好运还没揭晓'}</span>}</div></div>;
 })}</div>
 {settledFace===2?<div className="mj-award-total"><p>{chips(base)} ×（1 + {hits}）× {chips(multiplier)}</p><strong>每位付款者 {chips(amount)} 筹码</strong><span>{g.winType==='self'?'三家各付 · 杠分另算':'仅点炮或补杠者付款 · 杠分另算'}</span><Button onClick={()=>setOpen(false)}>查看结算与手牌<ArrowRight size={17}/></Button></div>:<div className="mj-award-wait"><Timer size={16}/>{revealing?`${Math.min(15,seconds)} 秒后自动翻开下一张`:'正在揭晓最后的结果'}<small>每张最多等待 15 秒；掉线仍会按时推进。</small></div>}
 </DialogContent></Dialog></>;
}
