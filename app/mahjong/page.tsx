"use client";
import "./table.css";
import {useCallback,useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {ArrowRight,Bot,Club,Plus,X} from 'lucide-react';
import {MahjongRoom} from '@/components/mahjong-room';
import {GameLobby} from '@/components/game-lobby';
import {useClub,useClubState,useRoomNavigation} from '@/components/club-provider';
import {MahjongCustomRules} from '@/components/mahjong-custom-rules';
import {TableEffectsProvider} from '@/components/table-effects';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogTrigger,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {useChatBubbles} from '@/components/player-chat';
import {TableSound} from '@/components/table-sound';
import AuthScreen from '@/components/auth-screen';
import {RoomMode} from '@/components/room-mode';
import {MahjongTile} from '@/components/mahjong-tile';
import {MahjongRules} from '@/components/mahjong-rules';
import {api} from '@/lib/client';
import type {MahjongView} from '@/lib/mahjong/game';
import {HAM,MODERN_PRESETS} from '@/lib/mahjong/rules';

type User={id:string;name:string;username:string;role:string;score:number};
type Room={code:string;title:string;revision:number;serverNow:number;receivedAt:number;game:MahjongView};
type RecordItem={id:string;room_code:string;created:number;result:{practice?:boolean;schemaVersion?:number;winner:number;winType:string;seats:{id:string;name:string;delta:number|string}[]}};
type Lobby={user:User;config:{announcement:string;seconds:number;maintenance:boolean};activeRoom:string|null;activeKind:string|null;records:RecordItem[];tables:{code:string;title:string;updated:number}[]};
export default function MahjongPage(){
 const {user,setUser,loaded,lobby,loadLobby}=useClub(),search=useSearchParams();
 const {openRoom,followRoom}=useRoomNavigation();

 const [room,setRoom]=useClubState<Room|null>('mahjong:room',null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[code,setCode]=useClubState('mahjong:code',''),[title,setTitle]=useClubState('mahjong:title','');
 const [createOpen,setCreateOpen]=useState(false),[endAction,setEndAction]=useState<'leave'|'end_table'|'end_practice'|null>(null),[selected,setSelected]=useClubState<number|null>('mahjong:selected',null);
 const [mode,setMode]=useClubState('mahjong:mode','friends');
 const [rulesId,setRulesId]=useClubState('mahjong:rulesId',HAM.id),[initial,setInitial]=useClubState('mahjong:initial','1000'),[base,setBase]=useClubState('mahjong:base','10');
 const [customRules,setCustomRules]=useClubState('mahjong:customRules',{allowChi:true,allowRobAddedKong:true,disabledWins:[] as string[]});
 const {bubbles,onSnapshot}=useChatBubbles(room?.code,user?.id);
 const [effectsConnected,setEffectsConnected]=useState(true);
 const requestPending=useRef(false);
 const roomRef=useRef<Room|null>(null);roomRef.current=room;
 const accept=useCallback((next:Room)=>setRoom(prev=>!prev||prev.code!==next.code||next.revision>prev.revision?{...next,receivedAt:Date.now()}:prev),[setRoom]);
 const fail=useCallback((e:Error&{status?:number})=>{setError(e.message);if(e.status===401){setUser(null);setRoom(null)}else if(e.status===403){setRoom(null);void loadLobby(true).catch(()=>{})}},[setUser,setRoom,loadLobby]);
 useEffect(()=>{const requested=search.get('room');if(requested&&/^\d{6}$/.test(requested))setCode(requested);},[search,setCode]);
 useEffect(()=>{void loadLobby().catch(e=>setError(e.message));},[loadLobby]);

 useEffect(()=>{if(!room?.code)return;let active=true,pending=false;const current=room.code;const poll=async()=>{if(pending)return;pending=true;try{const d=await api('/api/mahjong?room='+current);if(active&&roomRef.current?.code===current){accept(d);setEffectsConnected(true);setError('')}}catch(e){if(active){setEffectsConnected(false);fail(e as Error)}}finally{pending=false}};void poll();const id=setInterval(poll,1500);return()=>{active=false;clearInterval(id)};},[room?.code,accept,fail]);
 useEffect(()=>{window.scrollTo({top:0,behavior:'auto'});},[room?.code]);
 const g=room?.game,seat=g?.seats.findIndex(s=>s.id===user?.id)??-1,me=g?.seats[seat];
 const handKey=[room?.code,g?.round,me?.hand.join(',')].join(':');const [selectionHand,setSelectionHand]=useClubState('mahjong:selectionHand','');
 useEffect(()=>{if(handKey!==selectionHand){setSelected(null);setSelectionHand(handKey)}},[handKey,selectionHand,setSelected,setSelectionHand]);
 useEffect(()=>{if(g?.phase==='finished'||g?.phase==='closed')loadLobby(true).catch(fail)},[g?.phase,loadLobby,fail]);
 async function act(action:string,extra:Record<string,unknown>={}){if(busy||requestPending.current)return;requestPending.current=true;setBusy(true);setError('');try{const r=roomRef.current,d=await api('/api/mahjong',{action,code:r?.code||code,revision:r?.revision,...extra});if(d.redirect){await followRoom(d.redirect);return;}if(d.left){setEndAction(null);setRoom(null);const next=await loadLobby(true);if(d.departurePending&&!next?.departurePending)await loadLobby(true)}else accept(d);if(['create','join','end_table','end_practice'].includes(action)||d.game?.phase==='finished')await loadLobby(true);setCreateOpen(false);setEndAction(null);}catch(e){fail(e as Error);if((e as {status?:number}).status===409&&roomRef.current)api('/api/mahjong?room='+roomRef.current.code).then(accept).catch(fail)}finally{requestPending.current=false;setBusy(false)}}
 async function resume(){if(!lobby?.activeRoom||!lobby.activeKind)return;setBusy(true);try{await openRoom(lobby.activeKind,lobby.activeRoom)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 if(!loaded)return <main className="mj-loading"><span className="brand-icon"><Club size={22}/></span><p>正在打开游戏室…</p></main>;
 if(!user)return <><AuthScreen onAuth={setUser}/>{error&&<div className="floating-error" role="alert">{error}<button onClick={()=>loadLobby(true).catch(()=>{})}>重试</button></div>}</>;
 const gameRules=g?.rules??HAM;

 return <TableEffectsProvider room={room} userId={user.id} connected={effectsConnected}><div className="app-shell mj-shell">{!room&&<div className="club-game-tools"><TableSound room={null} userId={user.id} seconds={0}/><MahjongRules rulesId={gameRules.id} snapshot={gameRules}/></div>}
 {error&&<div className="connection-error" role="alert">{error}<button aria-label="关闭提示" onClick={()=>setError('')}><X size={17}/></button></div>}
 {!room||!g||!me?<GameLobby game="mahjong" code={code} onCode={setCode} onJoin={()=>void act('join')} busy={busy} actions={<>{lobby?.activeRoom?<>{lobby.departurePending&&<p role="status">本局正在按时限托管，结算后自动离开房间。筹码与战报会保留。</p>}<Button className="mj-start" onClick={resume} disabled={busy}>{lobby.activeKind==='mahjong'?'回到麻将桌':lobby.activeKind==='holdem'?'回到德州扑克桌':'回到斗地主房间'}<ArrowRight size={18}/></Button></>:<Dialog open={createOpen} onOpenChange={setCreateOpen}><div className="create-actions"><DialogTrigger asChild><Button className="mj-start" disabled={!lobby||lobby.config.maintenance} onClick={()=>setMode('friends')}><Plus size={19}/>开一桌麻将</Button></DialogTrigger><Button className="practice-start" variant="outline" disabled={!lobby||lobby.config.maintenance} onClick={()=>{setMode('practice');setCreateOpen(true)}}><Bot size={18}/>人机测试</Button></div><DialogContent className="ham-create-modal"><DialogHeader><DialogTitle>开一桌麻将</DialogTitle><DialogDescription>{mode==='practice'?'三位进阶陪练自动入座，支持 ham 规和基础试玩。':'四人准备后发牌。这桌的规则和筹码从建房时确定。'}</DialogDescription></DialogHeader><form className="stack-form" onSubmit={e=>{e.preventDefault();act('create',{title,mode,rulesId,initialChips:initial,baseChips:base,customRules:{...customRules,disabledWins:rulesId===HAM.id?customRules.disabledWins:[]}})}}><RoomMode mode={mode} onChange={setMode} bots={3}/><MahjongCustomRules ham={rulesId===HAM.id} value={customRules} onChange={setCustomRules}/><label htmlFor="mj-title">房间名称</label><Input id="mj-title" maxLength={24} value={title} onChange={e=>setTitle(e.target.value)} placeholder={`${user.name} 的麻将桌`}/><label htmlFor="mj-rule">麻将规则</label><Select value={rulesId} onValueChange={setRulesId}><SelectTrigger id="mj-rule"><SelectValue/></SelectTrigger><SelectContent>{MODERN_PRESETS.map(r=><SelectItem value={r.id} key={r.id}>{r.name}</SelectItem>)}</SelectContent></Select><div className="ham-create-chips"><label htmlFor="mj-initial">每人初始筹码<Input id="mj-initial" inputMode="numeric" pattern="[1-9][0-9]*" maxLength={30} value={initial} onChange={e=>setInitial(e.target.value.replace(/\D/g,''))} required/></label><label htmlFor="mj-base">基础筹码 / 局<Input id="mj-base" inputMode="numeric" pattern="[1-9][0-9]*" maxLength={30} value={base} onChange={e=>setBase(e.target.value.replace(/\D/g,''))} required/></label></div><div className="mj-room-rules"><b>{rulesId===HAM.id?'ham 规 · 随机赖子 · 白板替代':'基础试玩 · 四组牌加一对将'}</b><p>{rulesId===HAM.id?'自摸 2 倍，点炮 1 倍；门前清、无赖子不加倍，赖子不能打出，四赖可胡（4 倍，可叠加）；七小对及豪华七对的最后进牌须为 4～9 的万筒条。胡牌自主选赖子方案，先翻奖牌加分再乘倍数。明杠 1 单位、暗杠 2 单位，保留末 12 张。':'不换三张、不定缺，可吃碰杠。没有赖子、特殊倍数和奖牌，牌墙摸完流局。'}<br/>出牌 {lobby?.config.seconds||30} 秒 · 响应 8 秒{rulesId===HAM.id?' · 选方案 60 秒':''}</p></div><Button type="submit" disabled={busy}>{busy?'正在开桌…':'创建房间'}<ArrowRight size={17}/></Button></form></DialogContent></Dialog>}</>} art={<><MahjongTile tile={16}/><MahjongTile tile={52} wildcard={13}/><MahjongTile tile={88}/></>}/>:
 <MahjongRoom room={room} userId={user.id} busy={busy} selected={selected} onSelect={setSelected} connected={effectsConnected} bubbles={bubbles} onSnapshot={onSnapshot} onAction={act} onBack={()=>{setRoom(null);loadLobby(true).catch(fail)}} onLeave={setEndAction}/>
}
 <AlertDialog open={!!endAction} onOpenChange={v=>!v&&setEndAction(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{endAction==='end_practice'?'结束人机测试？':endAction==='end_table'?'结束这一桌？':'离开房间？'}</AlertDialogTitle><AlertDialogDescription>{endAction==='end_practice'?'未完成的本局记为中止，并撤销本局杠分。已完成的筹码收支和战报保留。':endAction==='end_table'?'结余筹码与每局收支将保存为整桌战报。结束后，四位玩家可以各自开新桌。':g?.session&&['playing','choosing','revealing'].includes(g.phase)?'先返回大厅，本局按时限托管，结算后自动退座。结算前仍占用本桌座位，不能加入其他房间；已完成的筹码和战报保留。':g?.session?.fixed?'立即退座，已完成的筹码和战报保留。本桌固定阵容不再补人，由剩余房主结束整桌。':'离开后释放座位，需要重新加入才能入座。'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={()=>endAction&&act(endAction)}>{endAction==='end_practice'?'结束测试':endAction==='end_table'?'结束并生成战报':'确认离开'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div></TableEffectsProvider>;
}
