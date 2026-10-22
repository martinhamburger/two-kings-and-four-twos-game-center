"use client";

import type {ReplayFrame} from '@/lib/replay/types';
import type {ChatBubble} from '@/lib/chat-bubbles';
import type {HoldemResult,HoldemSeatAction} from '@/lib/holdem/engine';
import {HoldemCard} from '@/components/holdem-card';
import {HoldemTable,type HoldemTableView} from '@/components/holdem-table';
import {chips} from '@/lib/mahjong/report';
import '@/app/replay-holdem.css';

function seatAction(value:ReplayFrame['scene']['seats'][number]['action'],at:number):HoldemSeatAction|undefined {
 if(!value||!['fold','check','call','raise','allin'].includes(value.kind)||!['preflop','flop','turn','river'].includes(value.street))return undefined;
 return {id:value.id,kind:value.kind as HoldemSeatAction['kind'],paid:value.paid,street:value.street as HoldemSeatAction['street'],at:value.at??at};
}

export function ReplayHoldemTable({frame,perspective,bubbles={}}:{frame:ReplayFrame;perspective:number;bubbles?:Record<string,ChatBubble>}){
 const scene=frame.scene;
 const capacity=Math.max(4,Math.min(10,scene.capacity??scene.seats.length));
 const result=scene.result as HoldemResult|null|undefined;
 const game:HoldemTableView={
  rules:{capacity,seconds:30,id:(scene.rulesId??'holdem-v5') as HoldemTableView['rules']['id']},
  phase:(['waiting','playing','runout','finished','closed'].includes(scene.phase)?scene.phase:'playing') as HoldemTableView['phase'],
  street:(['preflop','flop','turn','river'].includes(scene.street??'')?scene.street:'preflop') as HoldemTableView['street'],
  round:scene.round??'',roundNumber:scene.roundNumber??1,
  button:scene.button??-1,smallSeat:scene.smallSeat??-1,bigSeat:scene.bigSeat??-1,
  turn:scene.turn??-1,board:scene.board??[],pot:scene.pot??'0',result,
  seats:scene.seats.map((s,i)=>({
   id:s.id??`replay-seat-${i}`,name:s.name,bot:s.bot,hand:s.hand,
   stack:s.stack??s.chips??'0',bet:s.bet??'0',total:s.total??'0',
   folded:s.folded??false,allIn:s.allIn??false,ready:s.ready,action:seatAction(s.action,frame.at)
  }))
 };
 const own=game.seats[perspective];
 return <div className="th-room table-light replay-holdem" data-capacity={capacity} aria-label="德州对局回放">
  <HoldemTable game={game} perspective={perspective} bubbles={bubbles} readOnly/>
  {own&&<div className="th-controls"><div className="th-controls-header"><div className="th-own">
   <div className="th-own-cards" aria-label="投稿者底牌">{own.hand.map(c=><HoldemCard card={c} key={c} size="own"/>)}</div>
   <strong aria-label={`剩余筹码 ${chips(own.stack)}`}>{chips(own.stack)}<small> 筹码</small></strong>
  </div></div></div>}
  {result&&<section className="th-result-detail" aria-label="本手结算"><h3>第 {result.roundNumber} 手 · {result.type==='aborted'?'本手中止':result.type==='fold'?'弃牌结算':'摊牌结果'}</h3>
   {result.pots.map((p,i)=><p key={i}><b>{p.refund?'退回未被跟注部分':i===0?'主池':'边池 '+i} {chips(p.amount)}</b><span>{p.winners.map(w=>result.seats[w]?.name).filter(Boolean).join('、')}</span></p>)}
   {result.seats.map(s=><div className="th-report-player" key={s.id}><b>{s.name} <span className={BigInt(s.delta)>=0n?'positive':'negative'}>{chips(s.delta,true)}</span></b>{s.value&&<span>{s.value.name}</span>}</div>)}
  </section>}
 </div>;
}
