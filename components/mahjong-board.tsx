"use client";
import {memo,useCallback,useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ArrowDown,Maximize2} from 'lucide-react';
import type {ChatBubble} from '@/lib/chat-bubbles';
import {PlayerChat} from './player-chat';
import {PlayerAvatar} from './player-avatar';
import {MahjongSeatEffect} from './table-effects';
import type {MahjongView} from '@/lib/mahjong/game';
import {tileLabel,tileType} from '@/lib/mahjong/engine';
import {typeName} from '@/lib/mahjong/solver';
import {chips} from '@/lib/mahjong/report';
import {projectMahjongPoint,saveRiverAnchor,restoreRiverAnchor,type MahjongLayout,type MahjongSeat,type MahjongRackLayout,type MahjongRiverLayout,type RiverReadingAnchor} from '@/lib/mahjong/layout';
import {MahjongTile} from './mahjong-tile';
import {MahjongCountdown,type MahjongClockSource} from './mahjong-clock';
import {Button} from './ui/button';
import {EmptyBotSeat,RemoveBotSeat,type BotSeatControls} from './bot-seat';
import {Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';

type Seat=MahjongView['seats'][number];
const positions:MahjongSeat[]=['south','east','north','west'];
const tileStyle=(w:number,h:number,d:number):CSSProperties=>({'--tile-w':`${w}px`,'--tile-h':`${h}px`,'--tile-d':`${d}px`} as CSSProperties);
const placement=(p:{x:number;y:number;angle:number}):CSSProperties=>({left:p.x,top:p.y,transform:`rotateZ(${p.angle}deg)`,transformOrigin:'0 0'});

/** The unprojected overview deliberately keeps the shared UI tile presentation. */
export function MahjongMelds({s,own,finished,wildcard,highlightType=null}:{s:Seat;own:boolean;finished:boolean;wildcard:number;highlightType?:number|null}){
 return <div className="mj-melds" aria-label={`${s.name}的吃碰杠`}>{s.melds.map((m,j)=><div className="mj-meld" key={j}><div>{(m.concealed&&!own&&!finished?[0,1,2,3]:m.tiles).map((t,k)=><MahjongTile key={k} tile={t} highlightType={highlightType} small hidden={m.concealed&&!own&&!finished} wildcard={wildcard}/>)}</div><span>{m.concealed?'暗杠':m.kind==='chi'?'吃':m.kind==='pong'?'碰':'明杠'}</span></div>)}</div>;
}

function WorldMelds({s,own,g,position,width,slotWidth,gap,columns=4,rowPitch=0,highlightType}:{s:Seat;own:boolean;g:MahjongView;position:MahjongSeat;width:number;slotWidth:number;gap:number;columns?:number;rowPitch?:number;highlightType:number|null}){
 return <div className="mj-world-melds" style={{width}} aria-label={`${s.name}的吃碰杠`}>
  {s.melds.map((m,j)=>{const hidden=m.concealed&&!own&&g.phase!=='finished';return <div key={j} className="mj-world-meld" data-meld-index={j} style={{left:width-((j%columns)+1)*slotWidth,top:Math.floor(j/columns)*rowPitch,width:slotWidth-gap}}>
   <div className="mj-world-meld-tiles" style={{'--meld-gap':`${gap/4}px`} as CSSProperties}>{(hidden?[0,1,2,3]:m.tiles).map((t,k)=><MahjongTile key={k} tile={hidden?undefined:t} hidden={hidden} presentation="flat" seat={position} wildcard={g.wildcard} highlightType={highlightType}/>)}</div>
   <span className="mj-world-meld-label">{m.concealed?'暗杠':m.kind==='chi'?'吃':m.kind==='pong'?'碰':'明杠'}</span>
  </div>})}
 </div>;
}

const PlayerRack=memo(function PlayerRack({s,g,position,layout,highlightType}:{s:Seat;g:MahjongView;position:Exclude<MahjongSeat,'south'>;layout:MahjongRackLayout;highlightType:number|null}){
 const finished=g.phase==='finished',visible=['playing','choosing','revealing','finished'].includes(g.phase);
 const restingCount=Math.max(0,13-s.melds.length*3);
 return <div className={`mj-world-rack rack-${position}`} style={{...placement(layout),width:layout.length,...tileStyle(layout.tileW,layout.tileH,layout.tileD)}}>
  <div className="mj-world-hand" aria-label={`${s.name}的 ${s.count} 张${finished?'结算手牌':'暗手牌'}`}>
   {visible&&Array.from({length:finished?s.hand.length:s.count},(_,i)=><div className="mj-world-slot" key={finished?s.hand[i]:i} style={{left:i*(layout.tileW+layout.gap)+(i===restingCount?layout.drawGap:0)}}><MahjongTile tile={finished?s.hand[i]:undefined} hidden={!finished} presentation={finished?'flat':'standing'} seat={position} drawn={i===restingCount} wildcard={g.wildcard}/></div>)}
  </div>
  <div style={tileStyle(layout.meldW,layout.meldH,layout.meldD)} className="mj-world-melds"><WorldMelds s={s} own={false} g={g} position={position} width={layout.length} slotWidth={layout.meldSlotWidth} gap={layout.meldGap} highlightType={highlightType}/></div>
 </div>;
});

function River({s,g,position,layout,onReadingChange,highlightType}:{s:Seat;g:MahjongView;position:MahjongSeat;layout:MahjongRiverLayout;onReadingChange:(seat:MahjongSeat,latest:(()=>void)|null)=>void;highlightType:number|null}){
 const viewport=useRef<HTMLDivElement>(null),follow=useRef(true),intent=useRef(0);
 const [startRow,setStartRow]=useState(0);
 const anchor=useRef<RiverReadingAnchor|null>(null);
 useEffect(()=>()=>onReadingChange(position,null),[onReadingChange,position]);
 const contentHeight=Math.max(layout.height,Math.ceil(s.river.length/layout.columns)*layout.rowPitch-layout.gapY);
 const last=s.river.at(-1);
 // A complete-row window avoids browser-dependent clipping of preserve-3d descendants.
 // The native sibling still owns wheel, touch inertia, keyboard and the scroll thumb.
 function syncOffset(){const el=viewport.current;if(!el)return;setStartRow(Math.max(0,Math.min(Math.ceil(s.river.length/layout.columns)-layout.rows,Math.round(el.scrollTop/layout.rowPitch))));}
 useLayoutEffect(()=>{
  const el=viewport.current;if(!el)return;
  el.scrollTop=follow.current?el.scrollHeight:restoreRiverAnchor(anchor.current,s.river,layout.columns,layout.rowPitch);
  syncOffset();
 },[last,s.river.length,layout.columns,layout.rowPitch,layout.height,contentHeight]);
 function latest(){follow.current=true;onReadingChange(position,null);const el=viewport.current;if(el)el.scrollTop=el.scrollHeight;syncOffset();}
 return <>
  <div className={`mj-world-river river-${position}`} style={{...placement(layout),width:layout.width,height:layout.height,...tileStyle(layout.tileW,layout.tileH,layout.tileD)}} data-river-columns={layout.columns}>
   <div className="mj-river-visual" aria-hidden="true"><div className="mj-river-tiles" style={{width:layout.width,height:layout.height}}>{s.river.slice(startRow*layout.columns,(startRow+layout.rows)*layout.columns).map((t,i)=><span key={t} className={`mj-river-tile${g.lastDiscard?.seat===g.seats.findIndex(p=>p.id===s.id)&&g.lastDiscard.tile===t?' latest-tile':''}`} style={{left:(i%layout.columns)*(layout.tileW+layout.gapX),top:Math.floor(i/layout.columns)*layout.rowPitch}}><MahjongTile tile={t} presentation="flat" seat={position} wildcard={g.wildcard} highlightType={highlightType}/></span>)}</div></div>
   <div ref={viewport} className="mj-river-control" tabIndex={0} role="region" aria-label={`${s.name}的完整弃牌，按行滚动`} onPointerDown={()=>{intent.current=Date.now()+3000}} onPointerMove={e=>{if(e.buttons)intent.current=Date.now()+3000}} onTouchStart={()=>{intent.current=Date.now()+3000}} onTouchMove={()=>{intent.current=Date.now()+3000}} onWheel={()=>{intent.current=Date.now()+500}} onKeyDown={e=>{intent.current=Date.now()+500;if(e.key==='Home'||e.key==='End'){e.preventDefault();e.currentTarget.scrollTop=e.key==='Home'?0:e.currentTarget.scrollHeight;syncOffset();}}} onScroll={()=>{
    const el=viewport.current;if(!el)return;syncOffset();
    if(Date.now()<intent.current){follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<6;onReadingChange(position,follow.current?null:latest);anchor.current=saveRiverAnchor(s.river,el.scrollTop,layout.columns,layout.rowPitch);}
   }}><div className="mj-river-spacer" style={{height:contentHeight}}>{Array.from({length:Math.ceil(s.river.length/layout.columns)},(_,i)=><div key={i} style={{height:layout.rowPitch,scrollSnapAlign:'start'}}/>)}</div><ol className="sr-only">{s.river.map(t=><li key={t}>{tileLabel(t)}{tileType(t)===g.wildcard?'（赖子）':tileType(t)===33&&g.wildcard>=0?'，代 '+typeName(g.wildcard):''}</li>)}</ol></div>
  </div>

 </>;
}
export function MahjongPortrait({g,index,position,own=false,botControls,bubble,layout}:{g:MahjongView;index:number;position:MahjongSeat;own?:boolean;botControls?:BotSeatControls;bubble?:ChatBubble;layout:MahjongLayout['portraits'][MahjongSeat]}){
 const s=g.seats[index],active=g.phase==='playing'&&!g.pending&&g.turn===index;
 return <div className={`mj-portrait portrait-${position}${active?' is-active':''}`} style={{left:layout.x,top:layout.y,right:'auto',bottom:'auto',width:layout.width,'--seat-name-w':`${layout.nameWidth}px`} as CSSProperties} aria-label={`${s?.name??'空位'}的座位`}>{s?<><div className="mj-portrait-frame">{active&&<span className="mj-turn-badge" role="status">出牌中</span>}<PlayerChat bubble={bubble} align={position==='west'||own?'start':position==='east'?'end':'center'}><PlayerAvatar {...{name:s.name,userId:s.id,bot:s.bot}}/></PlayerChat>{g.dealer===index&&g.roundNumber>0&&<em className="mj-dealer">庄</em>}<div className="mj-portrait-caption"><span title={s.balance!==null?chips(s.balance):''}>{s.balance!==null?chips(s.balance):s.ready?'已准备':'待准备'}</span></div></div><b className="mj-seat-name" title={s.name}>{s.name}{own&&<small>你</small>}</b><small className="mj-portrait-status">{s.bot?'人机 · ':''}{s.departed?'已离桌':s.leaving?'结算后离桌':g.phase==='waiting'||g.phase==='finished'?s.ready?'已准备':'待准备':`${s.count} 张`}</small>{s.bot&&<RemoveBotSeat id={s.id} name={s.name} controls={botControls}/>}<MahjongSeatEffect seat={index}/></>:<EmptyBotSeat controls={botControls}/>}</div>;
}
export const MahjongSurface=memo(function MahjongSurface({g,seat,layout,clock,children,botControls,bubbles={},highlightType=null,riverTools}:{g:MahjongView;seat:number;layout:MahjongLayout;riverTools:HTMLDivElement|null;clock?:MahjongClockSource;children?:ReactNode;botControls?:BotSeatControls;bubbles?:Record<string,ChatBubble>;highlightType?:number|null}){
 const readers=useRef(new Map<MahjongSeat,()=>void>()),[readerCount,setReaderCount]=useState(0);
 const onReadingChange=useCallback((position:MahjongSeat,latest:(()=>void)|null)=>{if(latest)readers.current.set(position,latest);else readers.current.delete(position);setReaderCount(readers.current.size);},[]);
 const {camera,center,frame,southMeld}=layout;
 const turn=projectMahjongPoint({x:0,y:center.y+center.height+12},camera);
 return <div className={`mj-surface phase-${g.phase}`}>
  <div className="mj-camera" style={{perspective:camera.perspective,perspectiveOrigin:`${camera.cx}px ${camera.cy}px`}}>
   <div className="mj-world" style={{left:camera.cx,top:camera.cy,transform:`rotateX(${camera.tilt}deg)`,transformOrigin:'0 0'}}>
    <div className="mj-world-plane" style={{left:frame.x,top:frame.y,width:frame.width,height:frame.height}} aria-hidden="true"><div className="mj-table-frame"/><div className="mj-table-brand">娱乐中心<small>好 友 游 戏 室</small></div></div>
    <div className="mj-center" style={{left:center.x,top:center.y,width:center.width,height:center.height,'--console-w':`${center.width}px`,'--console-h':`${center.height}px`} as CSSProperties}><div className="mj-center-console">{positions.map((p,r)=><span key={p} className={`mj-wind wind-${p}${!g.pending&&g.phase==='playing'&&g.turn===(seat+r)%4?' is-active':''}`}>{['东','南','西','北'][((seat+r)%4-g.dealer+4)%4]}</span>)}<div className="mj-center-display">{g.phase==='playing'&&clock?<MahjongCountdown room={clock}/>:<strong className="mj-center-phase">{g.phase==='finished'?'结算':g.phase==='waiting'?'候场':g.phase==='closed'?'结束':g.phase==='choosing'?'选牌':'翻奖'}</strong>}<span className="mj-remaining"><i/>{g.remaining}<small>张</small></span></div></div></div>
    {positions.map((position,relative)=>{const s=g.seats[(seat+relative)%4];return s?<River key={g.round+':'+s.id} s={s} g={g} position={position} layout={layout.rivers[position]} onReadingChange={onReadingChange} highlightType={highlightType}/>:null})}
    {positions.map((position,relative)=>{const s=g.seats[(seat+relative)%4];return s&&position!=='south'?<PlayerRack key={position} s={s} g={g} position={position} layout={layout.racks[position]} highlightType={highlightType}/>:null})}
    {g.seats[seat]&&<div className="mj-world-rack rack-south" style={{...placement(southMeld),...tileStyle(southMeld.tileW,southMeld.tileH,southMeld.tileD)}}><WorldMelds s={g.seats[seat]} own g={g} position="south" width={southMeld.width} slotWidth={southMeld.slotWidth} gap={southMeld.gap} columns={southMeld.columns} rowPitch={southMeld.rowPitch} highlightType={highlightType}/></div>}
   </div>
  </div>
  {positions.map((position,relative)=>{const index=(seat+relative)%4,s=g.seats[index];return <MahjongPortrait key={position} g={g} index={index} position={position} own={relative===0} layout={layout.portraits[position]} botControls={botControls} bubble={s?bubbles[s.id]:undefined}/>})}
  {readerCount>0&&riverTools&&createPortal(<button className="mj-river-latest" onClick={()=>{for(const latest of [...readers.current.values()])latest();}} aria-label="全部弃牌回到最新" title="全部弃牌回到最新"><ArrowDown size={20}/></button>,riverTools)}
  <span className="mj-center-turn" style={{top:turn.y}}>{g.phase==='playing'?(g.pending?'等待响应':`${g.seats[g.turn]?.name??''}出牌`):''}</span>
  {children&&<div className="mj-stage-message">{children}</div>}
 </div>;
});
export function ExpandMahjong({g,seat,highlightType=null}:{g:MahjongView;seat:number;highlightType?:number|null}){return <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" className="mj-expand table-tool" aria-label="完整牌桌" title="完整牌桌"><Maximize2 size={22}/></Button></DialogTrigger><DialogContent className="mj-expanded-modal"><DialogHeader><DialogTitle>完整牌桌</DialogTitle><DialogDescription>四家的全部公开牌；每组均按该玩家的阅读方向展开。对局中仅显示你自己的暗手牌。</DialogDescription></DialogHeader><div className="mj-public-overview">{Array.from({length:4},(_,r)=>{const i=(seat+r)%4,s=g.seats[i];return s?<section key={s.id}><h3>{s.name}{i===seat?' · 你':''}{g.dealer===i?' · 庄':''}</h3>{(i===seat||g.phase==='finished')&&<div className="mj-overview-hand" aria-label={s.name+'的手牌'}>{s.hand.map(t=><MahjongTile key={t} tile={t} small wildcard={g.wildcard}/>)}</div>}<MahjongMelds s={s} own={i===seat} finished={g.phase==='finished'} wildcard={g.wildcard} highlightType={highlightType}/><div className="mj-overview-river" aria-label={s.name+'的全部弃牌'}>{s.river.length?s.river.map(t=><MahjongTile key={t} tile={t} small wildcard={g.wildcard} highlightType={highlightType}/>):<small>尚无弃牌</small>}</div></section>:null})}</div></DialogContent></Dialog>}
