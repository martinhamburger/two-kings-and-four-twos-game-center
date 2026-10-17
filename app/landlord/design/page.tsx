"use client";
import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {ArrowLeft,BookOpen,Crown,Download,Eye,Menu,RotateCcw,Save,Undo2,Upload,X} from 'lucide-react';
import {useSiteRouter} from '@/components/site-navigation';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Sheet,SheetClose,SheetContent,SheetDescription,SheetTitle,SheetTrigger} from '@/components/ui/sheet';
import {Card,HandStrip,SeatAction} from '@/components/poker-table';
import {RoyalBackground,RoyalCharacter} from '@/components/royal-character';
import {LandlordOpponent} from '@/components/landlord-opponent';
import {PlayerAvatar} from '@/components/player-avatar';
import {TableEffectsProvider} from '@/components/table-effects';
import {RoundSummary} from '@/components/table-ui';
import {useClub} from '@/components/club-provider';
import {createRoomTiming} from '@/lib/sync/clock';
import {landlordFrame} from '@/lib/game/table-layout';
import {beats,classify,hints,newGame,sorted,type Game} from '@/lib/game/engine';
import {emptyEndgame,endgameSeatName,readEndgame,startEndgame,moveEndgame,type Endgame} from '@/lib/game/endgame';
import '../../landlord.css';
import '../../landlord-layout.css';
import './design.css';

