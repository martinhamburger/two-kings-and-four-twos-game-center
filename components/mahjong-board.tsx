"use client";
import {memo,useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowDown,Maximize2} from 'lucide-react';
import type {ChatBubble} from '@/lib/chat-bubbles';
import {PlayerChat} from './player-chat';
import {PlayerAvatar} from './player-avatar';
import {MahjongSeatEffect} from './table-effects';
import type {MahjongView} from '@/lib/mahjong/game';
import {chips} from '@/lib/mahjong/report';
import {MahjongTile} from './mahjong-tile';
import {MahjongCountdown,type MahjongClockSource} from './mahjong-clock';
import {Button} from './ui/button';
import {EmptyBotSeat,RemoveBotSeat,type BotSeatControls} from './bot-seat';
import {Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';

type Seat=MahjongView['seats'][number];
export function MahjongMelds({s,own,finished,wildcard}:{s:Seat;own:boolean;finished:boolean;wildcard:number}){
 return <div className="mj-melds" aria-label={`${s.name}的吃碰杠`}>{s.melds.map((m,j)=><div className="mj-meld" key={j}><div>{(m.concealed&&!own&&!finished?[0,1,2,3]:m.tiles).map((t,k)=><MahjongTile key={k} tile={t} small hidden={m.concealed&&!own&&!finished} wildcard={wildcard}/>)}</div><span>{m.concealed?'暗杠':m.kind==='chi'?'吃':m.kind==='pong'?'碰':'明杠'}</span></div>)}</div>;
}
function River({s,g,expanded=false}:{s:Seat;g:MahjongView;expanded?:boolean}){
 const viewport=useRef<HTMLDivElement>(null),follow=useRef(true),intent=useRef(0),[away,setAway]=useState(false);
 useEffect(()=>{const el=viewport.current;if(!el)return;const observer=new ResizeObserver(()=>{if(follow.current)el.scrollTop=el.scrollHeight});observer.observe(el);return()=>observer.disconnect()},[]);
 const last=s.river.at(-1);
 useEffect(()=>{const el=viewport.current;if(el&&follow.current)el.scrollTop=el.scrollHeight;},[last]);
 function latest(){follow.current=true;setAway(false);const el=viewport.current;if(el)el.scrollTop=el.scrollHeight;}
 return <div className={`mj-river-shell${expanded?' is-expanded':''}`}><div ref={viewport} className="mj-river-scroll" tabIndex={0} role="region" aria-label={`${s.name}的完整弃牌，可滚动`} onPointerDown={()=>{intent.current=Date.now()+3000}} onPointerMove={e=>{if(e.buttons)intent.current=Date.now()+3000}} onTouchStart={()=>{intent.current=Date.now()+3000}} onTouchMove={()=>{intent.current=Date.now()+3000}} onWheel={()=>{intent.current=Date.now()+500}} onKeyDown={e=>{intent.current=Date.now()+500;if(e.key==='Home'||e.key==='End'){e.preventDefault();e.currentTarget.scrollTop=e.key==='Home'?0:e.currentTarget.scrollHeight;}}} onScroll={()=>{const el=viewport.current;if(el&&Date.now()<intent.current){follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<6;setAway(!follow.current)}}}>
 <div className="mj-discards">{s.river.map(t=><span key={t} className={g.lastDiscard?.seat===g.seats.findIndex(player=>player.id===s.id)&&g.lastDiscard.tile===t?'latest-tile':''}><MahjongTile tile={t} small wildcard={g.wildcard}/></span>)}</div>
 </div>{away&&!expanded&&<button className="mj-river-latest" onClick={latest} aria-label={`${s.name}的弃牌回到最新`}><ArrowDown size={12}/><span>最新</span></button>}</div>;
}
export function MahjongPortrait({g,index,position,own=false,botControls,bubble}:{g:MahjongView;index:number;position:string;own?:boolean;botControls?:BotSeatControls;bubble?:ChatBubble}){
 const s=g.seats[index],active=g.phase==='playing'&&!g.pending&&g.turn===index;
 return <div className={`mj-portrait portrait-${position}${active?' is-active':''}`} aria-label={`${s?.name??'空位'}的座位`}>{s?<><div className="mj-portrait-frame"><PlayerChat bubble={bubble} align={position==='west'||own?'start':position==='east'?'end':'center'}><PlayerAvatar name={s.name} bot={s.bot}/></PlayerChat>{g.dealer===index&&g.roundNumber>0&&<em className="mj-dealer">庄</em>}<div className="mj-portrait-caption"><span title={s.balance!==null?chips(s.balance):''}>{s.balance!==null?chips(s.balance):s.ready?'已准备':'待准备'}</span></div></div><b className="mj-seat-name" title={s.name}>{s.name}{own&&<small>你</small>}</b><small className="mj-portrait-status">{s.bot?'人机 · ':''}{s.departed?'已离桌':s.leaving?'结算后离桌':g.phase==='waiting'||g.phase==='finished'?s.ready?'已准备':'待准备':`${s.count} 张`}</small>{s.bot&&<RemoveBotSeat id={s.id} name={s.name} controls={botControls}/>}<MahjongSeatEffect seat={index}/></>:<EmptyBotSeat controls={botControls}/>}</div>;
}
const PlayerRack=memo(function PlayerRack({s,g,position}:{s:Seat;g:MahjongView;position:string}){
 const finished=g.phase==='finished',visible=['playing','choosing','revealing','finished'].includes(g.phase);
 return <div className={`mj-outer-rack rack-${position}`}><div className="mj-rack-local"><div className="mj-concealed-rack" aria-label={`${s.name}的 ${s.count} 张${finished?'结算手牌':'暗手牌'}`}>{visible&&(finished?s.hand.map(t=><MahjongTile key={t} tile={t} small wildcard={g.wildcard}/>):Array.from({length:s.count},(_,i)=><MahjongTile key={i} hidden small/>))}</div><MahjongMelds s={s} own={false} finished={finished} wildcard={g.wildcard}/></div></div>;
});
export const MahjongSurface=memo(function MahjongSurface({g,seat,clock,children,botControls,bubbles={},expanded=false}:{g:MahjongView;seat:number;clock?:MahjongClockSource;children?:ReactNode;botControls?:BotSeatControls;bubbles?:Record<string,ChatBubble>;expanded?:boolean}){
 const positions=['south','east','north','west'];
 return <div className={`mj-surface phase-${g.phase}`}>
 {positions.map((position,relative)=>{const index=(seat+relative)%4,s=g.seats[index];return <div className={`mj-seat-layer zone-${position}`} key={position}><MahjongPortrait g={g} index={index} position={position} own={relative===0} botControls={botControls} bubble={s?bubbles[s.id]:undefined}/>{s&&relative!==0&&<PlayerRack s={s} g={g} position={position}/>}<div className={`mj-river-position river-${position}`}>{s&&<River key={g.round+':'+s.id} s={s} g={g} expanded={expanded}/>}</div></div>})}
 <div className="mj-center"><div className="mj-center-console">{positions.map((p,r)=><span key={p} className={`mj-wind wind-${p}${!g.pending&&g.phase==='playing'&&g.turn===(seat+r)%4?' is-active':''}`}>{['东','南','西','北'][((seat+r)%4-g.dealer+4)%4]}</span>)}<div className="mj-center-display">{g.phase==='playing'&&clock?<MahjongCountdown room={clock}/>:<strong className="mj-center-phase">{g.phase==='finished'?'结算':g.phase==='waiting'?'候场':g.phase==='closed'?'结束':g.phase==='choosing'?'选牌':'翻奖'}</strong>}<span className="mj-remaining"><i/>{g.remaining}<small>张</small></span></div></div><span className="mj-center-turn">{g.phase==='playing'?(g.pending?'等待响应':`${g.seats[g.turn]?.name??''}出牌`):''}</span></div>
 {children&&<div className="mj-stage-message">{children}</div>}
 </div>;
});
export function ExpandMahjong({g,seat}:{g:MahjongView;seat:number}){return <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" className="mj-expand table-tool" aria-label="完整牌桌" title="完整牌桌"><Maximize2 size={22}/></Button></DialogTrigger><DialogContent className="mj-expanded-modal"><DialogHeader><DialogTitle>完整牌桌</DialogTitle><DialogDescription>四家的全部公开牌；每组均按该玩家的阅读方向展开。对局中仅显示你自己的暗手牌。</DialogDescription></DialogHeader><div className="mj-public-overview">{Array.from({length:4},(_,r)=>{const i=(seat+r)%4,s=g.seats[i];return s?<section key={s.id}><h3>{s.name}{i===seat?' · 你':''}{g.dealer===i?' · 庄':''}</h3>{(i===seat||g.phase==='finished')&&<div className="mj-overview-hand" aria-label={s.name+'的手牌'}>{s.hand.map(t=><MahjongTile key={t} tile={t} small wildcard={g.wildcard}/>)}</div>}<MahjongMelds s={s} own={i===seat} finished={g.phase==='finished'} wildcard={g.wildcard}/><div className="mj-overview-river" aria-label={s.name+'的全部弃牌'}>{s.river.length?s.river.map(t=><MahjongTile key={t} tile={t} small wildcard={g.wildcard}/>):<small>尚无弃牌</small>}</div></section>:null})}</div></DialogContent></Dialog>}
