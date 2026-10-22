"use client";

import {Crown,DoorOpen} from 'lucide-react';
import {Card} from './poker-table';
import {RoundSummary} from './table-ui';
import {SpringEffect} from './table-effects';
import {DeadlineClock} from './deadline-clock';
import type {RoomTiming} from '@/lib/sync/clock';
import {Button} from './ui/button';

type TableSeat={name:string};
type TableView={
 phase:string; seats:TableSeat[]; turn?:number; bottom?:number[]; bid?:number|string;
 multiplier?:number; roundNumber?:number; stake?:number|string; winner?:number;
 landlord?:number; champion?:number; spring?:boolean; deltas?:(number|string)[];
 coins?:(number|string)[]; victoryPoints?:(number|string)[]; deadline?:number;
 last?:unknown;
};

export function LandlordTableHud({game,v3,four,timing,replay=false}:{game:TableView;v3:boolean;four:boolean;timing?:RoomTiming;replay?:boolean}){
 const current=game.seats[game.turn??-1]?.name??'';
 const phase=game.phase==='bidding'?'叫分':game.phase==='equipment'?'装备':'出牌';
 return <div className="table-hud"><span>{v3?`第 ${game.roundNumber??0} 局`:'本局'}</span><div className="bottom-cards" aria-label="本局底牌">{(game.bottom?.length?game.bottom:Array.from({length:four?8:3},()=>-1)).map((card,index)=>card<0?<div key={index} className="card-back"><Crown/></div>:<Card card={card} key={`${card}-${index}`} small appearance={v3?'classic':'royal'}/>)}</div><span>{v3?`托管 ${game.stake??0}`:`叫分 ${game.bid||'—'} · ×${game.multiplier??1}`}</span>{!['waiting','finished','closed'].includes(game.phase)&&<><span className="turn-label">{game.phase==='shopping'?'购买装备':game.phase==='doubling'?'选择加倍':`${current} · ${phase}`}</span>{!replay&&timing&&<DeadlineClock deadline={game.deadline??0} timing={timing} label={game.phase==='shopping'?'购买':game.phase==='doubling'?'加倍':`${current} · ${phase}`}/>}</>}</div>;
}

export function LandlordTableStage({game,seat,v3,solo=false,onBack}:{game:TableView;seat:number;v3:boolean;solo?:boolean;onBack?:()=>void}){
 const delta=String(game.deltas?.[seat]??0);
 return <div className="table-stage">{game.phase==='waiting'?<h2>{solo?'陪练就位':'等待牌友'}</h2>:game.phase==='closed'?<><DoorOpen size={32}/><h2>这桌已结束</h2><p>房间已关闭，未完成的对局不计分。</p>{onBack&&<Button onClick={onBack}>返回大厅</Button>}</>:game.phase==='finished'?<div className="result-panel">{!v3&&<SpringEffect winner={game.winner??-1} landlord={game.landlord??-1} spring={!!game.spring}/>}<RoundSummary title={v3&&(game.champion??-1)>=0?`${game.seats[game.champion??0]?.name??''} 获得整桌胜利`:game.winner===game.landlord?'地主获胜':'农民获胜'} delta={v3?`${game.victoryPoints?.[seat]??0} 点 · ${game.coins?.[seat]??0} 金币`:`${delta.startsWith('-')?'':'+'}${delta}`}/></div>:game.phase==='shopping'?<span className="landlord-phase-note">商店阶段 · 每名玩家独立购买装备</span>:game.phase==='doubling'?<span className="landlord-phase-note">叫分已定 · 每位玩家选择是否加倍</span>:game.phase==='bidding'?<span className="landlord-phase-note">{v3?`竞价中 · 当前托管 ${game.stake??0} 金币`:`叫分中 · ${game.bid?`最高 ${game.bid} 分`:'等待叫地主'}`}</span>:<span className="landlord-phase-note">{!game.last?'自由出牌':''}</span>}</div>;
}
