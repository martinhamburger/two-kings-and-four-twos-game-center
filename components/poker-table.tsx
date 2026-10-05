"use client";
import {memo,useEffect,useRef,useState,type CSSProperties,type PointerEvent as ReactPointerEvent} from 'react';
import {royalCardArt,type CardAppearance} from '@/lib/game/card-art';
import {landlordHandLayout,playedCardsLayout,type LandlordLayoutMode} from '@/lib/game/table-layout';
import {Maximize2,Copy,ChevronLeft,ChevronRight} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';
import {Button} from './ui/button';
import {royalHandLayout} from '@/lib/game/royal-layout';
import {TurnClock} from './table-ui';
import {DeadlineClock} from './deadline-clock';
import type {RoomTiming} from '@/lib/sync/clock';
import {face,isVirtualCard,suit,physicalCard,type TableAction} from '@/lib/game/engine';
import {crossedCards,brushSelection,type HitRegion} from '@/lib/game/selection';
import {DDZ_EFFECTS} from '@/lib/motion/events';
import {EffectBadge} from './table-effects';

export function Card({card,selected=false,onClick,small=false,appearance='classic',className='',hideSuit=false,instanceLabel=''}:{card:number;selected?:boolean;onClick?:()=>void;small?:boolean;appearance?:CardAppearance;className?:string;hideSuit?:boolean;instanceLabel?:string}){
 hideSuit=hideSuit||appearance==='royal';
 const art=appearance==='royal'?royalCardArt(card):null,[failedSrc,setFailedSrc]=useState(''),showArt=!!art&&failedSrc!==art.src;
 const base=physicalCard(card),red=!hideSuit&&!isVirtualCard(card)&&(base===53||(base<52&&[1,3].includes(base%4)));
 const content=showArt?<img className="royal-card-image" src={art.src} alt="" width={384} height={576} draggable={false} onError={()=>setFailedSrc(art.src)}/>:<><b>{face(card)}</b>{!hideSuit&&<span>{suit(card)}</span>}<i>{hideSuit?face(card):suit(card)}</i>{hideSuit&&isVirtualCard(card)&&<em className="generated-card" title="技能生成牌"><Copy size={10}/></em>}</>;
 const style=`playing-card ${red?'red':''} ${!isVirtualCard(card)&&base>=52?'joker':''}${showArt?' royal-card':''}${hideSuit?' suitless-card':''}`;
 const label=(art?.label??`${hideSuit?'':suit(card)}${face(card)}${isVirtualCard(card)?'，技能生成牌':''}`)+instanceLabel;
 return onClick?<button type="button" data-card={card} onClick={onClick} aria-pressed={selected} aria-label={label} className={`${style} hand-card ${selected?'selected':''}`}>{content}</button>:<div aria-label={label} className={`${style} ${small?'mini-card':''} ${className}`}>{content}</div>;
}

export const SeatAction=memo(function SeatAction({action,active,seconds=0,timing,deadline=0,bidding,doubling=false,equipment=false,name,appearance='classic',showClock=true,hideSuit=false,compactHeight=112}:{action?:TableAction|null;active:boolean;seconds?:number;timing?:RoomTiming;deadline?:number;bidding:boolean;doubling?:boolean;equipment?:boolean;name:string;appearance?:CardAppearance;showClock?:boolean;hideSuit?:boolean;compactHeight?:number}){
 const effect=!active&&action?.kind==='play'?DDZ_EFFECTS[action.label]:undefined;
 return <div className={`seat-action ${active?'is-turn':''}${effect?' has-effect':''}`} aria-label={`${name}面前的出牌区`}>
  {effect&&action?.kind==='play'&&<EffectBadge key={action.eventId??effect} id={effect} eventId={action.eventId}/>}
  {active&&showClock?(timing?<DeadlineClock deadline={deadline} timing={timing} label={name+(bidding?'叫分':doubling?'加倍':equipment?'装备':'出牌')}/>:<TurnClock seconds={seconds} label={name+(bidding?'叫分':doubling?'加倍':equipment?'装备':'出牌')}/>):action?.kind==='play'&&!showClock?<CardGroupPreview cards={action.cards} name={`${name}的出牌`} appearance={appearance} hideSuit={hideSuit} maxHeight={compactHeight}/>:action?.kind==='play'?<><div className="seat-played-cards" style={{'--cards':action.cards.length} as CSSProperties}>{action.cards.map(c=><Card card={c} key={c} small appearance={appearance}/>)}</div></>:action?.kind==='pass'?<span className="seat-pass">不出</span>:action?.kind==='double'?<span className="seat-pass">{action.value?'加倍 ×2':'不加倍'}</span>:action?.kind==='bid'?<span className="seat-pass">{action.value?`${action.value} 分`:'不叫'}</span>:null}
 </div>;
});

