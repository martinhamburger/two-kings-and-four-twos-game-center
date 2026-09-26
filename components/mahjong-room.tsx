"use client";
import {useEffect,useState} from 'react';
import {ArrowLeft,Copy,DoorOpen,History,Layers3,LogOut,Menu,Trophy,X} from 'lucide-react';
import type {MahjongView} from '@/lib/mahjong/game';
import type {ChatBubble,ChatSnapshot} from '@/lib/chat-bubbles';
import {chips,publicRound} from '@/lib/mahjong/report';
import {isHamRules} from '@/lib/mahjong/rules';
import {typeName} from '@/lib/mahjong/solver';
import {soloPractice} from '@/lib/practice/types';
import {MahjongSurface,MahjongMelds,ExpandMahjong} from './mahjong-board';
import {useMahjongSeconds,type MahjongClockSource} from './mahjong-clock';
import {MahjongTile} from './mahjong-tile';
import {MahjongActions} from './mahjong-actions';
import {MahjongAwards} from './mahjong-awards';
import {WinPicker} from './mahjong-win-picker';
import {MahjongRules} from './mahjong-rules';
import {RoomFriends} from './friends-panel';
import {RoomChat} from './room-chat';
import {RoomCodeCopy} from './room-code-copy';
import {TableSound} from './table-sound';
import {TableDetailsTrigger} from './table-ui';
import {ReportDialog,RoundDetails} from './mahjong-report';
import {Button} from './ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogTrigger,DialogDescription} from './ui/dialog';

