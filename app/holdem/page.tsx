"use client";
import {useRoomAvatarSync} from '@/components/avatar-provider';
import {PlayerAvatar} from '@/components/player-avatar';
import {GameLobby} from '@/components/game-lobby';
import {RoomFriends} from '@/components/friends-panel';
import {HoldemSeatWager} from '@/components/holdem-seat-wager';
import {TableDetailsTrigger} from '@/components/table-ui';
import {RoomCodeCopy} from '@/components/room-code-copy';
import {useSearchParams} from 'next/navigation';
import {useClub,useClubState,useRoomNavigation,HistoryEntry} from '@/components/club-provider';
import {useCallback,useEffect,useRef,useState,type CSSProperties} from 'react';
import {Club,ArrowLeft,Plus,Users,Timer,Copy,Settings,LogOut,History,Bot,Coins} from 'lucide-react';
import {Button} from '@/components/ui/button';import {Input} from '@/components/ui/input';import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogTrigger} from '@/components/ui/dialog';
import AuthScreen from '@/components/auth-screen';import {HoldemCard} from '@/components/holdem-card';import {HoldemControls} from '@/components/holdem-controls';import {GameNav} from '@/components/game-nav';import {RoomMode} from '@/components/room-mode';import {RoomChat} from '@/components/room-chat';import {PlayerChat,useChatBubbles} from '@/components/player-chat';import {TableSound} from '@/components/table-sound';import {HoldemRulesGuide} from '@/components/holdem-rules';
import {api} from '@/lib/client';import {holdemRules,type HoldemView,type HoldemResult} from '@/lib/holdem/engine';
import {chips} from '@/lib/mahjong/report';
import {holdemSeatPosition} from '@/lib/holdem/layout';
type User={id:string;name:string;role:string;score:number};type Room={code:string;title:string;revision:number;serverNow:number;receivedAt:number;game:HoldemView};
type Lobby={activeRoom?:string;activeKind?:string;config:{seconds:number;announcement:string;maintenance:boolean};records:{room_code:string;result:HoldemResult}[];tables:{code:string;title:string;rounds:number;ended:number;net:string;brought:string;stack:string}[]};
const streetName={preflop:'翻牌前',flop:'翻牌',turn:'转牌',river:'河牌'};
export default function Holdem(){
 const {user,setUser,loaded,lobby,loadLobby}=useClub(),search=useSearchParams();
 const {openRoom,followRoom}=useRoomNavigation();

 const [room,setRoom]=useClubState<Room|null>('holdem:room',null);
 useRoomAvatarSync(room?.code);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[clock,setClock]=useState(Date.now()),[create,setCreate]=useState(false),[code,setCode]=useClubState('holdem:code',''),[title,setTitle]=useClubState('holdem:title',''),[capacity,setCapacity]=useClubState('holdem:capacity',6),[mode,setMode]=useClubState('holdem:mode','friends'),[initial,setInitial]=useClubState('holdem:initial','1000'),[ante,setAnte]=useClubState('holdem:ante','10'),[small,setSmall]=useClubState('holdem:small','20'),[big,setBig]=useClubState('holdem:big','30'),[seconds,setSeconds]=useClubState('holdem:seconds',30),[copied,setCopied]=useState(false),[ending,setEnding]=useState(false);
 const [connection,setConnection]=useState({code:'',ready:false}),[controlReset,setControlReset]=useState(0);
 const connectionRef=useRef(connection);connectionRef.current=connection;const requestPending=useRef(false);
 const tableScroll=useRef<HTMLDivElement>(null);
 useEffect(()=>{const el=tableScroll.current;if(!el)return;const center=()=>{el.scrollLeft=Math.max(0,(el.scrollWidth-el.clientWidth)/2)};center();const resize=new ResizeObserver(center);resize.observe(el);return()=>resize.disconnect()},[room?.code]);
 const viewerRef=useRef(user?.id);viewerRef.current=user?.id;
 const ref=useRef(room);ref.current=room;const {bubbles,onSnapshot}=useChatBubbles(room?.code,user?.id);
 const accept=useCallback((r:Room)=>{setRoom(old=>!old||old.code!==r.code||r.revision>=old.revision?{...r,receivedAt:Date.now()}:old)},[setRoom]);
 const load=loadLobby;
 useEffect(()=>{const requested=search.get('room');if(requested&&/^\d{6}$/.test(requested))setCode(requested);},[search,setCode]);
 useEffect(()=>{void loadLobby().catch(e=>setError(e.message));},[loadLobby]);
 const [secondsInitialized,setSecondsInitialized]=useClubState('holdem:secondsInitialized',false);
 useEffect(()=>{if(lobby&&!secondsInitialized){setSeconds(lobby.config.seconds);setSecondsInitialized(true)}},[lobby,secondsInitialized,setSeconds,setSecondsInitialized]);
 useEffect(()=>{const id=setInterval(()=>setClock(Date.now()),250);return()=>clearInterval(id)},[]);
 useEffect(()=>{
  const roomCode=room?.code,viewer=user?.id;if(!roomCode||!viewer)return;
  let active=true,pending=false,epoch=0,controller:AbortController|undefined;
  const disconnect=()=>{epoch++;controller?.abort();connectionRef.current={code:roomCode,ready:false};setConnection(connectionRef.current);setControlReset(v=>v+1)};
  disconnect();
  const poll=async()=>{
   if(pending||document.hidden)return;
   pending=true;const generation=epoch;controller=new AbortController();
   try{
    const d=await api('/api/holdem?room='+roomCode,undefined,AbortSignal.any([controller.signal,AbortSignal.timeout(12000)]));
    if(active&&generation===epoch&&ref.current?.code===roomCode&&viewerRef.current===viewer){accept(d);connectionRef.current={code:roomCode,ready:true};setConnection(connectionRef.current)}
   }catch(e){
    if(active&&generation===epoch&&viewerRef.current===viewer){disconnect();setError((e as Error).message);
     if((e as {status?:number}).status===401)setUser(null);
     else if((e as {status?:number}).status===403){setRoom(null);void loadLobby(true).catch(()=>{})}
    }
   }finally{pending=false}
  };
  const visibility=()=>{disconnect();if(!document.hidden)void poll()};
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('offline',disconnect);window.addEventListener('online',visibility);
  void poll();const id=setInterval(poll,1000);
  return()=>{active=false;controller?.abort();clearInterval(id);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('offline',disconnect);window.removeEventListener('online',visibility)};
 },[room?.code,user?.id,accept,setUser,setRoom,loadLobby]);
 const g=room?.game,seat=g?.seats.findIndex(s=>s.id===user?.id)??-1;
 const remaining=room?Math.max(0,Math.ceil((room.game.deadline-clock-room.serverNow+room.receivedAt)/1000)):0;
 async function act(action:string,extra:Record<string,unknown>={}):Promise<boolean>{
  if(requestPending.current)return false;
  const viewer=viewerRef.current,r=ref.current,betting=['fold','check','call','allin','raise'].includes(action);
  if(betting&&(!r||!r.game.options.acting||!connectionRef.current.ready||connectionRef.current.code!==r.code||r.game.deadline<=Date.now()+r.serverNow-r.receivedAt))return false;
  requestPending.current=true;setBusy(true);setError('');
  try{
   const d=await api('/api/holdem',{action,code:r?.code||code,revision:r?.revision,...extra},AbortSignal.timeout(12000));
   if(viewerRef.current!==viewer||betting&&ref.current?.code!==r?.code)return false;
   if(d.redirect){await followRoom(d.redirect);return true;}
   if(d.left){setRoom(null);void load(true).catch(()=>{})}else accept(d);
   if(betting)setControlReset(v=>v+1);
   if(['create','join','end_table','end_practice'].includes(action)||d.game?.phase==='finished')void loadLobby(true).catch(()=>{});
   setCreate(false);setEnding(false);return true;
  }catch(e){
   if(viewerRef.current===viewer&&(!r||ref.current?.code===r.code)){
    setError((e as {status?:number}).status===409?'牌桌已更新，请核对最新金额后重新确认。':(e as Error).name==='TimeoutError'?'请求结果尚未确认，正在刷新牌桌，请核对后重新操作。':(e as Error).message);
    if(betting){setControlReset(v=>v+1);connectionRef.current={code:r?.code??'',ready:false};setConnection(connectionRef.current)}
    if((e as {status?:number}).status===409&&r){try{const fresh=await api('/api/holdem?room='+r.code);if(viewerRef.current===viewer&&ref.current?.code===r.code)accept(fresh)}catch{}}
   }
   return false;
  }finally{requestPending.current=false;setBusy(false)}
 }
 const timeoutQueue=useRef<Promise<unknown>>(Promise.resolve());
 const syncTimeoutChoice=useCallback((payload:Record<string,unknown>):Promise<boolean>=>{
  const viewer=viewerRef.current,code=ref.current?.code;
  const task=timeoutQueue.current.catch(()=>{}).then(async()=>{
   const r=ref.current;
   if(!r||r.code!==code||viewerRef.current!==viewer||!connectionRef.current.ready)return false;
   try{
    const d=await api('/api/holdem',{action:'timeout_choice',code,revision:r.revision,...payload},AbortSignal.timeout(5000));
    if(viewerRef.current!==viewer||ref.current?.code!==code)return false;
    accept(d);return true;
   }catch{
    // Never retry a paid choice after a conflict. Only attempt to cancel it.
    try{
     const fresh=await api('/api/holdem?room='+code,undefined,AbortSignal.timeout(5000));
     if(viewerRef.current===viewer&&ref.current?.code===code){
      accept(fresh);
      const me=fresh.game.seats.find((s:{id:string})=>s.id===viewer);
      if(me&&fresh.game.phase==='playing'&&!me.folded&&!me.allIn){
       const cleared=await api('/api/holdem',{action:'timeout_choice',code,revision:fresh.revision,round:fresh.game.round,street:fresh.game.street,bet:me.bet,stack:me.stack,choice:null},AbortSignal.timeout(5000));
       if(viewerRef.current===viewer&&ref.current?.code===code)accept(cleared);
      }
     }
    }catch{ /* Surface failure: an unacknowledged cancellation is never called saved. */ }
    return false;
   }
  });
  timeoutQueue.current=task;return task;
 },[accept]);
 async function resume(){if(!lobby?.activeRoom||!lobby.activeKind)return;setBusy(true);try{await openRoom(lobby.activeKind,lobby.activeRoom)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 if(!loaded)return <main className="mj-loading">正在打开德州牌桌…</main>;if(!user)return <AuthScreen onAuth={setUser}/>;
 return <div className="app-shell th-shell"><div className="club-game-tools">{room&&g&&<RoomFriends code={room.code} game={g}/>}<TableSound room={room?{...room,game:{...room.game,options:undefined}}:null} userId={user.id} seconds={remaining}/>{!room&&<HoldemRulesGuide rules={holdemRules()}/>}</div>
 {error&&<div className="th-error" role="alert">{error}<button onClick={()=>setError('')}>×</button></div>}
 {!room||!g?<GameLobby game="holdem" code={code} onCode={setCode} onJoin={()=>void act('join')} busy={busy} actions={<>{lobby?.activeRoom?<Button onClick={resume}>返回当前房间 {lobby.activeRoom}</Button>:<div className="create-actions"><Button onClick={()=>{setMode('friends');setCreate(true)}} disabled={!lobby||lobby.config.maintenance}><Plus size={18}/>开一桌德州</Button><Button variant="outline" className="practice-start" onClick={()=>{setMode('practice');setCreate(true)}} disabled={!lobby||lobby.config.maintenance}><Bot size={18}/>人机测试</Button></div>}</>} art={<><HoldemCard card={44} size="hero"/><HoldemCard card={45} size="hero"/></>}/>:<main className="th-room table-light"><div className="th-room-heading"><Button variant="ghost" size="icon" aria-label="返回德州大厅" onClick={()=>{setRoom(null);void load(true)}}><ArrowLeft size={20}/></Button><div><h1>{room.title}</h1><p>房间 {room.code}<RoomCodeCopy code={room.code} compact/> · 盲注 {chips(g.rules.small)}/{chips(g.rules.big)}</p></div><Button variant="outline" onClick={()=>navigator.clipboard.writeText(location.origin+'/holdem?room='+room.code).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)}).catch(()=>setError('请把房间号 '+room.code+' 发给朋友'))}><Copy size={16}/>{copied?'已复制':'邀请朋友'}</Button></div><p className="th-scroll-hint">左右滑动查看牌桌</p>
 <div ref={tableScroll} className="th-table-scroll"><section className={`th-table${g.rules.capacity>6?' is-large':''}${g.result&&g.rules.id==='holdem-v5'?' is-settled':''}`} aria-label={`${g.rules.capacity} 人德州牌桌`}><div className="th-felt"/><div className="th-table-number">第 {g.roundNumber||'—'} 手 · {g.seats.length}/{g.rules.capacity} 人</div><div className="th-center"><span className="th-street">{g.phase==='waiting'?'等朋友入座':g.phase==='finished'?'本手已结算':g.phase==='closed'?'整桌已结束':streetName[g.street]}</span><div className="th-pot"><Coins size={20}/><span>{['finished','closed'].includes(g.phase)?'本手总投入':'底池'} <b>{chips(g.pot)}</b></span></div><div className="th-community" aria-label="公共牌">{Array.from({length:5},(_,i)=>g.board[i]!==undefined?<HoldemCard key={i} card={g.board[i]}/>:<span key={i} className="th-card-placeholder">—</span>)}</div>{g.phase==='waiting'&&<p>准备后开局</p>}</div>
 {Array.from({length:g.rules.capacity},(_,relative)=>{const index=(Math.max(seat,0)+relative)%g.rules.capacity,s=g.seats[index],position=holdemSeatPosition(g.rules.capacity,relative),style={'--x':`${position.x}%`,'--y':`${position.y}%`} as CSSProperties;return <section key={s?.id??index} style={style} className={`th-seat ${g.turn===index&&g.phase==='playing'?'is-turn':''} ${s?.folded?'is-folded':''} ${index===seat?'is-me':''} ${position.y<35?'is-upper':''} ${position.x>50?'is-right':''}`} aria-label={(s?.name||'空位')+'的座位'}>{s?<><PlayerChat bubble={bubbles[s.id]} align="center"><PlayerAvatar name={s.name} userId={s.id} bot={s.bot}/></PlayerChat><b className="th-player-name" title={s.name}>{index===seat?'你':s.name}{s.bot&&<small>人机</small>}</b><div className="th-position">{g.button===index&&<em>D</em>}{g.smallSeat===index&&<span>小盲</span>}{g.bigSeat===index&&<span>大盲</span>}{s.folded&&g.result?.rules.id==='holdem-v5'&&<span>弃牌</span>}</div><>{index!==seat&&<strong className="th-stack" aria-label={`剩余 ${chips(s.stack)} 筹码`}>{chips(s.stack)}</strong>}{index!==seat&&<div className="th-hole" aria-label={s.name+'的底牌'}>{s.hand.length?s.hand.map(c=><HoldemCard key={c} card={c} size="seat"/>):[0,1].map(i=><span className="th-card-back" key={i}/>)}</div>}</>{['playing','runout'].includes(g.phase)?<HoldemSeatWager seat={s} street={g.street} round={g.round} active={g.phase==='playing'&&g.turn===index&&index!==seat} seconds={Math.min(g.rules.seconds,remaining)} userId={user.id}/>:g.result&&['finished','closed'].includes(g.phase)?<span className="th-seat-result" aria-label={`${s.name}的结算牌型`}>{g.result.type==='aborted'?'本手中止':g.result.seats.find(p=>p.id===s.id)?.value?.name??(s.folded?'已弃牌':g.result.type==='fold'?(g.result.rules.id==='holdem-v5'?'其余玩家弃牌获胜':'未摊牌获胜'):'未摊牌')}</span>:s.ready&&<span className="th-seat-action">已准备</span>}{s.bot&&!g.fixed&&g.host===user.id&&<button className="th-remove" disabled={busy} onClick={()=>act('remove_bot',{botId:s.id})}>移除人机</button>}</>:<div className="th-empty"><Users size={26}/><span>等一位朋友</span>{g.host===user.id&&!g.fixed&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>act('add_bot')}><Bot size={14}/>添加人机</Button>}</div>}</section>})}</section></div>
 <HoldemControls game={g} userId={user.id} roomCode={room.code} connected={connection.code===room.code&&connection.ready} reset={controlReset} seconds={remaining} busy={busy} onAction={act} onTimeoutChoice={syncTimeoutChoice}><RoomChat compact key={room.code} userId={user.id} closed={g.phase==='closed'} code={room.code} onSnapshot={onSnapshot}/></HoldemControls>
 <div className="th-tools"><Dialog><DialogTrigger asChild><TableDetailsTrigger/></DialogTrigger><DialogContent className="th-rules"><DialogHeader><DialogTitle>牌桌详情</DialogTitle><DialogDescription>净输赢已扣除累计带入；补筹码不算赢分。</DialogDescription></DialogHeader><HoldemRulesGuide rules={g.rules}/><table className="th-summary"><thead><tr><th>玩家</th><th>累计带入</th><th>结余</th><th>净输赢</th></tr></thead><tbody>{g.seats.map(s=><tr key={s.id}><td>{s.name}</td><td>{chips(s.brought)}</td><td>{chips(s.stack)}</td><td>{chips(s.net,true)}</td></tr>)}</tbody></table>{g.result&&<ResultDetails result={g.result}/>}<details><summary>本手操作记录</summary>{g.log.map((l,i)=><p key={i}>{l.text}</p>)}</details></DialogContent></Dialog>{!g.fixed&&g.phase==='waiting'&&<Button variant="ghost" onClick={()=>act('leave')}>离开房间</Button>}{g.host===user.id&&['waiting','finished'].includes(g.phase)&&<Button variant="ghost" onClick={()=>setEnding(true)}>结束整桌</Button>}{g.phase==='closed'&&<Button onClick={()=>{setRoom(null);void load(true)}}>返回大厅</Button>}</div></main>}
 <Dialog open={create} onOpenChange={setCreate}><DialogContent className="th-create"><DialogHeader><DialogTitle>开一桌德州扑克</DialogTitle><DialogDescription>设置在建房后固定，整桌使用同一套规则。</DialogDescription></DialogHeader><form className="th-form" onSubmit={e=>{e.preventDefault();void act('create',{title,capacity,initial,ante,small,big,seconds,mode})}}><label>房间名称<Input value={title} onChange={e=>setTitle(e.target.value)} maxLength={24} placeholder={user.name+' 的德州桌'}/></label><div className="th-form-grid"><label>座位数<select value={capacity} onChange={e=>setCapacity(Number(e.target.value))}>{Array.from({length:7},(_,i)=><option key={i} value={i+4}>{i+4} 人</option>)}</select></label><label>每人初始筹码<Input value={initial} inputMode="numeric" onChange={e=>setInitial(e.target.value)}/></label><label>每人前注<Input value={ante} inputMode="numeric" onChange={e=>setAnte(e.target.value)}/></label><label>小盲<Input value={small} inputMode="numeric" onChange={e=>setSmall(e.target.value)}/></label><label>大盲<Input value={big} inputMode="numeric" onChange={e=>setBig(e.target.value)}/></label><label>操作时限<select value={seconds} onChange={e=>setSeconds(Number(e.target.value))}>{[15,30,45,60].map(s=><option value={s} key={s}>{s} 秒</option>)}</select></label></div><RoomMode mode={mode} onChange={setMode} bots={capacity-1} betweenHandsOnly/><p>固定盲注 · 无限注 · 无抽水<br/>每手正常结束后全员亮牌，包括弃牌者。<br/>输光后可在局间补入初始筹码，累计带入单独记录。</p><>{error&&<p role="alert" className="form-error">{error}</p>}</><Button disabled={busy} type="submit"><Plus size={17}/>创建 {capacity} 人房</Button></form></DialogContent></Dialog>
 <Dialog open={ending} onOpenChange={setEnding}><DialogContent><DialogHeader><DialogTitle>结束这桌德州扑克？</DialogTitle><DialogDescription>保留已完成的结算，所有玩家可重新建房。</DialogDescription></DialogHeader><Button disabled={busy} onClick={()=>act('end_table')}>确认结束整桌</Button></DialogContent></Dialog></div>;
}
function ResultDetails({result:r}:{result:HoldemResult}){return <section className="th-result-detail"><h3>第 {r.roundNumber} 手 · {r.type==='aborted'?'本手中止':r.type==='fold'?(r.rules.id==='holdem-v5'?'弃牌结算 · 全员亮牌':'无需摊牌'):'摊牌结果'}</h3><div className="th-report-board">{r.board.map(c=><HoldemCard key={c} card={c} size="report"/>)}</div>{r.pots.map((p,i)=><p key={i}><b>{p.refund?'退回未被跟注部分':i===0?'主池':'边池 '+i} {chips(p.amount)}</b><span>{p.winners.map(w=>r.seats[w].name).join('、')}</span></p>)}{r.seats.map(s=><div className="th-report-player" key={s.id}><b>{s.name} <span className={BigInt(s.delta)>=0n?'positive':'negative'}>{chips(s.delta,true)}</span></b>{s.hand.length>0&&<div aria-label={s.name+'的结算底牌'}>{s.hand.map(c=><HoldemCard key={c} card={c} size="report"/>)}</div>}{s.value&&<span>{s.value.name} · 最佳五张</span>}<div>{s.value?.cards.map(c=><HoldemCard key={c} card={c} size="report"/>)}</div></div>)}</section>}
