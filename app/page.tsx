"use client";
import {GameLobby} from '@/components/game-lobby';
import {RoomFriends} from '@/components/friends-panel';
import {TableNotice,TableDetailsTrigger,RoundSummary} from '@/components/table-ui';
import {RoomCodeCopy,RoomCodeDigits} from '@/components/room-code-copy';
import {TableEffectsProvider,SpringEffect} from '@/components/table-effects';
import Link from '@/components/site-navigation';
import {useSearchParams} from 'next/navigation';
import {useClub,useClubState,useRoomNavigation,HistoryEntry} from '@/components/club-provider';
import {DEFAULT_LANDLORD_RULES,type LandlordRules} from '@/lib/game/engine';
import {DEFAULT_LANDLORD_V3_RULES,selectionCombo,equipmentAvailable} from '@/lib/game/landlord-v3';
import {Switch} from '@/components/ui/switch';
import {memo,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,Check,ChevronRight,Club,Copy,Crown,DoorOpen,History,Info,LogOut,Plus,RefreshCw,Settings,ShieldCheck,Timer,Users,X} from 'lucide-react';
import {RoomChat} from '@/components/room-chat';
import {PlayerChat,useChatBubbles} from '@/components/player-chat';
import {PokerSeatHand} from '@/components/round-hands';
import {soloPractice} from '@/lib/practice/types';
import {EmptyBotSeat,RemoveBotSeat} from '@/components/bot-seat';
import {TableSound} from '@/components/table-sound';
import AuthScreen from '@/components/auth-screen';
import {Bot} from 'lucide-react';
import {RoomMode,PracticeBanner} from '@/components/room-mode';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogTrigger,DialogDescription} from '@/components/ui/dialog';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Toaster,toast} from 'sonner';
import {api} from '@/lib/client';
import {useRoomMessages} from '@/components/use-room-messages';
import {createRoomTiming} from '@/lib/sync/clock';
import {roomPollInterval} from '@/lib/sync/poller';
import {newerRoom} from '@/lib/sync/snapshot';
import {EquipmentFeed} from '@/components/equipment-feed';
import {DeadlineButton} from '@/components/deadline-clock';
import {classify,beats,rank,hints} from '@/lib/game/engine';

import {Card,HandStrip,SeatAction} from '@/components/poker-table';