export const HandStrip=memo(function HandStrip({hand,selected=[],onChange=()=>{},round='',appearance='classic',royal=false,readOnly=false,layoutMode,hideSuit=false}:{hand:number[];selected?:number[];onChange?:(cards:number[])=>void;round?:string;appearance?:CardAppearance;royal?:boolean;readOnly?:boolean;layoutMode?:LandlordLayoutMode;hideSuit?:boolean}){
 const root=useRef<HTMLDivElement>(null),selection=useRef(selected);selection.current=selected;
 const [width,setWidth]=useState(800);
 useEffect(()=>{if((!royal&&!layoutMode)||!root.current)return;const element=root.current,update=()=>setWidth(element.clientWidth);update();const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();},[royal,layoutMode]);
 const layout=layoutMode?landlordHandLayout(hand.length,width,layoutMode):royalHandLayout(hand.length,width);
 const gesture=useRef<{id:number;select:boolean;visited:Set<number>;x:number;y:number;rects:HitRegion[]}|null>(null);
 const suppressClick=useRef(false),signature=hand.join(',');
 const stop=()=>{const g=gesture.current;gesture.current=null;if(g&&root.current?.hasPointerCapture(g.id))root.current.releasePointerCapture(g.id);};
 useEffect(()=>{stop();},[signature,round]);
 useEffect(()=>{const blur=()=>stop();window.addEventListener('blur',blur);return()=>{window.removeEventListener('blur',blur);stop();};},[]);
 function paint(ids:number[]){const g=gesture.current;if(!g)return;const next=brushSelection(selection.current,ids,g.select,g.visited);if(next.length===selection.current.length&&next.every((card,index)=>card===selection.current[index]))return;selection.current=next;onChange(next);}
 function down(e:ReactPointerEvent<HTMLDivElement>){
  suppressClick.current=false;
  if(readOnly||e.button!==0||e.pointerType==='touch')return;
  const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button[data-card]');if(!button)return;
  e.preventDefault();button.focus({preventScroll:true});suppressClick.current=true;
  const id=Number(button.dataset.card),buttons=[...root.current!.querySelectorAll<HTMLButtonElement>('button[data-card]')];
  // Freeze the visible hit regions before selected cards rise; capture the pointer on the stable container.
  const rects=buttons.map((b,i)=>{const r=b.getBoundingClientRect(),next=buttons[i+1]?.getBoundingClientRect();return {id:Number(b.dataset.card),left:r.left,right:next&&Math.abs(next.top-r.top)<25?Math.min(r.right,next.left):r.right,top:r.top-22,bottom:r.bottom};});
  gesture.current={id:e.pointerId,select:!selection.current.includes(id),visited:new Set(),x:e.clientX,y:e.clientY,rects};root.current!.setPointerCapture(e.pointerId);paint([id]);
 }
 function move(e:ReactPointerEvent<HTMLDivElement>){const g=gesture.current;if(!g||g.id!==e.pointerId)return;
  if(!(e.buttons&1)){stop();return;}e.preventDefault();const ids=crossedCards(g.rects,g,{x:e.clientX,y:e.clientY});
  g.x=e.clientX;g.y=e.clientY;paint(ids);
 }
 const renderCard=(c:number)=><div className="hand-slot" key={c}><Card card={c} appearance={appearance} hideSuit={hideSuit} instanceLabel={layoutMode?`，第 ${hand.indexOf(c)+1} 张`:undefined} className={readOnly?'hand-card':''} selected={selected.includes(c)} onClick={readOnly?undefined:()=>onChange(selection.current.includes(c)?selection.current.filter(x=>x!==c):[...selection.current,c])}/></div>;
 return <div ref={root} className={`hand-strip${royal?' royal-hand':''}${layoutMode?' fixed-landlord-hand':''}`} role="group" aria-label={readOnly?'本局剩余手牌':'你的手牌，可拖动选择'} onPointerDown={down} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={()=>{gesture.current=null;}} onClickCapture={e=>{if(suppressClick.current&&e.detail>0){e.preventDefault();e.stopPropagation();}suppressClick.current=false;}} style={{'--cards':hand.length,...((royal||layoutMode)?{'--card-width':`${layout.cardWidth}px`,'--step':`${layout.step}px`,'--rank-size':`${layout.rankSize}px`}:{})} as CSSProperties}>
  {(royal||layoutMode)?Array.from({length:Math.ceil(hand.length/layout.perRow)},(_,row)=><div className="royal-hand-row" key={row}>{hand.slice(row*layout.perRow,(row+1)*layout.perRow).map(renderCard)}</div>):hand.map(renderCard)}
 </div>;
});