type Room=MahjongClockSource&{code:string;title:string;revision:number};
type Action=(action:string,data?:Record<string,unknown>)=>unknown;
function Sound({room,userId}:{room:Room;userId:string}){const seconds=useMahjongSeconds(room);return <TableSound room={room} userId={userId} seconds={seconds}/>}
function Actions({room,selected,busy,connected,onAction}:{room:Room;selected:number|null;busy:boolean;connected:boolean;onAction:Action}){const seconds=useMahjongSeconds(room),g=room.game,forbidden=selected!==null&&'discardable' in g.options&&!g.options.discardable.includes(selected);return <MahjongActions hideClock game={g} selected={selected} forbidden={forbidden} busy={busy} connected={connected} seconds={seconds} onAction={onAction}/>}
function Choose({room,busy,onAction}:{room:Room;busy:boolean;onAction:Action}){const seconds=useMahjongSeconds(room);return <WinPicker code={room.code} round={room.game.round} seconds={seconds} busy={busy} onConfirm={id=>onAction('confirm_win',{candidateId:id})}/>}
function Awards({room,busy,onAction,onOpenChange}:{room:Room;busy:boolean;onAction:Action;onOpenChange:(open:boolean)=>void}){const seconds=useMahjongSeconds(room);return <MahjongAwards key={room.game.round} g={room.game} seconds={seconds} busy={busy} serverNow={room.serverNow} autoOpenFinished={false} onOpenChange={onOpenChange} onFlip={awardIndex=>onAction('flip_award',{awardIndex})}/>}
export function MahjongRoom({room,userId,busy,selected,onSelect,connected,bubbles,onSnapshot,onAction,onBack,onLeave}:{room:Room;userId:string;busy:boolean;selected:number|null;onSelect:(n:number|null)=>void;connected:boolean;bubbles:Record<string,ChatBubble>;onSnapshot:(snapshot:ChatSnapshot)=>void;onAction:Action;onBack:()=>void;onLeave:(action:'leave'|'end_table'|'end_practice')=>void}){
 const g=room.game,seat=g.seats.findIndex(s=>s.id===userId),me=g.seats[seat],solo=soloPractice(g),ham=isHamRules(g.rules.id);
 const [resultOpen,setResultOpen]=useState(false),[awardOpen,setAwardOpen]=useState(false),[rotateHint,setRotateHint]=useState(true),[copyHint,setCopyHint]=useState('');
 useEffect(()=>{setResultOpen(g.phase==='finished');},[g.phase,g.round]);
 useEffect(()=>{try{setRotateHint(sessionStorage.getItem('mj:rotate-dismissed')!=='1')}catch{}},[]);
 const botControls=g.phase==='waiting'&&g.host===userId&&!solo&&g.session&&!g.session.fixed?{busy,add:()=>{void onAction('add_bot')},remove:(botId:string)=>{void onAction('remove_bot',{botId})}}:undefined;
 const ownTiles=[...me.hand.filter(t=>t!==g.drawn),...(g.drawn!==null&&g.drawn!==undefined&&me.hand.includes(g.drawn)?[g.drawn]:[])];
 const status=g.winType==='draw'?'本局流局':g.winType==='aborted'?'本局中止':`${g.seats[g.winner]?.name??''} ${g.winType==='self'?'自摸':g.winType==='rob'?'抢杠胡':'胡牌'}`;
 async function copy(){try{await navigator.clipboard.writeText(`${location.origin}/mahjong?room=${room.code}`);setCopyHint('邀请链接已复制')}catch{setCopyHint('请分享房间号 '+room.code)}}
 function dismissRotate(){setRotateHint(false);try{sessionStorage.setItem('mj:rotate-dismissed','1')}catch{}}
 return <main className="mj-room mj-immersive table-light" aria-label="四人麻将牌桌">
 <div className="mj-table-frame" aria-hidden="true"/><div className="mj-table-brand" aria-hidden="true">娱乐中心<small>好 友 游 戏 室</small></div>
 <details className="mj-menu"><summary aria-label="牌桌菜单"><Menu size={24}/><span>菜单</span></summary><div className="mj-menu-panel"><header><b>{room.title}</b><span>房间 {room.code}<RoomCodeCopy code={room.code} compact/></span><small>{g.rules.name}{g.session?' · 基础 '+chips(g.session.baseChips)+' 筹码':''}</small></header><Button variant="ghost" onClick={onBack}><ArrowLeft size={17}/>返回大厅（保留座位）</Button>{!solo&&<Button variant="ghost" onClick={()=>void copy()}><Copy size={17}/>邀请朋友</Button>}{copyHint&&<p role="status">{copyHint}</p>}<RoomFriends code={room.code} game={g}/><Sound room={room} userId={userId}/>
<Dialog><DialogTrigger asChild><TableDetailsTrigger/></DialogTrigger><DialogContent className="mj-details-modal"><DialogHeader><DialogTitle>牌桌详情</DialogTitle><DialogDescription>本桌规则、筹码收支与公开操作记录。</DialogDescription></DialogHeader><div className="mj-details-content"><section className="mj-side-card"><div className="section-tag">这 一 桌</div><h3>{g.rules.name}</h3><p>136 张 · 无花牌<br/>不换三张 · 不定缺</p><div className="mj-rule-facts">{g.session?<><span>初始筹码<b>{chips(g.session.initialChips)} / 人</b></span><span>基础筹码<b>{chips(g.session.baseChips)} / 局</b></span><span>胡牌付款<b>自摸三家 · 点炮一家</b></span><span>响应时间<b>8 秒</b></span>{ham&&<><span>流局保留<b>12 张</b></span><span>庄家规则<b>庄赢或流局连庄</b></span>{g.wildcard>=0&&<span>赖子 / 白板代牌<b>{typeName(g.wildcard)}</b></span>}</>}</>:<span>胡牌基础分<b>1 分</b></span>}<span>出牌时限<b>{g.seconds} 秒</b></span></div><MahjongRules rulesId={g.rules.id} name={g.rules.name} snapshot={g.rules}/></section>
 {g.entries.length>0&&<section className="mj-side-card ham-live-ledger"><h3>本局筹码流水</h3>{g.entries.map(e=><p key={e.id}>{e.description}</p>)}</section>}
 {g.result&&<section className="mj-side-card ham-current-result"><h3>本局计算</h3><RoundDetails round={publicRound(g.result)}/></section>}
 <section className="mj-side-card mj-log"><h3><History size={16}/>牌桌动态</h3>{g.log.length?<div>{g.log.slice(-15).reverse().map((l,i)=><p key={i}>{l.text}</p>)}</div>:<p>牌局开始后，公开动作会记录在这里。</p>}</section>

 </div></DialogContent></Dialog>
{g.phase!=='closed'&&!me.departed&&<><Button variant="outline" disabled={busy||me.leaving} onClick={()=>onLeave('leave')}><LogOut size={17}/>{me.leaving?'结算后离开':'离开房间'}</Button>{g.host===userId&&g.session&&<Button variant="ghost" disabled={busy||me.leaving||!solo&&!['waiting','finished'].includes(g.phase)} onClick={()=>onLeave(solo?'end_practice':'end_table')}><DoorOpen size={17}/>{solo?'结束测试':'结束整桌'}</Button>}</>}</div></details>
 <div className="mj-table-info"><span>{g.roundNumber?`第 ${g.roundNumber} 局`:'等待开局'}</span>{ham&&g.wildcard>=0&&<div className="mj-wild-info"><MahjongTile tile={g.wildcard*4} wildcard={g.wildcard} small/><div><b>本局赖子</b><small>白板代 {typeName(g.wildcard)}</small></div></div>}</div>
 <MahjongSurface g={g} seat={seat} clock={room} bubbles={bubbles} botControls={botControls}>
 {g.phase==='waiting'?<div className="mj-waiting"><Layers3 size={25}/><h2>{g.seats.length===4?'四人已到齐，准备开局':'等朋友入座'}</h2><div className="mj-room-code-controls"><b>{room.code}</b><RoomCodeCopy code={room.code}/></div></div>:g.phase==='closed'?<div className="mj-waiting"><Trophy size={28}/><h2>这桌已结束</h2>{g.session&&<ReportDialog code={room.code}/>}<Button onClick={onBack}>返回大厅</Button></div>:null}
 </MahjongSurface>
 <div className="mj-right-tools"><RoomChat compact key={room.code} code={room.code} userId={userId} onSnapshot={onSnapshot} closed={g.phase==='closed'||me.departed}/><ExpandMahjong g={g} seat={seat}/></div>
 <div className="mj-phase-tools"><Awards room={room} busy={busy} onAction={onAction} onOpenChange={setAwardOpen}/>{g.phase==='finished'&&<Button variant="outline" onClick={()=>setResultOpen(true)}>查看结算</Button>}{g.phase==='choosing'&&g.canChoose&&<Choose room={room} busy={busy} onAction={onAction}/>}</div>
 <div className="mj-actions" aria-label="你的操作区">{me.leaving?<p role="status">本局按时限托管，结算后自动离桌。</p>:g.seats.some(s=>s.departed)?<p>有玩家已离桌，请房主结束整桌后重新开桌。</p>:['waiting','finished'].includes(g.phase)?<div className="table-action-row"><Button disabled={busy} onClick={()=>onAction('ready')}>{me.ready?'取消准备':g.phase==='finished'?'准备下一局':'准备好了'}</Button><span>{g.seats.filter(s=>s.ready).length}/4 已准备</span></div>:g.phase==='playing'?<Actions room={room} selected={selected} busy={busy} connected={connected} onAction={onAction}/>:<span>{g.phase==='choosing'?'正在选择胡牌方案':g.phase==='revealing'?'正在翻开奖牌':''}</span>}</div>
 <div className="mj-self-rack" aria-label="你的手牌区"><div className="mj-hand" aria-label="你的手牌">{ownTiles.map(t=><MahjongTile key={t} tile={t} wildcard={g.wildcard} selected={selected===t} drawn={g.drawn===t} onClick={g.phase==='playing'&&!me.leaving&&!me.departed?()=>onSelect(selected===t?null:t):undefined}/>)}</div><MahjongMelds s={me} own finished={g.phase==='finished'} wildcard={g.wildcard}/></div>
 {rotateHint&&<div className="mj-rotate-hint"><span>横屏可看完整四向牌桌</span><button aria-label="关闭横屏提示" onClick={dismissRotate}><X size={14}/></button></div>}

 <Dialog open={g.phase==='finished'&&resultOpen&&!awardOpen} onOpenChange={setResultOpen}><DialogContent className="mj-result-modal"><DialogHeader><DialogTitle>{status}</DialogTitle><DialogDescription>四家手牌已在原位亮开；收起结算可查看完整牌桌。</DialogDescription></DialogHeader><strong className="mj-result-own">本局 {chips(g.deltas[seat],true)}</strong><div className="mj-result-seats">{g.seats.map((s,i)=><div key={s.id}><span>{s.name}</span><b>{chips(g.deltas[i],true)}</b></div>)}</div>{g.result&&<RoundDetails round={publicRound(g.result)}/>}<div className="mj-result-buttons"><Button variant="outline" onClick={()=>setResultOpen(false)}>收起，查看牌桌</Button>{!me.leaving&&!me.departed&&!g.seats.some(s=>s.departed)&&<Button disabled={busy} onClick={()=>{onAction('ready');setResultOpen(false)}}>{me.ready?'取消准备':'准备下一局'}</Button>}</div></DialogContent></Dialog>
 </main>;
}
