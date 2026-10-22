"use client";

import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {ChatBubble} from '@/lib/chat-bubbles';
import type {ReplayFrame} from '@/lib/replay/types';
import type {MahjongView} from '@/lib/mahjong/game';
import type {RoundResult} from '@/lib/mahjong/modern';
import {getMahjongLayout} from '@/lib/mahjong/layout';
import {BASIC_136,HAM,MODERN_PRESETS} from '@/lib/mahjong/rules';
import {typeName} from '@/lib/mahjong/solver';
import {chips,publicRound} from '@/lib/mahjong/report';
import {MahjongMelds,MahjongSurface} from './mahjong-board';
import {MahjongTile} from './mahjong-tile';
import {RoundDetails} from './mahjong-report';
import {PlayerChat} from './player-chat';
import {PlayerAvatar} from './player-avatar';
import {Button} from './ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from './ui/dialog';
import '@/app/mahjong/table.css';
import '@/app/replay-mahjong.css';

type MahjongScene=ReplayFrame['scene']&{
 mahjong?:{
  round?:string;roundNumber?:number;remaining?:number;drawn?:number|null;
  pending?:{kind:string;from:number;tile:number}|null;winType?:string;
  deltas?:Array<string|number>;rulesId?:string;rulesName?:string;schemaVersion?:number;
 };
};
type MahjongSeat=MahjongScene['seats'][number]&{
 id?:string;count?:number;balance?:string|null;ready?:boolean;river?:number[];
 melds?:Array<{kind:string;tiles?:number[];cards?:number[];from?:number;concealed?:boolean}>;
};

/** The snapshot is already settled and authorized by the replay API. This adapter never runs rules. */
export function replayMahjongView(frame:ReplayFrame):MahjongView{
 const scene=frame.scene as MahjongScene,details=scene.mahjong;
 const savedResult=scene.result as RoundResult|undefined;
 const result=savedResult?.kind==='mahjong'&&savedResult.schemaVersion===2?savedResult:null;
 const rules=details?.schemaVersion===1?BASIC_136:MODERN_PRESETS.find(rule=>rule.id===details?.rulesId)??HAM;
 const seats=(scene.seats as MahjongSeat[]).map((seat,index)=>({
  id:seat.id??`replay-seat-${index}`,name:seat.name,bot:!!seat.bot,
  leaving:false,departed:false,ready:seat.ready??false,last:'',
  count:seat.count??seat.hand.length,hand:seat.hand,
  river:seat.river??seat.discards??[],
  balance:seat.balance??seat.chips??null,
  melds:(seat.melds??[]).map(meld=>({kind:meld.kind,tiles:meld.tiles??meld.cards??[],from:meld.from??index,concealed:!!meld.concealed})),
 }));
 const phase=scene.phase==='closed'?'finished':scene.phase;
 return {
  kind:'mahjong',schemaVersion:details?.schemaVersion===1?1:2,
  rules:{...rules,...scene.rules,id:details?.rulesId??rules.id,name:details?.rulesName??rules.name},
  phase,host:'',turn:scene.turn??0,dealer:scene.dealer??0,
  round:details?.round??'replay',roundNumber:details?.roundNumber??1,
  seconds:0,deadline:0,remaining:details?.remaining??scene.wallRemaining??0,
  drawn:details?.drawn??null,lastDiscard:scene.lastDiscard??null,pending:details?.pending??null,
  winner:scene.winner??result?.winner??-1,winType:details?.winType??'',source:result?.source??-1,
  deltas:details?.deltas??[],log:[],options:{},wildcard:scene.wildcard??-1,
  result,session:null,entries:result?.entries??[],canChoose:false,awardReveal:null,practice:null,
  visualEvents:[],seats,
 } as unknown as MahjongView;
}