/** Public cards only. Compact rows expose every instance; the expanded grid is paged. */
export function CardGroupPreview({cards,name,appearance='classic',hideSuit=false,maxHeight=112,triggerOnly=false}:{cards:number[];name:string;appearance?:CardAppearance;hideSuit?:boolean;maxHeight?:number;triggerOnly?:boolean}){
 const [open,setOpen]=useState(false),[page,setPage]=useState(0),[width,setWidth]=useState(240),root=useRef<HTMLButtonElement>(null),signature=cards.join(',');
 useEffect(()=>{if(!root.current)return;const el=root.current,update=()=>setWidth(el.clientWidth);update();const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect()},[]);
 useEffect(()=>{setOpen(false);setPage(0)},[signature]);
 const layout=playedCardsLayout(cards.length,width,maxHeight),pages=Math.max(1,Math.ceil(cards.length/24));
 return <><button type="button" ref={root} className={`card-group-preview${triggerOnly?' is-summary':''}`} aria-label={`展开${name}，${cards.length} 张`} onClick={()=>setOpen(true)}>{triggerOnly?<><Maximize2 size={14}/>{name} · {cards.length}</>:<div className="fixed-played-cards" style={{'--card-width':`${layout.cardWidth}px`,'--step':`${layout.step}px`} as CSSProperties}>{Array.from({length:layout.rows},(_,row)=><div className="fixed-played-row" key={row}>{cards.slice(row*layout.perRow,(row+1)*layout.perRow).map((card,i)=><div className="hand-slot" key={card}><Card card={card} small appearance={appearance} hideSuit={hideSuit} instanceLabel={`，第 ${row*layout.perRow+i+1} 张`}/></div>)}</div>)}</div>}</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="landlord-cards-modal lg:translate-y-0"><DialogHeader><DialogTitle>{name}</DialogTitle><DialogDescription>{cards.length} 张公开牌{pages>1?` · 第 ${page+1} / ${pages} 页`:''}</DialogDescription></DialogHeader><div className="expanded-card-grid">{cards.slice(page*24,(page+1)*24).map((card,i)=><Card card={card} key={card} appearance={appearance} hideSuit={hideSuit} instanceLabel={`，第 ${page*24+i+1} 张`}/>)}</div><div className="expanded-card-controls">{pages>1&&<><Button variant="outline" disabled={!page} onClick={()=>setPage(page-1)} aria-label="上一页牌"><ChevronLeft/></Button><Button variant="outline" disabled={page>=pages-1} onClick={()=>setPage(page+1)} aria-label="下一页牌"><ChevronRight/></Button></>}<Button onClick={()=>setOpen(false)}>收起</Button></div></DialogContent></Dialog></>;
}