const storageKey='landlord:endgame-design:v1';
export default function EndgameDesigner(){
 const router=useSiteRouter(),{user}=useClub();
 const [position,setPosition]=useState<Endgame>(emptyEndgame),[target,setTarget]=useState(0),[game,setGame]=useState<Game|null>(null),[history,setHistory]=useState<Game[]>([]),[selected,setSelected]=useState<number[]>([]),[message,setMessage]=useState(''),[ready,setReady]=useState(false),[palette,setPalette]=useState(false),[menu,setMenu]=useState(false),[records,setRecords]=useState(false),[height,setHeight]=useState(610);
 const file=useRef<HTMLInputElement>(null),timing=useMemo(()=>createRoomTiming(),[]),frame=landlordFrame(height),userId=user?.id??'endgame-local';
 useEffect(()=>{const resize=()=>setHeight(window.innerHeight);resize();window.addEventListener('resize',resize);try{const saved=localStorage.getItem(storageKey);if(saved)setPosition(readEndgame(JSON.parse(saved),false));}catch{setMessage('本机存档无法读取，请重新设计或导入文件。');}setReady(true);return()=>window.removeEventListener('resize',resize);},[]);
 const attempt=(fn:()=>void)=>{try{fn();setMessage('');}catch(e){setMessage((e as Error).message);}};
 const update=(next:Endgame)=>attempt(()=>setPosition(readEndgame(next,false)));
 const choose=(seat:number)=>{setTarget(seat);setSelected([]);};
 const assign=(card:number)=>update({...position,hands:position.hands.map((hand,i)=>i===target?[...hand,card]:hand)});
 const begin=()=>attempt(()=>{setGame(startEndgame(position));setHistory([]);setSelected([]);setPalette(false);setMenu(false);});
 const edit=()=>{setGame(null);setHistory([]);setSelected([]);setMenu(false);setMessage('');};
 const move=(cards:number[])=>attempt(()=>{if(!game)return;const next=moveEndgame(game,cards);setHistory([...history,game]);setGame(next);setSelected([]);});
 const undo=()=>{if(!history.length)return;setGame(history.at(-1)!);setHistory(history.slice(0,-1));setSelected([]);setMessage('');};
 const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(position));setMessage('起始排局已保存到本机，下次打开可继续编辑。');setMenu(false);}catch{setMessage('本机存储不可用，请导出文件保存。');}};
 const exportFile=()=>attempt(()=>{const blob=new Blob([JSON.stringify(readEndgame(position),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='斗地主残局.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMenu(false);});
 const preview:Game={...newGame('designer','残局设计'),phase:'playing',landlord:position.landlord,turn:target,round:'endgame-edit',seats:position.hands.map((hand,i)=>({id:`design-${i}`,name:endgameSeatName(i,position.landlord),hand,ready:false,plays:0,last:''}))};
 const g=game??preview,display={...g,seats:g.seats.map((s,i)=>({...s,name:`${i+1} 号`,count:s.hand.length,tableScore:0}))},active=game?.phase==='playing',acting=game?g.turn:target,combo=classify(selected),legal=!!combo&&beats(combo,g.last?.combo??null),used=new Set(position.hands.flat());
 const hand=(seat:number,opponent=false)=><div className={opponent?'endgame-public-hand':undefined} aria-label={`${seat+1} 号手牌`}><HandStrip hand={g.seats[seat].hand} appearance="royal" layoutMode="ordinary" compact={opponent} selected={acting===seat?selected:[]} readOnly={!!game&&(!active||acting!==seat)} onChange={cards=>{if(!game&&target!==seat){setTarget(seat);}setSelected(cards);}} round={`${g.round}:${seat}`}/></div>;
 const hint=()=>{const options=hints(g.seats[g.turn].hand,g.last?.combo??null),index=options.findIndex(cards=>cards.join(',')===sorted(selected).join(','));setSelected(options[(index+1)%options.length]??[]);setMessage(options.length?'':'没有能压过的牌，可以选择不出。');};
 return <TableEffectsProvider room={null} userId={userId}><div className="app-shell royal-app">
  <main style={{'--hand-height':`${frame.hand}px`,'--hud-height':`${frame.hud}px`,'--controls-height':`${frame.controls}px`} as CSSProperties} className="room-shell table-light landlord-layout ordinary-room royal-room endgame-room">
   <RoyalBackground/>
   <div className="room-toolbar">
    <Sheet open={menu} onOpenChange={setMenu}><SheetTrigger asChild><button className="table-menu-toggle" aria-label="牌桌菜单"><Menu size={23}/><span>菜单</span></button></SheetTrigger><SheetContent side="left" className="table-menu-drawer" showCloseButton={false}><div className="table-menu-panel"><header><SheetTitle>设计排局</SheetTitle><SheetDescription>普通斗地主 · 全员明牌</SheetDescription><SheetClose className="table-menu-close" aria-label="收起牌桌菜单"><ArrowLeft size={20}/></SheetClose><small>本机残局 · 无倒计时 · 不计积分</small></header><Button variant="ghost" onClick={()=>router.push('/')}><ArrowLeft size={17}/>返回斗地主</Button><Button variant="ghost" aria-label="保存到本机" onClick={save}><Save size={17}/>保存到本机</Button><Button variant="ghost" onClick={exportFile}><Download size={17}/>导出残局</Button><Button variant="ghost" disabled={!!game} onClick={()=>{file.current?.click();setMenu(false);}}><Upload size={17}/>导入残局</Button>{game&&<><Button variant="ghost" onClick={edit}>返回编辑</Button><Button variant="ghost" onClick={begin}><RotateCcw size={17}/>重试原局</Button><Button variant="ghost" aria-label="悔棋" disabled={!history.length} onClick={undo}><Undo2 size={17}/>悔棋</Button><Button variant="ghost" onClick={()=>{setMenu(false);setRecords(true);}}><BookOpen size={17}/>试打记录</Button></>}<p className="muted">保存与导出保留起始手牌、地主和先手。未分配的牌视为已打出，每家至少 1 张。编辑完成后请保存。</p></div></SheetContent></Sheet>
    <div><div><h2>设计排局</h2><span>{game?'试打':'编辑'} · 全员明牌</span></div></div><div className="endgame-toolbar-actions">{game?<><Button variant="ghost" onClick={edit}>编辑</Button><Button variant="ghost" aria-label="悔棋" disabled={!history.length} onClick={undo}><Undo2 size={16}/><span>悔棋</span></Button></>:<Button variant="ghost" aria-label="保存到本机" onClick={save}><Save size={16}/><span>保存</span></Button>}</div>
   </div>
   <div className={`game-table landlord-board ordinary-mode phase-${game?.phase??'playing'}`}>
    <div className="table-hud"><span><Eye size={14}/>全员明牌</span><span>{game?active?`${g.seats[g.turn].name} · 出牌`:'试打结束':`编辑 ${target+1} 号手牌`}</span></div>
    <div className="landlord-arena">
     <div className="landlord-opponents">{[2,1].map(idx=><LandlordOpponent key={idx} g={display} idx={idx} off={idx} botControls={undefined} bubble={undefined} timing={timing} userId={userId} connected={false} publicHand={<><div className="endgame-seat-tools">{!game?<><Button variant={target===idx?'default':'outline'} onClick={()=>choose(idx)} aria-label={`编辑 ${idx+1} 号`}>{target===idx?'正在编辑':'编辑手牌'}</Button><Button variant="ghost" onClick={()=>{choose(idx);setPalette(true);}} aria-label={`给 ${idx+1} 号分牌`}>分牌</Button></>:<span>{g.turn===idx&&active?'当前行动':''}</span>}</div>{hand(idx,true)}</>}/> )}</div>
     <div className="table-stage">{game?.phase==='finished'?<div className="result-panel"><RoundSummary title={g.winner===g.landlord?'地主获胜':'农民获胜'} delta="残局试打 · 不计积分"/></div>:null}</div>
     <div className="landlord-self-action">{game&&g.phase!=='finished'&&<SeatAction showClock={false} appearance="royal" action={g.tableActions?.[0]} active={g.turn===0} bidding={false} name={g.seats[0].name}/>}</div>
     <div className="self-label"><div><RoyalCharacter game={g} seat={0} userId={userId} connected={false}/><div className="chat-avatar"><PlayerAvatar name="1 号"/></div><div className="self-identity"><strong>1 号</strong></div><span className="self-role">{g.landlord===0?'♛ 地主':'农民'}</span>{!game&&<Button variant="ghost" onClick={()=>choose(0)} aria-label="编辑 1 号">{target===0?'正在编辑':'编辑手牌'}</Button>}</div></div>
    </div>
    <div className="self-area"><div className={`action-bar${active?' play-controls':''}`}>
     {!game?<><Button variant="outline" onClick={()=>setPalette(true)}>给 {target+1} 号分牌</Button><Button variant="ghost" onClick={()=>update({...position,landlord:target})} aria-pressed={position.landlord===target}><Crown size={15}/>设为地主</Button><Button variant="ghost" onClick={()=>update({...position,turn:target})} aria-pressed={position.turn===target}>设为先手</Button><Button variant="secondary" disabled={!selected.length} onClick={()=>{update({...position,hands:position.hands.map((cards,i)=>i===target?cards.filter(card=>!selected.includes(card)):cards)});setSelected([]);}}>移除选牌</Button><Button className="play-button" disabled={!ready} onClick={begin}>开始试打</Button></>:active?<><Button variant="secondary" disabled={!g.last} onClick={()=>move([])}>不出</Button><Button variant="outline" onClick={hint}>提示</Button><Button variant="ghost" disabled={!selected.length} onClick={()=>setSelected([])}>重选</Button><Button className="play-button" disabled={!legal} onClick={()=>move(selected)}>出牌{selected.length>0&&<small>{selected.length}</small>}</Button><span className="selection-status">替 {acting+1} 号出牌</span></>:<><Button variant="outline" onClick={edit}>返回编辑</Button><Button className="play-button" onClick={begin}>重试原局</Button></>}
    </div><div className="landlord-hand-zone">{hand(0)}</div></div>
   </div>
   {message&&<div className="connection-error" role="status">{message}<button aria-label="关闭提示" onClick={()=>setMessage('')}><X size={16}/></button></div>}
   <input ref={file} type="file" accept=".json,application/json" hidden onChange={async e=>{const input=e.currentTarget,chosen=input.files?.[0];if(!chosen)return;try{if(chosen.size>20000)throw Error('残局文件过大');setPosition(readEndgame(JSON.parse(await chosen.text()),false));setSelected([]);setMessage('已导入残局。');}catch(error){setMessage((error as Error).message);}input.value='';}}/>
   <Dialog open={palette} onOpenChange={setPalette}><DialogContent className="landlord-cards-modal endgame-palette"><DialogHeader><DialogTitle>给 {target+1} 号分牌</DialogTitle><DialogDescription>点击可用牌加入手牌。已分配的牌不会重复出现。</DialogDescription></DialogHeader><div className="endgame-palette-seats">{[0,1,2].map(i=><Button key={i} variant={target===i?'default':'outline'} onClick={()=>choose(i)}>{i+1} 号 · {position.hands[i].length} 张</Button>)}</div><div className="expanded-card-grid">{sorted(Array.from({length:54},(_,i)=>i).filter(card=>!used.has(card))).map(card=><Card key={card} card={card} appearance="royal" onClick={()=>assign(card)}/>)}</div><Button onClick={()=>setPalette(false)}>完成分牌</Button></DialogContent></Dialog>
   <Dialog open={records} onOpenChange={setRecords}><DialogContent><DialogHeader><DialogTitle>试打记录</DialogTitle><DialogDescription>当前试打的出牌顺序，不生成联机战报。</DialogDescription></DialogHeader><div className="game-log">{game?.log.map((entry,i)=><p key={i}>{entry.text}</p>)}</div></DialogContent></Dialog>
  </main>
 </div></TableEffectsProvider>;
}