export function ReplayMahjongTable({frame,perspective,bubbles={},onInspect}:{frame:ReplayFrame;perspective:number;bubbles?:Record<string,ChatBubble>;onInspect?:()=>void;showResult?:boolean}){
 const game=replayMahjongView(frame);
 const seat=Math.max(0,Math.min(game.seats.length-1,perspective));
 const roomElement=useRef<HTMLElement>(null);
 const resultButton=useRef<HTMLButtonElement>(null);
 const [layout,setLayout]=useState(()=>getMahjongLayout(1600,900));
 const [layoutReady,setLayoutReady]=useState(false);
 useEffect(()=>{
  const element=roomElement.current;if(!element)return;
  let tick=0;
  const measure=()=>{cancelAnimationFrame(tick);tick=requestAnimationFrame(()=>{
   const {width,height}=element.getBoundingClientRect();
   setLayout(previous=>previous.viewport.width===width&&previous.viewport.height===height?previous:getMahjongLayout(width,height));
   setLayoutReady(true);
  });};
  const observer=new ResizeObserver(measure);observer.observe(element);measure();
  return()=>{observer.disconnect();cancelAnimationFrame(tick)};
 },[]);
  const [resultChoice,setResultChoice]=useState<{at:number;open:boolean}|null>(null);
  const resultOpen=game.phase==='finished'&&resultChoice?.at===frame.at&&resultChoice.open;
  const setResultOpen=(open:boolean)=>setResultChoice({at:frame.at,open});
 const handLayout=layout.selfRack,me=game.seats[seat];
 const restingCount=Math.max(0,13-me.melds.length*3);
 const hand=[...me.hand.filter(tile=>tile!==game.drawn),...(game.drawn!==null&&me.hand.includes(game.drawn)?[game.drawn]:[])];
 const drawn=hand.length>restingCount?hand.at(-1):undefined;
 const style={'--hand-w':`${handLayout.tileW}px`,'--hand-h':`${handLayout.tileH}px`,'--mj-selection-lift':`${handLayout.lift}px`,'--actions-y':`${layout.actionsY}px`,'--self-rack-y':`${handLayout.y}px`,'--message-y':`${layout.camera.cy}px`} as CSSProperties;
 const winner=game.seats[game.winner]?.name;
 const settlement=game.winType==='draw'?'本局流局':game.winType==='aborted'?'本局中止':winner?`${winner}${game.winType==='self'?'自摸':game.winType==='rob'?'抢杠胡':'胡牌'}`:'本局结算';
 return <>
  <main ref={roomElement} className="mj-room mj-immersive table-light replay-mj-table" data-layout={layout.mode} data-phase={game.phase} data-layout-ready={layoutReady} style={style} aria-label="麻将对局回放">
   <div className="mj-table-info"><span>第 {game.roundNumber} 局</span>{game.wildcard>=0&&<div className="mj-wild-info"><MahjongTile tile={game.wildcard*4} wildcard={game.wildcard} small/><div><b>本局赖子</b><small>白板代 {typeName(game.wildcard)}</small></div></div>}</div>
   <MahjongSurface riverTools={null} g={game} seat={seat} layout={layout} bubbles={bubbles} revealHands hideSelfPortrait/>
   {(['east','north','west'] as const).map((position,index)=>{const player=game.seats[(seat+index+1)%4];return player?<div key={player.id} className={`replay-mj-open-hand replay-mj-open-${position}`} style={{'--north-desktop-columns':Math.max(1,player.hand.length),'--north-columns':player.hand.length<=11?Math.max(1,player.hand.length):7} as CSSProperties} aria-label={`${player.name}的明牌手牌`}><div className="replay-mj-hand-tiles">{player.hand.map(tile=><MahjongTile key={tile} tile={tile} wildcard={game.wildcard} small/>)}</div><MahjongMelds s={player} own finished={game.phase==='finished'} wildcard={game.wildcard}/></div>:null})}
   <div className={`replay-mj-own-heading${game.phase==='playing'&&!game.pending&&game.turn===seat?' is-active':''}`} aria-label={`${me.name}的座位`}>
    <PlayerChat bubble={bubbles[me.id]} align="center"><PlayerAvatar name={me.name} userId={me.id} bot={me.bot}/></PlayerChat>
    <div><strong>{me.name}{game.dealer===seat&&<span>庄</span>}</strong><small>{me.balance!==null&&<span>{chips(me.balance)} 筹码</span>}<span>{me.count} 张{me.bot?' · 人机':''}</span></small></div>
   </div>
   <div className="mj-self-rack" style={{left:handLayout.x,top:handLayout.y,width:handLayout.width,height:handLayout.height}} aria-label={`${me.name}的手牌区`}><div className="mj-hand" aria-label={`${me.name}的手牌`}>{hand.map((tile,index)=><div className="mj-hand-slot" key={tile} style={{left:(index%handLayout.columns)*(handLayout.tileW+handLayout.gap)+(drawn===tile?handLayout.drawGap:0),top:Math.floor(index/handLayout.columns)*(handLayout.tileH+handLayout.rowGap)-handLayout.lift,height:handLayout.tileH+handLayout.lift}}><MahjongTile tile={tile} wildcard={game.wildcard} drawn={drawn===tile}/></div>)}</div></div>
   {game.phase==='finished'&&<div className="replay-mj-tools"><Button ref={resultButton} type="button" variant="outline" onClick={()=>{onInspect?.();setResultOpen(true)}}>查看结算</Button></div>}
  </main>
  <Dialog open={resultOpen} onOpenChange={setResultOpen}><DialogContent className="mj-result-modal" onCloseAutoFocus={e=>{e.preventDefault();resultButton.current?.focus()}}><DialogHeader><DialogTitle>{settlement}</DialogTitle><DialogDescription>第 {game.roundNumber} 局 · {game.rules.name}</DialogDescription></DialogHeader><strong className="mj-result-own">本局 {game.deltas[seat]!==undefined?chips(game.deltas[seat],true):'已结束'}</strong><div className="mj-result-seats">{game.seats.map((player,index)=><div key={player.id}><span>{player.name}</span><b>{game.deltas[index]!==undefined?chips(game.deltas[index],true):'—'}</b></div>)}</div>{game.result&&<RoundDetails round={publicRound(game.result)}/>}<Button type="button" variant="outline" onClick={()=>setResultOpen(false)}>返回牌桌</Button></DialogContent></Dialog>
 </>;
}
