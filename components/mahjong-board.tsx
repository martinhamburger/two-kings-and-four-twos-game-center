"use client";
import {TurnClock} from './table-ui';
import {Layers3,Maximize2} from 'lucide-react';
import type {ReactNode} from 'react';
import type {ChatBubble} from '@/lib/chat-bubbles';
import {MahjongSeatHand} from './round-hands';
import {PlayerChat} from './player-chat';
import {MahjongSeatEffect} from './table-effects';
import type {MahjongView} from '@/lib/mahjong/game';
import {isHamRules} from '@/lib/mahjong/rules';
import {chips} from '@/lib/mahjong/report';
import {typeName} from '@/lib/mahjong/solver';
import {MahjongTile} from './mahjong-tile';
import {Button} from './ui/button';
import {EmptyBotSeat,RemoveBotSeat,type BotSeatControls} from './bot-seat';
import {Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';

function PlayerZone({g,index,position,seconds,own=false,botControls,bubbles}:{g:MahjongView;index:number;position:string;seconds:number;own?:boolean;botControls?:BotSeatControls;bubbles:Record<string,ChatBubble>}){
 const s=g.seats[index],active=g.phase==='playing'&&!g.pending&&g.turn===index,pending=g.phase==='playing'&&g.pending?.from===index;
 return <section className={`mj-player-zone zone-${position} ${active?'is-active':''}`} aria-label={`${s?.name||'空位'}面前的牌`}>
 {s&&<MahjongSeatEffect seat={index}/>}
 {!own&&<div className="mj-player-heading">{s?<><PlayerChat bubble={bubbles[s.id]} align={position==='west'?'start':position==='east'?'end':'center'}><span className={`avatar avatar-${index%3}`}>{s.name.slice(0,1)}</span></PlayerChat><div><b>{s.name}{s.bot&&<em className="bot-label">机器人</em>}{g.dealer===index&&g.roundNumber>0&&<em className="dealer-tag">庄</em>}</b>{s.balance!==null&&<span>{chips(s.balance)}</span>}{g.phase!=='waiting'&&<span>{s.departed?'已离桌':s.leaving?'本局结束后离桌':`${s.count} 张`}</span>}{g.phase==='waiting'&&<span>{s.ready?'已准备':''}</span>}{s.bot&&<RemoveBotSeat id={s.id} name={s.name} controls={botControls}/>}</div></>:<EmptyBotSeat controls={botControls}/>}</div>}
 {!own&&s&&['playing','choosing','revealing'].includes(g.phase)&&<div className="mj-concealed-rack" role="img" aria-label={`${s.name}的 ${s.count} 张暗手牌`}><div aria-hidden="true">{Array.from({length:s.count},(_,i)=><MahjongTile key={i} hidden small/>)}</div></div>}
 {g.phase==='finished'&&!own&&s&&<MahjongSeatHand hand={s.hand} name={s.name} wildcard={g.wildcard}/>}
 {!own&&<div className="mj-seat-status">{active&&<TurnClock seconds={seconds} label={s.name+'出牌'}/>}</div>}
 <div className="mj-public-cards" tabIndex={s&&(s.river.length||s.melds.length)?0:undefined} aria-label={`${s?.name||'空位'}的公开牌`}>
 {pending&&<div className="mj-claim-indicator">{g.pending!.kind==='added'&&<MahjongTile tile={g.pending!.tile} small wildcard={g.wildcard}/>}</div>}
 {!!s?.river.length&&<div className="mj-discards" aria-label={`${s.name}的完整弃牌`}>{s.river.map(t=><span key={t} className={g.lastDiscard?.tile===t?'latest-tile':''}><MahjongTile tile={t} small wildcard={g.wildcard}/></span>)}</div>}
 {!!s?.melds.length&&<div className="mj-melds" aria-label={`${s.name}的吃碰杠`}>{s.melds.map((m,j)=><div className="mj-meld" key={j}><span>{m.concealed?'暗杠':m.kind==='chi'?'吃':m.kind==='pong'?'碰':'杠'}</span><div>{(m.concealed&&!own&&g.phase!=='finished'?[0,1,2,3]:m.tiles).map((t,k)=><MahjongTile key={k} tile={t} small hidden={m.concealed&&!own&&g.phase!=='finished'} wildcard={g.wildcard}/>)}</div></div>)}</div>}
 </div>
 </section>;
}
export function MahjongSurface({g,seat,seconds,children,botControls,bubbles={}}:{g:MahjongView;seat:number;seconds:number;children?:ReactNode;botControls?:BotSeatControls;bubbles?:Record<string,ChatBubble>}){
 return <><div className="mj-board-top">
 {isHamRules(g.rules.id)&&g.wildcard>=0?<div className="mj-wild-seat"><MahjongTile tile={g.wildcard*4} wildcard={g.wildcard} small/><div><b>本局赖子</b><span>白板代 {typeName(g.wildcard)}</span></div></div>:<span className="mj-board-label">{g.rules.name}</span>}
 <span className="mj-round-tag"><Layers3 size={16}/>{g.roundNumber?`第 ${g.roundNumber} 局`:'等待开局'}</span></div>
 {g.phase==='finished'&&children&&<div className="mj-finish-banner">{children}</div>}
 <div className={`mj-surface phase-${g.phase}`}>
 <PlayerZone bubbles={bubbles} g={g} index={(seat+2)%4} position="north" seconds={seconds} botControls={botControls}/>
 <PlayerZone bubbles={bubbles} g={g} index={(seat+3)%4} position="west" seconds={seconds} botControls={botControls}/>
 <div className="mj-center">{g.phase==='finished'?<span className="mj-finish-seal">本局<br/>结束</span>:g.phase==='playing'?<div className="mj-center-console"><div className="mj-wall-count"><span>牌墙余量</span><strong>{g.remaining}</strong><small>张</small></div><span className="mj-center-turn">{g.pending?'等待响应':`${g.seats[g.turn]?.name??''}出牌`}</span><span className="mj-scene-signature" aria-hidden="true">娱乐中心 · 好友游戏室</span></div>:children}</div>
 <PlayerZone bubbles={bubbles} g={g} index={(seat+1)%4} position="east" seconds={seconds} botControls={botControls}/>
 <PlayerZone bubbles={bubbles} g={g} index={seat} position="south" seconds={seconds} own/>
 </div></>;
}
export function ExpandMahjong({g,seat,seconds,bubbles={}}:{g:MahjongView;seat:number;seconds:number;bubbles?:Record<string,ChatBubble>}){return <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" className="mj-expand table-tool" aria-label="完整牌桌" title="完整牌桌"><Maximize2 size={18}/></Button></DialogTrigger><DialogContent className="mj-expanded-modal"><DialogHeader><DialogTitle>完整牌桌</DialogTitle><DialogDescription>查看四家的完整弃牌与吃碰杠；窄屏可以左右滑动。自己的手牌在下方。</DialogDescription></DialogHeader><div className="mj-expanded-scroll"><div className="mj-board mj-expanded-board mj-table-scene"><MahjongSurface bubbles={bubbles} g={g} seat={seat} seconds={seconds}/><div className="mj-self"><div className="mj-self-top"><div><PlayerChat bubble={bubbles[g.seats[seat].id]} align="start"><span className="avatar">{g.seats[seat].name.slice(0,1)}</span></PlayerChat><strong>{g.seats[seat].name}</strong><span>你</span></div></div><div className="mj-hand" aria-label="你的手牌">{g.seats[seat].hand.map(t=><MahjongTile key={t} tile={t} wildcard={g.wildcard}/>)}</div></div></div></div></DialogContent></Dialog>;}