type Player={id:string;name:string;username:string;role:string;score:number};
function Brand(){return <div className="brand"><span className="brand-icon"><Club size={21}/></span><span>娱乐中心<small>好 友 游 戏 室</small></span></div>}
const romanNumerals=['I','II','III','IV'] as const;
type V3CatalogEntry={id:string;name:string;level:number;price:string;effect?:string;family?:string};
const equipmentInitial=(name:string)=>name.replace(/^\d+\s*级\s*/,'').trim().slice(0,1)||'装';
const equipmentNames:Record<string,string>={'bomb-1':'小炸弹','bomb-2':'中炸弹','bomb-3':'大炸弹','bomb-4':'超级炸弹','copy-3':'搞三张','copy-4':'搞四张','precision-copy-1':'点一张','precision-copy-2':'点二张','precision-copy-3':'复刻'};
function EquipmentCatalog({game,seat}:{game:any;seat:number}){
 const [open,setOpen]=useState(false);
 const entries:V3CatalogEntry[]=((game?.rules?.equipmentCatalog?.length?game.rules.equipmentCatalog:DEFAULT_LANDLORD_V3_RULES.equipmentCatalog) as V3CatalogEntry[]).filter(item=>equipmentAvailable(item.id));
 const held=new Set<string>(((game?.equipment?.[seat]??[]) as any[]).map((item:any)=>item.id));
 return <><Button variant="ghost" size="sm" aria-label="装备一览" onClick={()=>setOpen(true)}><Info size={16}/><span className="hide-small">装备一览</span></Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="v3-catalog-modal"><DialogHeader><DialogTitle>装备一览</DialogTitle><DialogDescription>{entries.length} 件装备，按等级排列；持有中的会标注出来。装备只在本桌赛制内有效。</DialogDescription></DialogHeader><div className="v3-catalog-list">{[1,2,3,4].map(level=><section key={level}><h4><span className="v3-equipment-tier" aria-label={`${level} 级装备`}>{romanNumerals[level-1]}</span>标价 {2**(level-1)} 金币</h4>{entries.filter(item=>item.level===level).map(item=><article key={item.id} className={held.has(item.id)?'is-held':''}><strong>{item.name}{held.has(item.id)&&<em>已持有</em>}</strong><p>{item.effect}</p></article>)}</section>)}</div></DialogContent></Dialog></>;
}
const V3Shop=memo(function V3Shop({game,seat,busy,onAction}:{game:any;seat:number;busy:boolean;onAction:(action:string,extra?:any)=>void}){
 const [detail,setDetail]=useState<Omit<V3CatalogEntry,'id'>|null>(null),catalog=new Map<string,V3CatalogEntry>((game.rules?.equipmentCatalog||[] as V3CatalogEntry[]).map((item:V3CatalogEntry)=>[item.id,item]));
 busy=busy||game.seats[seat]?.last==='商店完成';
 const offers=game.shops?.[seat]?.offers||[],coins=BigInt(game.coins?.[seat]??'0');
 const entry=(offer:any):V3CatalogEntry=>catalog.get(offer.id)??{id:offer.id,name:'测试装备',level:offer.level,price:offer.price};
 const mine:any[]=game.equipment?.[seat]||[],usedKey=(key:string)=>(game.equipmentUsed||[]).includes(`${seat}:${key}`),usedTable=(key:string)=>(game.tableUsed||[]).includes(key),openOffers=offers.filter((offer:any)=>!offer.bought);
 const canClear=mine.some((held:any)=>held.id==='clearance')&&!usedKey('clearance')&&!usedTable('clearance')&&openOffers.length>0;
 const canConnect=mine.some((held:any)=>held.id==='connections')&&!usedTable(`connections:${seat}`)&&!usedKey('clearance')&&coins>=6n;
 return <><section className="v3-shop" aria-label="扩展赛制商店"><div className="v3-shop-heading"><div><h3>装备商店</h3><p>{game.coins?.[seat]??'0'} 金币 · 已持有 {game.equipment?.[seat]?.length??0} / 8</p></div><Button variant="outline" size="sm" disabled={busy||usedKey('refresh')||!(game.equipment?.[seat]||[]).some((held:any)=>held.id==='extra-refresh')} onClick={()=>onAction('shop_refresh')}>额外刷新</Button></div><div className="v3-equipment-grid">{[1,2,3,4].map(level=><div className="v3-equipment-column" key={level}><span className="v3-equipment-tier" aria-label={`${level} 级装备`}>{romanNumerals[level-1]}</span><div>{offers.filter((offer:any)=>offer.level===level).map((offer:any)=>{const item=entry(offer),predecessor=item.family&&mine.some(held=>catalog.get(held.id)?.family===item.family&&held.level===item.level-1),price=String(BigInt(offer.price)/(predecessor?2n:1n)),unavailable=busy||offer.bought||coins<BigInt(price);return <button type="button" key={offer.offerId} className={`v3-equipment-tile${unavailable?' is-unavailable':''}${offer.bought?' is-bought':''}`} aria-label={`${item.name}，${level} 级，${price} 金币`} aria-disabled={unavailable} onClick={()=>{if(!unavailable)onAction('shop_buy',{offerId:offer.offerId});}} onContextMenu={event=>{event.preventDefault();setDetail({...item,level,price});}}><strong>{item.name}</strong><small>{price}{predecessor?' · 升级':''}</small></button>})}</div></div>)}</div><div className="v3-owned-equipment">{(game.equipment?.[seat]||[]).map((item:any)=>{const catalogItem=entry(item);return <Button key={item.instanceId} variant="ghost" disabled={busy} onClick={()=>onAction('shop_sell',{instanceId:item.instanceId})}>出售 {catalogItem.name} · 返还 {item.level===1?'0':String(BigInt(item.price)/2n)} 金币</Button>})}</div>{game.developerMode&&<div className="v3-dev-equipment" aria-label="开发者装备测试">{[...catalog.values()].filter(item=>equipmentAvailable(item.id)).map(item=><Button key={item.id} variant="outline" size="sm" disabled={busy||(game.equipment?.[seat]||[]).some((held:any)=>held.id===item.id)} onClick={()=>onAction('dev_equipment',{equipmentId:item.id})}>授予 {item.name}</Button>)}</div>}{canClear&&<div className="v3-owned-equipment" aria-label="清仓">{openOffers.map((offer:any)=><Button key={offer.offerId} variant="outline" size="sm" disabled={busy} onClick={()=>onAction('shop_clearance',{offerId:offer.offerId})}>清仓 · {entry(offer).name}</Button>)}</div>}{canConnect&&<div className="v3-owned-equipment" aria-label="人脉">{[...catalog.values()].filter(item=>item.level===4).map(item=><Button key={item.id} variant="outline" size="sm" disabled={busy} onClick={()=>onAction('shop_connections',{equipmentId:item.id})}>人脉 · {item.name}（6 金币）</Button>)}</div>}</section><Dialog open={!!detail} onOpenChange={open=>{if(!open)setDetail(null);}}>{detail&&<DialogContent className="v3-equipment-detail"><DialogHeader><DialogTitle>{detail.name}</DialogTitle><DialogDescription>{detail.effect||'当前测试装备不会改变对局规则。'}</DialogDescription></DialogHeader><p>等级 {romanNumerals[detail.level-1]} · 标价 {detail.price} 金币</p></DialogContent>}</Dialog></>;
});
function V3EquipmentActions({game,seat,busy,selected,onChange,onAction}:{game:any;seat:number;busy:boolean;selected:number[];onChange:(cards:number[])=>void;onAction:(action:string,extra?:any)=>void}){
 if(game.phase!=='equipment')return null;const pending=game.pendingEffect;
 if(pending?.seat!==seat)return <p className="muted">等待其他玩家处理装备效果</p>;
 const windowNames:Record<string,string>={opening:'开局装备',stake:'赌注装备',bet:'押注与买定离手',bomb:'炸弹系列',discard:'我全都要',thirteen:'13 恐惧症',aftershock:'余威',borrowed:'借光',transfer:'王の四带二',reveal:'站起来跟他打',target:'断你财路',lead:'领出前弃牌'};
 const mine:any[]=game.equipment?.[seat]||[];
 const ownsId=(id:string,key:string)=>mine.some((held:any)=>held.id===id)&&!(game.equipmentUsed||[]).includes(`${seat}:${key}`);
 const use=(effect:string,extra:any={})=>onAction('equipment_resolve',{cards:selected,effect,...extra});
 let buttons:any=null,caption='';
 if(pending?.kind==='opening'){
  const copyId=mine.find((held:any)=>held.id==='copy-3'||held.id==='copy-4')?.id;
  const precisionId=mine.find((held:any)=>held.id.startsWith('precision-copy-'))?.id;
  buttons=<>{copyId&&<Button disabled={busy||!selected.length} onClick={()=>onAction('equipment_opening',{cards:selected})}>使用{equipmentNames[copyId]??copyId}</Button>}{precisionId&&<Button disabled={busy} onClick={()=>onAction('equipment_opening',{cards:selected})}>使用{equipmentNames[precisionId]??precisionId}</Button>}<Button variant="secondary" disabled={busy} onClick={()=>onAction('equipment_opening_skip')}>跳过</Button><Button variant="ghost" disabled={busy||!selected.length} onClick={()=>onChange([])}>重选</Button></>;
  caption='搞三张自选 1 张；搞四张自选 1 或 2 张；点一张／点二张按选牌复制；复刻自动取最高可复刻点数。';
 }else if(pending?.kind==='stake'){
  buttons=<>{ownsId('raise-stake','raise-stake')&&<Button disabled={busy} onClick={()=>use('stake',{choice:'use'})}>加倍 · 赌注翻倍</Button>}{ownsId('all-in','all-in')&&<Button disabled={busy} onClick={()=>use('stake',{choice:'use'})}>孤注 · 押自己阵营</Button>}<Button variant="secondary" disabled={busy} onClick={()=>onAction('equipment_resolve',{cards:[],effect:'stake',choice:'skip'})}>不使用赌注装备</Button></>;
  caption='赌注装备每局全桌至多触发一件。';
 }else if(pending?.kind==='bet'){
  buttons=<>{ownsId('bet-is-set','bet-is-set')&&<Button disabled={busy} onClick={()=>use('bet',{choice:'hold'})}>买定离手 · 托管 2 金币</Button>}{ownsId('side-bet','side-bet')&&<><Button disabled={busy} onClick={()=>use('bet',{choice:'landlord'})}>押注 · 押地主方 1 金币</Button><Button disabled={busy} onClick={()=>use('bet',{choice:'farmers'})}>押注 · 押农民方 1 金币</Button></>}<Button variant="secondary" disabled={busy} onClick={()=>onAction('equipment_resolve',{cards:[],effect:'bet'})}>跳过押注</Button></>;
  caption='押注与买定离手每局只能选一件。';
 }else if(pending?.kind==='bomb'){
  const bomb=mine.find((held:any)=>held.id.startsWith('bomb-'))?.id||'bomb-1';
  buttons=<><Button disabled={busy||!selected.length} onClick={()=>use(bomb)}>使用{equipmentNames[bomb]??'炸弹装备'}弃牌</Button><Button variant="secondary" disabled={busy} onClick={()=>onAction('equipment_resolve',{cards:[],effect:bomb})}>跳过</Button><Button variant="ghost" disabled={busy||!selected.length} onClick={()=>onChange([])}>重选</Button></>;
  caption='炸弹后公开弃牌，可选 1 到装备允许的张数。';
 }else if(pending?.kind==='thirteen'){
  buttons=<><Button disabled={busy||!selected.length} onClick={()=>use('thirteen')}>13 恐惧症弃牌</Button><Button variant="secondary" disabled={busy} onClick={()=>onAction('equipment_resolve',{cards:[],effect:'thirteen'})}>跳过</Button><Button variant="ghost" disabled={busy||!selected.length} onClick={()=>onChange([])}>重选</Button></>;
  caption='A 计 1、2 计 2，所选牌点数和须为 13，王不可弃。';
 }else if(pending?.kind==='aftershock'){
  buttons=<><Button disabled={busy||!selected.length} onClick={()=>use('aftershock')}>余威弃牌</Button><Button variant="secondary" disabled={busy} onClick={()=>onAction('equipment_resolve',{cards:[],effect:'aftershock'})}>跳过</Button><Button variant="ghost" disabled={busy||!selected.length} onClick={()=>onChange([])}>重选</Button></>;
  caption='顺子或连对之后，公开弃掉至多 2 张手牌。';
 }else if(pending?.kind==='discard'){
  buttons=<><Button disabled={busy||!selected.length} onClick={()=>use('take-the-lot')}><span className="hide-small">我全都要</span>弃牌</Button><Button variant="secondary" disabled={busy} onClick={()=>onAction('equipment_resolve',{cards:[],effect:'take-the-lot'})}>跳过</Button><Button variant="ghost" disabled={busy||!selected.length} onClick={()=>onChange([])}>重选</Button></>;
  caption='三带二或四带二之后，可公开弃掉 1 张手牌，每局最多 3 次。';
 }else if(pending?.kind==='borrowed'){
  buttons=<><Button disabled={busy||!selected.length} onClick={()=>use('borrowed')}>借光弃牌</Button><Button variant="secondary" disabled={busy} onClick={()=>onAction('equipment_resolve',{cards:[],effect:'borrowed'})}>跳过</Button><Button variant="ghost" disabled={busy||!selected.length} onClick={()=>onChange([])}>重选</Button></>;
  caption='弃掉 1 张与上一次出牌点数相同的牌，每局最多 2 次。';
 }else if(pending?.kind==='transfer'){
  const wings=(game.last?.cards??[]).filter((card:number)=>rank(card)!==game.last?.combo.rank);
  buttons=<>{[0,1,2].filter(index=>index!==seat).map(index=><Button key={index} disabled={busy||wings.length!==2} onClick={()=>onAction('equipment_resolve',{cards:wings,target:index})}>四带二转移给 {game.seats?.[index]?.name}</Button>)}<Button variant="secondary" disabled={busy} onClick={()=>onAction('equipment_resolve',{cards:[],effect:'transfer'})}>跳过</Button></>;
  caption='将本次四带二的两张带牌转给所选对手。';
 }else if(pending?.kind==='lead'){
  const id=ownsId('return-lead','return-lead')?'return-lead':ownsId('follow-through','follow-through')?'follow-through':'';
  const label=id==='return-lead'?'三年之期已到弃牌':id==='follow-through'?'连打弃牌':'领出前弃牌';
  buttons=<><Button disabled={busy||!selected.length} onClick={()=>use('lead')}>{label}</Button><Button variant="secondary" disabled={busy} onClick={()=>onAction('equipment_resolve',{cards:[],effect:'lead'})}>跳过</Button><Button variant="ghost" disabled={busy||!selected.length} onClick={()=>onChange([])}>重选</Button></>;
  caption='重新领出前公开弃掉 1 张手牌，每局一次。';
 }else if(pending?.kind==='reveal'){
  buttons=<><Button disabled={busy||!selected.length} onClick={()=>use('reveal')}>站起来跟他打</Button><Button variant="secondary" disabled={busy} onClick={()=>onAction('equipment_resolve',{cards:[],effect:'reveal'})}>跳过</Button><Button variant="ghost" disabled={busy||!selected.length} onClick={()=>onChange([])}>重选</Button></>;
  caption='弃置 1 到 5 张实体手牌并保留至少 1 张，此后本局手牌对另外两人可见。';
 }else if(pending?.kind==='target'){
  buttons=<>{[0,1,2].filter(index=>index!==seat).map(index=><Button key={index} disabled={busy} onClick={()=>use('target',{target:index})}>断你财路 → {game.seats?.[index]?.name}</Button>)}<Button variant="secondary" disabled={busy} onClick={()=>onAction('equipment_resolve',{cards:[],effect:'target'})}>跳过</Button></>;
  caption='指定一名仍在局内的对手，本局他的装备金币奖励减半。';
 }else{
  buttons=<><Button disabled={busy} onClick={()=>onAction('equipment_resolve',{cards:selected})}>确认</Button><Button variant="secondary" disabled={busy} onClick={()=>onAction('equipment_resolve',{cards:[]})}>跳过</Button></>;
  caption='处理当前装备效果。';
 }
 return <div className="v3-equipment-actions"><p className="v3-equipment-heading">正在结算：<b>{windowNames[pending?.kind]??'装备效果'}</b></p><div className="action-bar">{buttons}</div><p className="hand-caption">{caption}</p></div>;
}
const EquipmentRack=memo(function EquipmentRack({game,items,compact=false}:{game:any;items:any[];compact?:boolean}){
 const [detail,setDetail]=useState<V3CatalogEntry|null>(null),catalog=new Map<string,V3CatalogEntry>((game.rules?.equipmentCatalog||[] as V3CatalogEntry[]).map((item:V3CatalogEntry)=>[item.id,item]));
 if(!items.length)return null;
 const entry=(item:any):V3CatalogEntry=>catalog.get(item.id)??{id:item.id,name:'测试装备',level:item.level,price:String(2**(item.level-1))};
 return <><div className={`v3-player-equipment${compact?' is-compact':''}`} aria-label="持有装备">{items.map((item,index)=>{const equipment=entry(item),name=equipment.name;return <button type="button" key={`${item.id}-${index}`} title={`${name}，右键查看详情`} aria-label={`${name}，${item.level} 级。查看详情`} onClick={()=>setDetail({...equipment,level:item.level})} onContextMenu={event=>{event.preventDefault();setDetail({...equipment,level:item.level});}}><b>{equipmentInitial(name)}</b><i>{romanNumerals[item.level-1]}</i></button>})}</div><Dialog open={!!detail} onOpenChange={open=>{if(!open)setDetail(null);}}>{detail&&<DialogContent className="v3-equipment-detail"><DialogHeader><DialogTitle>{detail.name}</DialogTitle><DialogDescription>{detail.effect||'当前测试装备不会改变对局规则。'}</DialogDescription></DialogHeader><p>等级 {romanNumerals[detail.level-1]} · 标价 {detail.price} 金币</p></DialogContent>}</Dialog></>;
});
const OpponentSeat=memo(function OpponentSeat({g,idx,off,botControls,bubble,timing}:{g:any;idx:number;off:number;botControls:any;bubble:any;timing:ReturnType<typeof createRoomTiming>}){
 const s=g.seats[idx],v3=g.kind==='landlord-v3';
 return <section className={`landlord-seat side-${off===2?'left':'right'}`} aria-label={`${s?.name||'空位'}的座位`}><div className={`opponent ${(g.phase==='doubling'?g.doubles?.[idx]===null:g.turn===idx&&['playing','bidding','equipment'].includes(g.phase))?'active-seat':''}`}>
  {s?<><PlayerChat bubble={bubble} align={off===2?'start':'end'}><Avatar name={s.name} index={off}/></PlayerChat><strong>{s.name}{s.bot&&<span className="bot-label">机器人</span>}</strong>{v3&&<EquipmentRack game={g} items={g.equipment?.[idx]||[]} compact/>}<span className={idx===g.landlord?'landlord-label':'seat-role'}>{idx===g.landlord?<><Crown size={13}/>地主</>:g.landlord<0?'牌友':'农民'}</span>{v3&&g.dealer===idx&&g.roundNumber>0&&<span className="dealer-label">庄家</span>}<span className="seat-score">{v3?`${g.coins?.[idx]??'0'} 金币 · ${g.victoryPoints?.[idx]??'0'} 点`:`${s.tableScore>=0?'+':''}${s.tableScore??0}`}</span><span className="card-count">{['playing','bidding','doubling','equipment'].includes(g.phase)?`剩余 ${s.count} 张`:s.ready?'已准备':'未准备'}</span>{s.bot&&<RemoveBotSeat id={s.id} name={s.name} controls={botControls}/>}</>:<EmptyBotSeat controls={botControls}/>}
 </div>{s&&g.phase==='finished'&&<PokerSeatHand hand={s.hand} name={s.name}/>} {s&&(g.phase!=='finished'||!s.hand.length)&&<SeatAction action={g.tableActions?.[idx]} active={(g.phase==='doubling'?g.doubles?.[idx]===null:g.turn===idx&&['playing','bidding','equipment'].includes(g.phase))} timing={timing} deadline={g.deadline} bidding={g.phase==='bidding'} doubling={g.phase==='doubling'} equipment={g.phase==='equipment'} name={s.name}/>}</section>;
});
function Rules({rules=DEFAULT_LANDLORD_RULES}:{rules?:LandlordRules|{id?:string}}){const v3=rules?.id==='landlord-v3';return <Dialog><DialogTrigger asChild><Button variant="ghost" aria-label="玩法规则"><Info size={17}/><span className="hide-small">玩法规则</span></Button></DialogTrigger><DialogContent className="rules-modal"><DialogHeader><DialogTitle>本桌规则</DialogTitle><DialogDescription>{v3?'三人扩展赛制 · 金币、胜利点与装备仅限本桌':'三人经典叫分 · 一副 54 张牌 · 无癞子'}</DialogDescription></DialogHeader><div className="rules-list">{v3?<><p><b>赛制</b>地主胜得 1 胜利点，农民胜各得 0.5 点；达到 4 点获整桌胜利。第 12 局无人达到时，最低分玩家各得 8 金币，进入三人突然死亡。</p><p><b>金币与商店</b>每人开局 2 金币。每个常规局先进入独立商店；装备按说明生效，最多持有 8 件，可在商店出售。第 13 局不刷新商店，也不发放金币。</p><p><b>竞价</b>叫地主托管金币；后续抢地主返还前一位托管并加 1 金币。最终地主胜则返还托管后收取农民付款，农民胜则瓜分托管。</p><p><b>突然死亡</b>第 13 局三人各 18 张、没有地主和底牌；任一玩家先出完即获得整桌胜利。</p></>:<><p><b>叫分</b>每人先拿 17 张。轮流叫 1、2、3 分或不叫；需高于当前分。叫 3 分或最高叫分后连续两人不叫时确定地主。无人叫分就重新发牌。</p><p><b>出牌</b>地主拿走并公开 3 张底牌，首先出牌。单张、对子、三张、三带一、三带二、顺子、连对、飞机、四带二、炸弹、王炸均可使用。顺子至少 5 张，连对至少 3 对；连续牌型不含 2 和王。</p><p><b>计分</b>任一农民出完即农民方获胜。每名农民单独结算：叫分 × 公共倍数 × 地主个人倍数 × 自己的个人倍数。地主收付两名农民金额之和。炸弹/王炸翻倍：{(rules as LandlordRules).bombDouble?'开启':'关闭'}；春天/反春天翻倍：{(rules as LandlordRules).springDouble?'开启':'关闭'}。仅娱乐积分。</p><p><b>加倍</b>{(rules as LandlordRules).allowDouble?'叫分结束后，每人有一次选择 ×2 的机会。地主加倍影响两笔收支；农民只影响自己与地主的一笔，双方均加倍则该笔 ×4。超时默认不加倍。':'本桌不启用个人加倍。'}</p></>}</div></DialogContent></Dialog>}
function Avatar({name,index=0}:{name:string;index?:number}){return <span className={`avatar avatar-${index%3}`}>{name.slice(0,1).toUpperCase()}</span>}
const tutorialPages=[
 {title:'目标：先把牌出完',points:['三人一桌：1 个地主、2 个农民。谁先出完手牌，那一方就赢这一局。','一桌最多 13 局：地主赢 +1 胜利点，农民各 +0.5；先到 4 点赢下整桌。','每局还会发金币，金币用来在局前商店买装备。']},
 {title:'出牌：压过上一手',points:['点牌选中（也可以按住鼠标拖着划选），再点「出牌」。','同牌型、张数相同、点数更大才算压过；炸弹和王炸随时能压。','压不过就点「不出」。另外两家都不出，你重新领出，这时候出什么牌型都行。','常用牌型：单张、对子、三张、三带一/二、顺子（≥5 张连续）、连对（≥3 对）、飞机、四带二、炸弹、王炸。']},
 {title:'一局怎么走',points:['商店：每人独立买装备（最多 8 件），买完点「完成购买」。','装备结算：开局装备、押注这类会弹窗口问你，按窗口里的按钮确认；超时会自动跳过。','竞价：叫地主会托管金币，抢地主每次 +1 金币；三家都不叫，金币最多的人当地主。','出牌 → 有人出完 → 结算：胜利点 + 金币 + 装备奖励。']},
 {title:'装备：买什么、怎么发动',points:['装备只在本桌有效、跨局保留；价格按等级 1 / 2 / 4 / 8 金币。','大多数装备自动发动，牌桌顶部会弹提示（例如「搞两张发动：复制了 9 K」）。','需要你决定的装备会开窗口，窗口上方写着正在结算哪一件；选好牌再按按钮确认。','第一次建议先买 1--2 件一级装备：看底牌、借光、找零都很稳。']}
];
function Tutorial({open,onOpenChange,hints,onHintsChange}:{open:boolean;onOpenChange:(open:boolean)=>void;hints:boolean;onHintsChange:(on:boolean)=>void}){
 const [page,setPage]=useState(0),last=tutorialPages.length-1;
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="v3-tutorial-modal"><DialogHeader><DialogTitle>新手教程 · {tutorialPages[page].title}</DialogTitle><DialogDescription>第 {page+1} / {tutorialPages.length} 页 · 看完就能开局</DialogDescription></DialogHeader><div className="v3-tutorial-pages"><ul>{tutorialPages[page].points.map(point=><li key={point}>{point}</li>)}</ul></div><label className="v3-tutorial-toggle"><Switch checked={hints} onCheckedChange={onHintsChange}/><span>显示对局中的情境提示</span></label><div className="action-bar">{page>0&&<Button variant="ghost" onClick={()=>setPage(page-1)}>上一页</Button>}{page<last?<Button onClick={()=>setPage(page+1)}>下一页</Button>:<Button onClick={()=>onOpenChange(false)}>开始游戏</Button>}<Button variant="secondary" onClick={()=>onOpenChange(false)}>跳过</Button></div></DialogContent></Dialog>;
}
export default function Home(){
 const {user,setUser,loaded,lobby,loadLobby}=useClub(),search=useSearchParams();
 const {openRoom,followRoom}=useRoomNavigation();

 const [room,setRoom]=useClubState<any>('landlord:room',null);
 const [code,setCode]=useClubState('landlord:code',''),[title,setTitle]=useClubState('landlord:title',''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useClubState<number[]>('landlord:selected',[]),[mode,setMode]=useClubState('landlord:mode','friends'),[createOpen,setCreateOpen]=useState(false),[leaveOpen,setLeaveOpen]=useState(false),[copied,setCopied]=useState(false);
 const [houseRules,setHouseRules]=useClubState('landlord:houseRules',{...DEFAULT_LANDLORD_RULES});
 const [variant,setVariant]=useClubState<'v2'|'v3'>('landlord:variant','v2');
 // 新手教程：第一次进 v3 房间自动弹一次，之后从工具栏随时可重看；情境提示可单独关掉。
 const [tutorialSeen,setTutorialSeen]=useClubState('landlord:v3TutorialSeen',false),[tutorialOpen,setTutorialOpen]=useState(false),[tutorialHints,setTutorialHints]=useClubState('landlord:v3TutorialHints',true);
 const closeTutorial=useCallback(()=>{setTutorialOpen(false);setTutorialSeen(true);},[setTutorialSeen]);
 const {bubbles,onSnapshot}=useChatBubbles(room?.code,user?.id);
 const [effectsConnected,setEffectsConnected]=useState(true);
 const requestPending=useRef(false);
 const roomRef=useRef<any>(null),userRef=useRef<Player|null>(null);roomRef.current=room;userRef.current=user;
 const timing=useMemo(()=>createRoomTiming(),[room?.code,user?.id]);
 const acceptRoom=useCallback((next:any)=>{timing.update(next.serverNow);setRoom((prev:any)=>newerRoom(prev,{...next,receivedAt:Date.now()}));},[setRoom,timing]);
 useEffect(()=>{if(room)timing.update(room.serverNow,room.receivedAt);},[timing]);
 const fail=useCallback((e:any)=>{setError(e.message||'连接失败，正在重试');if(e.status===401){setUser(null);setRoom(null)}else if(e.status===403){setRoom(null);void loadLobby(true).catch(()=>{})}},[setUser,setRoom,loadLobby]);
 useEffect(()=>{const requested=search.get('room');if(requested&&/^\d{6}$/.test(requested))setCode(requested);},[search,setCode]);
 useEffect(()=>{void loadLobby().catch(e=>setError(e.message));},[loadLobby]);

 const messages=useRoomMessages(room?.code??'',onSnapshot,{
  scope:user?.id,
  interval:()=>roomPollInterval(roomRef.current?.game.phase),
  load:async(after,signal,current)=>{
   const snapshot=roomRef.current;
   const d=await api('/api/game/sync?room='+snapshot.code+'&revision='+snapshot.revision+(after===null?'':'&after='+after),undefined,signal);
   if(current()){timing.update(d.serverNow);if(d.room)acceptRoom(d.room);}
   return d.chat;
  },
  onConnected:()=>{setEffectsConnected(true);setError('');},
  onError:error=>{setEffectsConnected(false);fail(error);},
 });
 const mutation=useRef<AbortController|null>(null);
 useEffect(()=>()=>mutation.current?.abort(),[room?.code,user?.id]);
 const combo=useMemo(()=>{const game=room?.game,index=game?.seats.findIndex((s:any)=>s.id===user?.id)??-1;return game?.kind==='landlord-v3'?selectionCombo(game,index,selected):classify(selected);},[room?.game,user?.id,selected]);
 const handKey=[room?.code,room?.game?.round,room?.game?.seats?.find((s:any)=>s.id===user?.id)?.hand?.join(',')].join(':');
 const [selectionHand,setSelectionHand]=useClubState('landlord:selectionHand','');
 useEffect(()=>{if(handKey!==selectionHand){setSelected([]);setSelectionHand(handKey)}},[handKey,selectionHand,setSelected,setSelectionHand]);
 async function act(action:string,extra:any={}){
  if(busy||requestPending.current)return;
  requestPending.current=true;setBusy(true);setError('');messages.pause();
  const r=roomRef.current,identity=userRef.current?.id,controller=new AbortController();mutation.current=controller;let recover=false;
  const current=()=>userRef.current?.id===identity&&(!r||roomRef.current?.code===r.code);
  try{
   const d=await api('/api/game',{action,code:r?.code||code,revision:r?.revision,...extra},AbortSignal.any([controller.signal,AbortSignal.timeout(12000)]));
   if(!current()||controller.signal.aborted)return;
   if(d.redirect)return await followRoom(d.redirect);
   if(d.left){setRoom(null);await loadLobby(true);}else acceptRoom(d);
   if(['create','join','end_table','end_practice'].includes(action)||d.game?.phase==='finished')void loadLobby(true).catch(fail);
   setCreateOpen(false);setLeaveOpen(false);return d;
  }catch(e:any){
   if(!current()||controller.signal.aborted)return;
   recover=e.status===409||!e.status;
   setError(e.status?e.message:'提交结果尚未确认，正在核对牌桌；请确认结果后再操作。');
   if(e.status===401||e.status===403)fail(e);
   throw e;
  }finally{
   if(mutation.current===controller)mutation.current=null;
   requestPending.current=false;setBusy(false);messages.resume(recover);
  }
 }
 const actionRef=useRef(act);actionRef.current=act;
 const doAct=useCallback((action:string,extra:any={})=>{void actionRef.current(action,extra).catch(()=>{})},[]);
 useEffect(()=>{const context=(document as any).modelContext;if(!context?.registerTool||!user?.id)return;const control=new AbortController();for(const tool of [{name:'read_my_game',description:'Read the current room and only the cards this signed-in player is allowed to see.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async()=>({room:roomRef.current,user:userRef.current})},{name:'join_friend_room',description:'Join an existing friend room using its six-digit code. This takes a player seat.',inputSchema:{type:'object',properties:{code:{type:'string',pattern:'^[0-9]{6}$'}},required:['code'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async(input:any)=>{if(typeof input?.code!=='string'||!/^\d{6}$/.test(input.code))throw Error('房间号必须为 6 位数字');const d=await actionRef.current('join',{code:input.code});return{code:d.code,phase:d.game.phase}}}]){try{Promise.resolve(context.registerTool(tool,{signal:control.signal})).catch(()=>{})}catch{}}return()=>control.abort()},[user?.id]);
 async function copy(){try{await navigator.clipboard.writeText(`${location.origin}/?room=${room.code}`);setCopied(true);setTimeout(()=>setCopied(false),2000)}catch{toast('房间号：'+room.code)}}
 async function resume(){if(!lobby?.activeRoom||!lobby.activeKind)return;setBusy(true);try{await openRoom(lobby.activeKind,lobby.activeRoom)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 if(!loaded)return <main className="mj-loading">正在打开游戏室…</main>;
 if(!user)return <><AuthScreen onAuth={setUser}/>{loaded&&error&&<div className="floating-error" role="alert">{error}<button onClick={()=>loadLobby(true).catch(()=>{})}>重试</button></div>}</>;
 const g=room?.game,v3=g?.kind==='landlord-v3',seat=g?.seats.findIndex((s:any)=>s.id===user.id)??-1,me=g?.seats[seat],myTurn=g&&g.turn===seat,legal=combo&&beats(combo,g?.last?.combo??null);
 const solo=soloPractice(g||{}),botControls=g?.phase==='waiting'&&g.host===user.id&&!solo?{busy,add:()=>doAct('add_bot'),remove:(botId:string)=>doAct('remove_bot',{botId})}:undefined;
 // 新手教程：v3 房间第一次进（开局前）自动弹出；关掉后记在本地，工具栏按钮随时可重看。
 const tutorialVisible=tutorialOpen||(!!room&&v3&&!tutorialSeen&&['waiting','shopping'].includes(g?.phase));
 // 情境提示：只教「现在该做什么」，规则细节仍放在玩法规则与新手教程里。
 const phaseHint=!v3?'':g.phase==='waiting'?'等人齐：把房间号发给朋友，或者直接开「人机测试」自己练一局。':g.phase==='shopping'?'先买 1--2 件一级装备（1 金币），买完点「完成购买」。':g.phase==='bidding'?'叫地主会托管金币，抢地主每次 +1 金币；牌好再叫。':g.phase==='equipment'?(g.pendingEffect?.seat===seat?'装备结算：选好牌再按上方按钮确认，或者点跳过。':'对手正在结算装备，你的手牌保持可见。'):g.phase==='playing'?(myTurn?(g.last?'要压过上一手（同牌型更大或用炸弹）；压不过就点「不出」。':'你领出：出什么牌型都可以。'):'等对手出牌，注意他还剩几张。'):g.phase==='finished'?(g.champion>=0?'整桌赛制已结束，可查看战报或离桌。':'点「准备下一局」继续；金币和装备会保留到整桌结束。'):'';
 return <TableEffectsProvider room={room} userId={user.id} connected={effectsConnected}><div className="app-shell"><Toaster theme="light" position="top-center"/><div className="club-game-tools">{room&&g&&<RoomFriends code={room.code} game={g}/>}<TableSound room={room} userId={user.id} timing={timing}/>{v3&&<EquipmentCatalog game={g} seat={seat}/>}{!room&&<Rules/>}{v3&&<Button variant="ghost" size="sm" aria-label="新手教程" onClick={()=>setTutorialOpen(true)}><BookOpen size={16}/><span className="hide-small">新手教程</span></Button>}</div>
 {error&&<div className="connection-error" role="alert">{error}<button aria-label="关闭提示" onClick={()=>setError('')}><X size={16}/></button></div>}
 {!room?<GameLobby game="landlord" code={code} onCode={setCode} onJoin={()=>void doAct('join')} busy={busy} actions={<>{lobby?.activeRoom?<Button className="start-table" disabled={busy} onClick={resume}>{lobby.activeKind==='mahjong'?'返回麻将桌':lobby.activeKind==='holdem'?'返回德州扑克桌':'返回房间'} {lobby.activeRoom}<ArrowRight size={18}/></Button>:<Dialog open={createOpen} onOpenChange={setCreateOpen}><div className="create-actions"><DialogTrigger asChild><Button className="start-table" disabled={lobby?.config?.maintenance} onClick={()=>setMode('friends')}><Plus size={19}/>开个房间</Button></DialogTrigger><Button variant="outline" className="practice-start" disabled={lobby?.config?.maintenance} onClick={()=>{setMode('practice');setCreateOpen(true)}}><Bot size={18}/>人机测试</Button></div><DialogContent><DialogHeader><DialogTitle>{mode==='practice'?'开一桌人机测试':'开一桌，等朋友'}</DialogTitle><DialogDescription>{mode==='practice'?'两位进阶陪练已准备好，你入座后即可开始。':'房间创建后，把邀请链接发给另外两位朋友。'}</DialogDescription></DialogHeader><form onSubmit={e=>{e.preventDefault();doAct('create',{title,mode,rules:variant==='v3'?DEFAULT_LANDLORD_V3_RULES:houseRules})}} className="stack-form"><RoomMode mode={mode} onChange={setMode} bots={2}/><fieldset className="house-switches"><legend>赛制</legend><label><span>经典 landlord-v2</span><Switch checked={variant==='v2'} onCheckedChange={checked=>checked&&setVariant('v2')}/></label><label><span>扩展 landlord-v3</span><Switch checked={variant==='v3'} onCheckedChange={checked=>checked&&setVariant('v3')}/></label></fieldset><label htmlFor="title">房间名称</label><Input id="title" maxLength={24} value={title} onChange={e=>setTitle(e.target.value)} placeholder={`${user.name} 的牌桌`}/>{variant==='v2'?<fieldset className="house-switches"><legend>本桌计分规则</legend>{([['allowDouble','叫分后允许个人加倍'],['bombDouble','炸弹与王炸翻倍'],['springDouble','春天与反春天翻倍']] as const).map(([key,label])=><label key={key}><span>{label}</span><Switch checked={houseRules[key]} onCheckedChange={value=>setHouseRules(r=>({...r,[key]:value}))}/></label>)}</fieldset>:<p className="muted">v3：2 金币开局，商店、竞价托管与 4 胜利点赛制均仅限本桌。</p>}<p className="muted">每步 {lobby?.config?.seconds||30} 秒</p><Button type="submit" disabled={busy}>{busy?'正在开桌…':'创建房间'}</Button></form></DialogContent></Dialog>}</>} art={<><Card card={44}/><Card card={49}/><Card card={53}/></>}/>:
 <main className="room-shell table-light"><div className="room-toolbar"><div><Button variant="ghost" size="icon" aria-label="返回大厅" onClick={()=>{setRoom(null);loadLobby(true).catch(fail)}}><ArrowLeft size={19}/></Button><div><h2>{room.title}</h2><span>房间 {room.code}<RoomCodeCopy code={room.code} compact/> · {solo?'人机测试':g.practice?'好友 + 人机':v3?'扩展赛制 v3':'经典叫分'}</span></div></div>{solo?<Button variant="outline" disabled={g.phase==='closed'} onClick={()=>setLeaveOpen(true)}><DoorOpen size={16}/>结束测试</Button>:<Button variant="outline" onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>}<span>{copied?'已复制':'邀请朋友'}</span></Button>}</div>
 <div className={`game-table landlord-board phase-${g.phase}`}>{v3&&<EquipmentFeed game={g} timing={timing}/>}<div className="table-hud"><span><Users size={15}/>{g.seats.length} / 3</span><div className="bottom-cards">{v3||['playing','finished'].includes(g.phase)?(g.bottom||[]).map((c:number,index:number)=>c<0?<div key={`b${index}`} className="card-back">♣</div>:<Card card={c} key={c} small/>):[0,1,2].map(i=><div key={i} className="card-back">♣</div>)}</div><span>{v3?`第 ${g.roundNumber||0} 局`:<>×{g.multiplier}</>}</span></div>
 <div className="landlord-opponents">{[2,1].map(off=>{const idx=(seat+off)%3;return <OpponentSeat key={off} g={g} idx={idx} off={off} botControls={botControls} bubble={bubbles[g.seats[idx]?.id]} timing={timing}/>;})}</div>
  <div className="table-stage">{g.phase==='waiting'?<><div className="table-stamp">♣</div><h2>{solo?'陪练已就位':g.seats.length<3?'等人齐，就开局':'三人已就位'}</h2><p>{solo?'点击准备，两位机器人陪你开始。':g.seats.length<3?'邀请朋友，或由房主在空位添加人机。':g.practice?'机器人已准备好，等每位朋友点击准备。':'三位玩家全部准备后，自动开始发牌。'}</p><RoomCodeDigits code={room.code}/></>:g.phase==='closed'?<><DoorOpen size={32}/><h2>这桌已结束</h2><p>房间已关闭，未完成的对局不计分。</p><Button onClick={()=>{setRoom(null);loadLobby(true).catch(fail)}}>返回大厅</Button></>:g.phase==='finished'?<div className="result-panel">{!v3&&<SpringEffect winner={g.winner} landlord={g.landlord} spring={g.spring}/>}<RoundSummary title={v3&&g.champion>=0?`${g.seats[g.champion].name} 获得整桌胜利`:g.winner===g.landlord?'地主获胜':'农民获胜'} delta={v3?`${g.victoryPoints[seat]} 点 · ${g.coins[seat]} 金币`:(g.deltas[seat]>=0?'+':'')+g.deltas[seat]}/></div>:g.phase==='shopping'?<span className="landlord-phase-note">商店阶段 · 每名玩家独立购买装备</span>:g.phase==='doubling'?<span className="landlord-phase-note">叫分已定 · 每位玩家选择是否加倍</span>:g.phase==='bidding'?<span className="landlord-phase-note">{v3?`竞价中 · 当前托管 ${g.stake} 金币`:`叫分中 · ${g.bid?`最高 ${g.bid} 分`:'等待叫地主'}`}</span>:<span className="landlord-phase-note">{!g.last?'自由出牌':''}</span>}</div>
 <div className="landlord-self-action">{(g.phase!=='finished'||!me.hand.length)&&<SeatAction action={g.tableActions?.[seat]} active={(g.phase==='doubling'?g.doubles?.[seat]===null:myTurn&&['playing','bidding','equipment'].includes(g.phase))} timing={timing} deadline={g.deadline} bidding={g.phase==='bidding'} doubling={g.phase==='doubling'} equipment={g.phase==='equipment'} name={user.name}/>}</div>
  <div className="self-area"><div className="self-label"><div><PlayerChat bubble={bubbles[user.id]} align="start"><Avatar name={user.name}/></PlayerChat><div className="self-identity"><strong>{user.name}</strong>{v3&&<EquipmentRack game={g} items={g.equipment?.[seat]||[]}/>}</div><span className="seat-score">{v3?`${g.coins?.[seat]??'0'} 金币 · ${g.victoryPoints?.[seat]??'0'} 胜利点`:`${me?.tableScore>=0?'+':''}${me?.tableScore??0}`}</span><span>{g.landlord===seat?'♛ 地主':g.landlord>=0?'农民':'你'}</span>{v3&&g.dealer===seat&&g.roundNumber>0&&<span className="dealer-label">庄家</span>}</div><RoomChat stream={messages} compact key={room.code} userId={user.id} code={room.code} onSnapshot={onSnapshot} closed={g.phase==='closed'}/></div>
 {v3&&tutorialHints&&phaseHint&&<p className="v3-tutorial-hint" role="note"><Info size={14}/>{phaseHint}</p>}
  {g.phase==='finished'&&<PokerSeatHand hand={me.hand} name={user.name}/>}<div className="action-bar">{v3?(['waiting','finished'].includes(g.phase)?<><Button variant="ghost" onClick={()=>setLeaveOpen(true)} disabled={busy}>{solo?'结束测试':'离开房间'}</Button>{g.champion<0&&<Button className="ready-button" onClick={()=>doAct('ready')} disabled={busy}>{me?.ready?'取消准备':g.phase==='finished'?'准备下一局':'准备好了'}<Check size={18}/></Button>}</>:g.phase==='shopping'?<Button disabled={busy||me?.last==='商店完成'} onClick={()=>doAct('shop_done')}>{me?.last==='商店完成'?'等待其他玩家':'完成购买'}</Button>:g.phase==='bidding'?<><Button variant="secondary" disabled={busy||!myTurn} onClick={()=>doAct('v3_bid',{call:false})}>不叫</Button><Button disabled={busy||!myTurn||BigInt(g.coins?.[seat]??'0')<=BigInt(g.stake??'0')} onClick={()=>doAct('v3_bid',{call:true})}>{g.landlord<0?'叫地主':'抢地主'} · {BigInt(g.stake??'0')+1n} 金币</Button>{(g.equipment?.[seat]||[]).some((held:any)=>held.id==='no-bid')&&<Button variant="outline" disabled={busy||(g.equipmentUsed||[]).includes(`${seat}:no-bid`)} onClick={()=>doAct('v3_no_bid')}>我不叫</Button>}{(g.equipment?.[seat]||[]).some((held:any)=>held.id==='peek-bottom')&&!(g.equipmentUsed||[]).includes(`${seat}:peek`)&&g.bottom?.length>0&&[0,1,2].map(index=><Button key={index} variant="ghost" disabled={busy} onClick={()=>doAct('v3_peek',{index})}>看底牌 {index+1}</Button>)}{!myTurn&&<p>等待竞价</p>}</>:g.phase==='playing'?<><Button variant="secondary" disabled={busy||!myTurn||!g.last} onClick={()=>doAct('pass')}>不出</Button><Button variant="outline" disabled={!myTurn||busy} onClick={()=>{const options=hints(me.hand,g.last?.combo??null);setSelected(options[0]||[]);}}>提示</Button><Button variant="ghost" disabled={!selected.length} onClick={()=>setSelected([])}>重选</Button><DeadlineButton timing={timing} deadline={g.deadline} className="play-button" disabled={busy||!effectsConnected||!myTurn||!legal} onClick={()=>doAct('play',{cards:selected})}>出牌{selected.length>0&&<small>{selected.length}</small>}</DeadlineButton></>:null):(['waiting','finished'].includes(g.phase)?<><Button variant="ghost" onClick={()=>setLeaveOpen(true)} disabled={busy}>{solo?'结束测试':'离开房间'}</Button><Button className="ready-button" onClick={()=>doAct('ready')} disabled={busy}>{me?.ready?'取消准备':g.phase==='finished'?'准备下一局':'准备好了'}{!me?.ready&&<Check size={18}/>}</Button></>:g.phase==='doubling'?g.doubles?.[seat]===null?<><Button variant="outline" disabled={busy} onClick={()=>doAct('double',{value:false})}>不加倍</Button><Button disabled={busy} onClick={()=>doAct('double',{value:true})}>加倍 ×2</Button></>:<p>已选择，等待其他玩家</p>:g.phase==='bidding'?myTurn?<>{[0,1,2,3].map(n=><Button key={n} disabled={busy||(n!==0&&n<=g.bid)} variant={n===0?'secondary':'default'} onClick={()=>doAct('bid',{value:n})}>{n?`${n} 分`:'不叫'}</Button>)}</>:<p>看看手牌，等你叫分</p>:g.phase==='playing'?<><Button variant="secondary" disabled={busy||!myTurn||!g.last} onClick={()=>doAct('pass')}>不出</Button><Button variant="outline" disabled={!myTurn||busy} onClick={()=>{const options=hints(me.hand,g.last?.combo??null);if(!options.length){toast('没有能压过的牌，可以选择不出');setSelected([])}else{const old=options.findIndex(cs=>cs.join(',')===[...selected].sort((a,b)=>rank(b)-rank(a)||a-b).join(','));setSelected(options[(old+1)%options.length]);}}}>提示</Button><Button variant="ghost" disabled={!selected.length} onClick={()=>setSelected([])}>重选</Button><DeadlineButton timing={timing} deadline={g.deadline} className="play-button" disabled={busy||!effectsConnected||!myTurn||!legal} onClick={()=>doAct('play',{cards:selected})}>出牌{selected.length>0&&<small>{selected.length}</small>}</DeadlineButton></>:null)}</div>
 {v3&&g.phase==='shopping'&&<V3Shop game={g} seat={seat} busy={busy} onAction={doAct}/>} {v3&&<V3EquipmentActions game={g} seat={seat} busy={busy} selected={selected} onChange={setSelected} onAction={doAct}/>}
 {['playing','bidding','doubling','equipment'].includes(g.phase)&&<><HandStrip hand={me?.hand||[]} selected={selected} onChange={setSelected} round={room.code+g.round}/><div className="hand-caption">{g.phase==='equipment'?(g.pendingEffect?.seat===seat?'选中手牌后，用上方装备按钮确认':'装备结算中，你的手牌保持可见'):selected.length?combo?`${combo.kind}${g.last&&!legal?' · 无法压过上一手':''}`:'所选手牌无法组成牌型':'点击或按住鼠标划选手牌，再点击出牌'}{selected.length>0&&<span>已选 {selected.length} 张</span>}</div></>}
 </div></div><div className="room-footnote"><Dialog><DialogTrigger asChild><TableDetailsTrigger/></DialogTrigger><DialogContent><DialogHeader><DialogTitle>牌桌详情</DialogTitle><DialogDescription>本局公开操作，不显示其他玩家的未出手牌。</DialogDescription></DialogHeader><Rules rules={g.rules??{...DEFAULT_LANDLORD_RULES,allowDouble:false}}/><div className="table-ledger">{g.seats.map((s:any,i:number)=><p key={s.id}><b>{s.name}</b><span>{v3?`${g.coins[i]} 金币 · ${g.victoryPoints[i]} 点`:`本桌 ${s.tableScore??0} · 账号 ${s.accountScore??0}${g.phase==='finished'?` · 本局 ${g.deltas[i]}`:''}`}</span></p>)}</div><div className="game-log">{g.log.length?g.log.map((l:any,i:number)=><p key={i}><span>{new Date(l.at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</span>{l.text}</p>):<p className="muted">准备开始后，操作会显示在这里。</p>}</div></DialogContent></Dialog></div></main>}
 <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{solo?'结束人机测试？':'要离开这一桌吗？'}</AlertDialogTitle><AlertDialogDescription>{solo?'本房间将关闭，已完成的测试记录保留。账号积分不受影响。':v3&&g.roundNumber>0?'扩展赛制固定三名玩家；离桌将结束整桌，所有玩家回到大厅。':'你可以凭房间号再次加入尚未开始的房间。'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>继续坐着</AlertDialogCancel><AlertDialogAction onClick={()=>doAct(solo?'end_practice':'leave')}>{solo?'结束测试':'离开房间'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  <Tutorial open={tutorialVisible} onOpenChange={open=>{if(open)setTutorialOpen(true);else closeTutorial();}} hints={tutorialHints} onHintsChange={setTutorialHints}/></div></TableEffectsProvider>
}
