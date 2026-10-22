"use client";

import {type CSSProperties,type RefObject} from 'react';
import {Bot,Coins,Users} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {HoldemCard} from '@/components/holdem-card';
import {HoldemSeatWager} from '@/components/holdem-seat-wager';
import {PlayerAvatar} from '@/components/player-avatar';
import {PlayerChat} from '@/components/player-chat';
import type {ChatBubble} from '@/lib/chat-bubbles';
import type {HoldemResult,HoldemSeatAction,HoldemView} from '@/lib/holdem/engine';
import {holdemSeatPosition} from '@/lib/holdem/layout';
import {chips} from '@/lib/mahjong/report';

export type HoldemTableSeat = {
 id:string;name:string;bot?:boolean;hand:number[];stack:string;bet:string;total:string;
 folded:boolean;allIn:boolean;ready?:boolean;action?:HoldemSeatAction;
};
export type HoldemTableView = {
 rules:{capacity:number;seconds:number;id:HoldemView['rules']['id']};
 phase:HoldemView['phase'];street:HoldemView['street'];round:string;roundNumber:number;
 button:number;smallSeat:number;bigSeat:number;turn:number;board:number[];pot:string;
 seats:HoldemTableSeat[];result?:HoldemResult|null;
};

const streetName={preflop:'翻牌前',flop:'翻牌',turn:'转牌',river:'河牌'};

/** The live room and its replay use the same table, seat geometry and card artwork. */
export function HoldemTable({game:g,perspective,bubbles={},userId='',remaining=0,busy=false,readOnly=false,onRemoveBot,onAddBot,scrollRef}:{
 game:HoldemTableView;perspective:number;bubbles?:Record<string,ChatBubble>;userId?:string;remaining?:number;
 busy?:boolean;readOnly?:boolean;onRemoveBot?:(id:string)=>void;onAddBot?:()=>void;scrollRef?:RefObject<HTMLDivElement|null>;
}){
 const seat=Math.max(0,Math.min(perspective,g.rules.capacity-1));
 return <div ref={scrollRef} className="th-table-scroll"><section className={`th-table${g.rules.capacity>6?' is-large':''}${g.result&&g.rules.id==='holdem-v5'?' is-settled':''}`} aria-label={`${g.rules.capacity} 人德州牌桌`}>
  <div className="th-felt"/>
  <div className="th-table-number">第 {g.roundNumber||'—'} 手 · {g.seats.length}/{g.rules.capacity} 人</div>
  <div className="th-center"><span className="th-street">{g.phase==='waiting'?'等朋友入座':g.phase==='finished'?'本手已结算':g.phase==='closed'?'整桌已结束':streetName[g.street]}</span>
   <div className="th-pot"><Coins size={20}/><span>{['finished','closed'].includes(g.phase)?'本手总投入':'底池'} <b>{chips(g.pot)}</b></span></div>
   <div className="th-community" aria-label="公共牌">{Array.from({length:5},(_,i)=>g.board[i]!==undefined?<HoldemCard key={i} card={g.board[i]}/>:<span key={i} className="th-card-placeholder">—</span>)}</div>
   {g.phase==='waiting'&&<p>准备后开局</p>}
  </div>
  {Array.from({length:g.rules.capacity},(_,relative)=>{
   const index=(seat+relative)%g.rules.capacity,s=g.seats[index],position=holdemSeatPosition(g.rules.capacity,relative);
   const style={'--x':`${position.x}%`,'--y':`${position.y}%`} as CSSProperties;
   return <section key={s?.id??index} style={style} className={`th-seat ${g.turn===index&&g.phase==='playing'?'is-turn':''} ${s?.folded?'is-folded':''} ${index===seat?'is-me':''} ${position.y<35?'is-upper':''} ${position.x>50?'is-right':''}`} aria-label={(s?.name||'空位')+'的座位'}>
    {s?<>
     <PlayerChat bubble={bubbles[s.id]} align="center"><PlayerAvatar name={s.name} userId={s.id} bot={s.bot}/></PlayerChat>
     <b className="th-player-name" title={s.name}>{index===seat&&!readOnly?'你':s.name}{s.bot&&<small>人机</small>}</b>
     <div className="th-position">{g.button===index&&<em>D</em>}{g.smallSeat===index&&<span>小盲</span>}{g.bigSeat===index&&<span>大盲</span>}{s.folded&&g.result?.rules.id==='holdem-v5'&&<span>弃牌</span>}</div>
     {index!==seat&&<><strong className="th-stack" aria-label={`剩余 ${chips(s.stack)} 筹码`}>{chips(s.stack)}</strong><div className="th-hole" aria-label={s.name+'的底牌'}>{s.hand.length?s.hand.map(c=><HoldemCard key={c} card={c} size="seat"/>):[0,1].map(i=><span className="th-card-back" key={i}/>)}</div></>}
     {['playing','runout'].includes(g.phase)?<HoldemSeatWager seat={s} street={g.street} round={g.round} active={!readOnly&&g.phase==='playing'&&g.turn===index&&index!==seat} seconds={Math.min(g.rules.seconds,remaining)} userId={userId}/>:g.result&&['finished','closed'].includes(g.phase)?<span className="th-seat-result" aria-label={`${s.name}的结算牌型`}>{g.result.type==='aborted'?'本手中止':g.result.seats.find(p=>p.id===s.id)?.value?.name??(s.folded?'已弃牌':g.result.type==='fold'?(g.result.rules.id==='holdem-v5'?'其余玩家弃牌获胜':'未摊牌获胜'):'未摊牌')}</span>:s.ready&&<span className="th-seat-action">已准备</span>}
     {!readOnly&&s.bot&&onRemoveBot&&<button className="th-remove" disabled={busy} onClick={()=>onRemoveBot(s.id)}>移除人机</button>}
    </>:<div className="th-empty"><Users size={26}/><span>等一位朋友</span>{!readOnly&&onAddBot&&<Button size="sm" variant="outline" disabled={busy} onClick={onAddBot}><Bot size={14}/>添加人机</Button>}</div>}
   </section>;
  })}
 </section></div>;
}
