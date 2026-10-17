import type {FriendlyMatch} from '../friendly-match.ts';
import {emitVisual,publicVisuals,type VisualEvent} from '../motion/events.ts';
import {newSeat, sortTiles, tileLabel, isWinning, type Seat, type Option, type Meld} from './engine.ts';
import {HAM, type ModernRules} from './rules.ts';
import {canWin, bestWinPlan, findWinPlan, effectiveType, isWild, type WinContext, type WinPlan} from './solver.ts';
import type {Practice} from '../practice/types.ts';

export type Money = string;
export type ChipEntry = {id:string;round:string;kind:'exposed'|'concealed'|'added'|'win'|'refund';actor:number;deltas:Money[];at:number;description:string};
export type RoundResult = {practice?:boolean;kind:'mahjong';schemaVersion:2;id:string;roundNumber:number;rules:ModernRules;initialChips:Money;baseChips:Money;
  winner:number;source:number;winType:'self'|'discard'|'rob'|'draw'|'aborted';wildcard:number;plan:WinPlan|null;awards:{tile:number;type:number;hit:boolean}[];
  seats:{id:string;name:string;bot?:boolean;delta:Money;balance:Money}[];entries:ChipEntry[];log:{text:string;at:number}[];started:number;ended:number;automatic:boolean};
type Pending={kind:'discard'|'added';from:number;tile:number;meldIndex?:number;eligible:number[];responses:Record<string,Option|null>;earth:boolean};
export type ModernGame = {friendlyMatch?:FriendlyMatch;
  visualEvents?:VisualEvent[];
  practice?:Practice;
  leavingIds?:string[];departedIds?:string[];
  kind:'mahjong';schemaVersion:2;rules:ModernRules;phase:'waiting'|'playing'|'choosing'|'revealing'|'finished'|'closed';host:string;
  seats:(Seat & {balance:Money})[];wall:number[];turn:number;dealer:number;round:string;roundNumber:number;seconds:number;deadline:number;
  drawn:number|null;lastDiscard:{seat:number;tile:number}|null;pending:Pending|null;winner:number;source:number;
  winType:RoundResult['winType']|null;deltas:Money[];log:{text:string;at:number}[];
  initialChips:Money;baseChips:Money;wildcard:number;roundStart:Money[];entries:ChipEntry[];result:RoundResult|null;
  choice:WinContext|null;flower:boolean;opening:boolean;discardCount:number;started:number;roundStarted:number;ended:number;
  reveal?:{plan:WinPlan;awards:RoundResult['awards'];automatic:boolean}|null;
  stats:{completed:number;draws:number;aborted:number};fixedIds:string[];streak:number;
};
export function positiveChips(v:unknown, fallback:string){if(typeof v==='number'&&!Number.isSafeInteger(v))throw Error('大额筹码请以完整整数文本提交');const s=v===undefined?fallback:String(v);if(!/^[1-9]\d{0,29}$/.test(s))throw Error('筹码请输入正整数，最多 30 位');return s;}
export function modernSeat(id:string,name:string,chips:Money){return {...newSeat(id,name),balance:chips};}
export function newModern(id:string,name:string,seconds=30,rules:ModernRules=HAM,initialChips='1000',baseChips='10'):ModernGame {
  initialChips=positiveChips(initialChips,'1000');baseChips=positiveChips(baseChips,'10');
  return {kind:'mahjong',schemaVersion:2,rules:{...rules},phase:'waiting',host:id,seats:[modernSeat(id,name,initialChips)],wall:[],turn:0,dealer:0,round:'',roundNumber:0,seconds,deadline:0,
    drawn:null,lastDiscard:null,pending:null,winner:-1,source:-1,winType:null,deltas:[],log:[],initialChips,baseChips,wildcard:-1,roundStart:[],entries:[],result:null,choice:null,
    flower:false,opening:true,discardCount:0,started:0,roundStarted:0,ended:0,stats:{completed:0,draws:0,aborted:0},fixedIds:[],streak:0};
}
function sortEffective(g:ModernGame,tiles:number[]){return [...tiles].sort((a,b)=>effectiveType(a,g.wildcard)-effectiveType(b,g.wildcard)||a-b);}
function rand(n:number){const max=Math.floor(0x100000000/n)*n;let v:number;do{v=crypto.getRandomValues(new Uint32Array(1))[0];}while(v>=max);return v%n;}
function note(g:ModernGame,text:string,now:number){g.log.push({text,at:now});g.log=g.log.slice(-400);}
function due(g:ModernGame,now:number){g.deadline=now+(g.phase==='revealing'?g.rules.revealSeconds!:g.phase==='choosing'?g.rules.chooseSeconds:g.pending?g.rules.claimSeconds:g.seconds)*1000;}
function countLabel(g:ModernGame,tile:number){const actual=tileLabel(tile),t=effectiveType(tile,g.wildcard);return isWild(tile,g.wildcard)?`${actual}（赖）`:t!==Math.floor(tile/4)?`${actual}（代 ${tileLabel(t*4)}）`:actual;}
export function dealModern(g:ModernGame,now=Date.now()){
  if(g.departedIds?.length)throw Error('有玩家已离桌，请由房主结束整桌后重新开桌');
  if(g.seats.length!==4 || !['waiting','finished'].includes(g.phase))throw Error('四人准备后才能开始');
  if(g.fixedIds.length && g.seats.some((s,i)=>s.id!==g.fixedIds[i]))throw Error('开局后不能更换本桌玩家');
  if(g.roundNumber){const stays=g.rules.dealerPolicy==='dealer-stays'&&(g.winType==='draw'||g.winner===g.dealer);if(stays)g.streak++;else{g.dealer=(g.dealer+1)%4;g.streak=0;}}
  else {g.fixedIds=g.seats.map(s=>s.id);g.started=now;g.dealer=0;}
  const deck=Array.from({length:136},(_,i)=>i);for(let i=135;i>0;i--){const j=rand(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
  g.wildcard=g.rules.wildcards?rand(33):-1;g.round=crypto.randomUUID();g.visualEvents=[];g.roundNumber++;g.roundStarted=now;g.turn=g.dealer;g.phase='playing';
  for(const s of g.seats){s.hand=sortEffective(g,deck.splice(0,13));s.melds=[];s.river=[];s.ready=false;s.last='';}
  g.wall=deck;g.drawn=g.wall.shift()!;g.seats[g.dealer].hand=sortEffective(g,[...g.seats[g.dealer].hand,g.drawn]);
  g.pending=null;g.choice=null;g.reveal=null;g.lastDiscard=null;g.winner=-1;g.source=-1;g.winType=null;g.deltas=['0','0','0','0'];g.entries=[];g.result=null;g.log=[];
  g.roundStart=g.seats.map(s=>s.balance);g.flower=false;g.opening=true;g.discardCount=0;
  note(g,`第 ${g.roundNumber} 局开始，${g.seats[g.dealer].name} 坐庄${g.streak?' · 连庄 '+g.streak+' 次':''}`,now);due(g,now);
}
function context(g:ModernGame,seat:number,tile?:number,p?:Pending):WinContext {
  return {round:g.round,hand:tile===undefined?[...g.seats[seat].hand]:[...g.seats[seat].hand,tile],melds:g.seats[seat].melds,wildcard:g.wildcard,incoming:tile??g.drawn!,
    winType:p?.kind==='added'?'rob':tile===undefined?'self':'discard',flower:tile===undefined&&g.flower,selfDrawUnit:g.rules.selfDrawUnit,noWildBonus:g.rules.noWildBonus,closedBonus:g.rules.closedBonus,fourWildWin:g.rules.fourWildWin,disabledWins:g.rules.disabledWins,
    doubleWildIncludesSelfDraw:g.rules.doubleWildIncludesSelfDraw,sevenPairsSuitedFourPlus:g.rules.sevenPairsSuitedFourPlus,
    heaven:tile===undefined&&g.opening&&g.discardCount===0&&seat===g.dealer,earth:!!p?.earth&&seat!==g.dealer};
}
function wins(g:ModernGame,seat:number,tile?:number,p?:Pending){return g.rules.wildcards?canWin(context(g,seat,tile,p)):isWinning(tile===undefined?g.seats[seat].hand:[...g.seats[seat].hand,tile],g.seats[seat].melds.length,false);}
function option(kind:Option['kind'],tiles:number[],meldIndex?:number):Option{return {kind,tiles:sortTiles(tiles),key:`${kind}:${sortTiles(tiles).join(',')}`,...(meldIndex===undefined?{}:{meldIndex})};}
function matching(g:ModernGame,seat:number,t:number){return g.seats[seat].hand.filter(tile=>!isWild(tile,g.wildcard)&&effectiveType(tile,g.wildcard)===t);}
function claimOptions(g:ModernGame,seat:number,p:Pending):Option[]{
  if(seat===p.from)return [];const out:Option[]=[];
  if((p.kind!=='added'||g.rules.allowRobAddedKong)&&wins(g,seat,p.tile,p))out.push(option('hu',[]));
  if(p.kind==='added'||isWild(p.tile,g.wildcard))return out;
  const t=effectiveType(p.tile,g.wildcard),same=matching(g,seat,t);
  if(same.length>=2)out.push(option('pong',same.slice(0,2)));
  if(same.length===3&&g.wall.length>g.rules.reserve)out.push(option('kong',same));
  if(g.rules.allowChi&&(p.from+1)%4===seat&&t<27){for(let first=Math.max(t-t%9,t-2);first<=t&&first%9<=6;first++){
    const tiles=[first,first+1,first+2].filter(v=>v!==t).map(v=>matching(g,seat,v)[0]);if(tiles.every(v=>v!==undefined))out.push(option('chi',tiles));
  }}return out;
}
export function legalDiscards(g:ModernGame,seat:number){return g.seats[seat].hand.filter(t=>!g.rules.forbidWildDiscard||!isWild(t,g.wildcard));}
export function modernOptions(g:ModernGame,seat:number){
  const out={canDiscard:false,discardable:[] as number[],canHu:false,fourWildHu:false,canPass:false,claims:[] as Option[],kongs:[] as Option[]};if(g.phase!=='playing'||seat<0)return out;
  if(g.pending){if(g.pending.eligible.includes(seat)&&!Object.hasOwn(g.pending.responses,String(seat))){out.canPass=true;out.claims=claimOptions(g,seat,g.pending);}return out;}
  if(g.turn!==seat)return out;out.canDiscard=true;out.discardable=legalDiscards(g,seat);out.canHu=g.drawn!==null&&wins(g,seat);
  out.fourWildHu=out.canHu&&!!g.rules.fourWildWin&&g.seats[seat].hand.filter(t=>isWild(t,g.wildcard)).length===4;
  if(g.drawn!==null&&g.wall.length>g.rules.reserve){
    for(let t=0;t<34;t++){const same=matching(g,seat,t);if(same.length===4)out.kongs.push(option('concealed',same));}
    g.seats[seat].melds.forEach((m,i)=>{if(m.kind==='pong'){const t=matching(g,seat,effectiveType(m.tiles[0],g.wildcard))[0];if(t!==undefined)out.kongs.push(option('added',[t],i));}});
  }return out;
}
function take(g:ModernGame,seat:number,tiles:number[]){const s=g.seats[seat];if(new Set(tiles).size!==tiles.length||tiles.some(t=>!s.hand.includes(t)))throw Error('只能使用自己的手牌');s.hand=s.hand.filter(t=>!tiles.includes(t));}
function entry(g:ModernGame,kind:ChipEntry['kind'],actor:number,deltas:Money[],description:string,now:number){
  if(deltas.reduce((n,v)=>n+BigInt(v),0n)!==0n)throw Error('筹码结算不平衡');
  const e={id:crypto.randomUUID(),round:g.round,kind,actor,deltas,description,at:now};g.entries.push(e);
  g.seats.forEach((s,i)=>s.balance=(BigInt(s.balance)+BigInt(deltas[i])).toString());
  g.deltas=g.seats.map((s,i)=>(BigInt(s.balance)-BigInt(g.roundStart[i])).toString());note(g,description,now);
}
function chargeKong(g:ModernGame,seat:number,kind:'exposed'|'concealed'|'added',now:number){
  emitVisual(g,seat,'kong',now,kind);
  if(!g.rules.kongPayments)return;const units=kind==='concealed'?2n:1n,amount=BigInt(g.baseChips)*units;
  entry(g,kind,seat,g.seats.map((_,i)=>(i===seat?amount*3n:-amount).toString()),`${g.seats[seat].name} ${kind==='concealed'?'暗杠':kind==='added'?'补杠':'明杠'}，三家各付 ${amount} 筹码`,now);
}
function finish(g:ModernGame,type:RoundResult['winType'],now:number,plan:WinPlan|null=null,awards:RoundResult['awards']=[],automatic=false){
  g.phase='finished';g.winType=type;g.pending=null;g.choice=null;g.reveal=null;g.deadline=0;g.seats.forEach(s=>s.ready=false);
  g.deltas=g.seats.map((s,i)=>(BigInt(s.balance)-BigInt(g.roundStart[i])).toString());
  if(type==='draw'){g.winner=-1;g.source=-1;g.stats.draws++;note(g,g.rules.reserve?'牌墙已到保留 12 张，本局流局，已成功杠分保留':'牌墙已摸完，本局流局',now);}
  if(type==='aborted'){g.winner=-1;g.source=-1;g.stats.aborted++;note(g,'本局已中止，本局杠分已撤销',now);}else g.stats.completed++;
  g.result={...(g.practice?{practice:true}:{}),kind:'mahjong',schemaVersion:2,id:g.round,roundNumber:g.roundNumber,rules:{...g.rules},initialChips:g.initialChips,baseChips:g.baseChips,winner:g.winner,source:g.source,winType:type,wildcard:g.wildcard,
    plan,awards,seats:g.seats.map((s,i)=>({id:s.id,name:s.name,bot:!!s.bot,delta:g.deltas[i],balance:s.balance})),entries:structuredClone(g.entries),log:[...g.log],started:g.roundStarted,ended:now,automatic};
}
function settle(g:ModernGame,now:number,plan:WinPlan|null,automatic=false,revealed?:RoundResult['awards']){
  const type=g.winType as 'self'|'discard'|'rob', awards:RoundResult['awards']=revealed??[];
  if(g.rules.wildcards&&!revealed){if(!plan||g.wall.length<2)throw Error('胡牌方案或奖牌状态无效');for(let i=0;i<2;i++){const tile=g.wall.pop()!,t=effectiveType(tile,g.wildcard);awards.push({tile,type:t,hit:plan.hitTypes.includes(t)});}}
  const n=awards.filter(a=>a.hit).length,amount=BigInt(g.baseChips)*BigInt(1+n)*BigInt(plan?.multiplier??'1');
  const deltas=g.seats.map((_,i)=>i===g.winner?(type==='self'?3n:1n)*amount:(type==='self'||i===g.source)?-amount:0n).map(String);
  entry(g,'win',g.winner,deltas,`${g.seats[g.winner].name} ${type==='self'?'自摸':type==='rob'?'抢杠胡':'胡牌'} · ${g.baseChips} × ${1+n} × ${plan?.multiplier??'1'} = 每位付款者 ${amount} 筹码${automatic?'（超时确认方案）':''}`,now);
  finish(g,type,now,plan,awards,automatic);
}
function beginWin(g:ModernGame,winner:number,source:number,ctx:WinContext,now:number){
  emitVisual(g,winner,'hu',now,ctx.winType);
  g.winner=winner;g.source=source;g.winType=ctx.winType;g.pending=null;g.lastDiscard=null;
  if(g.rules.wildcards){g.choice=structuredClone(ctx);g.phase='choosing';due(g,now);note(g,`${g.seats[winner].name} 胡牌，正在选择赖子方案`,now);}
  else settle(g,now,null);
}
export function confirmWin(g:ModernGame,seat:number,candidateId:string,now=Date.now(),automatic=false){
  if(g.phase!=='choosing'||!g.choice||seat!==g.winner)throw Error('当前不能确认胡牌方案');
  const plan=findWinPlan(g.choice,candidateId);if(!plan)throw Error('这个方案不属于本次胡牌');
  if(g.rules.revealSeconds){if(g.wall.length<2)throw Error('剩余奖牌不足');g.reveal={plan:structuredClone(plan),awards:[],automatic};g.choice=null;g.phase='revealing';due(g,now);note(g,`${g.seats[seat].name} 已锁定胡牌方案，等待逐张翻开奖牌`,now);}
  else settle(g,now,structuredClone(plan),automatic);
}
export function flipAward(g:ModernGame,seat:number,index:number,now=Date.now(),automatic=false){
  const r=g.reveal;if(g.phase!=='revealing'||!r||seat!==g.winner)throw Error('只有胡牌玩家可以翻开奖牌');
  if(index!==r.awards.length||index<0||index>1)throw Error('请按顺序翻开下一张奖牌');
  if(!g.wall.length)throw Error('剩余奖牌不足');const tile=g.wall.pop()!,type=effectiveType(tile,g.wildcard),hit=r.plan.hitTypes.includes(type);
  r.awards.push({tile,type,hit});note(g,`${automatic?'超时自动翻开':g.seats[seat].name+' 翻开'}第 ${index+1} 张奖牌：${countLabel(g,tile)} · ${hit?'命中 +1':'未命中'}`,now);
  if(r.awards.length===2)settle(g,now,r.plan,r.automatic,[...r.awards]);else due(g,now);
}
function draw(g:ModernGame,seat:number,replacement:boolean,now:number){
  g.pending=null;if(g.wall.length<=g.rules.reserve){finish(g,'draw',now);return;}
  const tile=replacement?g.wall.pop()!:g.wall.shift()!;g.turn=seat;g.drawn=tile;g.seats[seat].hand=sortEffective(g,[...g.seats[seat].hand,tile]);
  g.flower=replacement;g.seats[seat].last=replacement?'杠后补牌':'摸牌';note(g,`${g.seats[seat].name} ${g.seats[seat].last}`,now);due(g,now);
}
function startPending(g:ModernGame,p:Pending,now:number){g.pending=p;g.drawn=null;g.flower=false;p.eligible=g.seats.map((_,i)=>i).filter(i=>claimOptions(g,i,p).length>0);due(g,now);resolve(g,now);}
const priority=(o:Option)=>o.kind==='hu'?3:o.kind==='chi'?1:2;
function resolve(g:ModernGame,now:number){
  const p=g.pending!,distance=(seat:number)=>(seat-p.from+4)%4;
  const claims=p.eligible.flatMap(seat=>p.responses[seat]?[{seat,choice:p.responses[seat]!}]:[]).sort((a,b)=>priority(b.choice)-priority(a.choice)||distance(a.seat)-distance(b.seat));
  const chosen=claims[0];
  for(const seat of p.eligible.filter(i=>!Object.hasOwn(p.responses,String(i)))){
    if(!chosen)return;
    if(claimOptions(g,seat,p).some(o=>priority(o)>priority(chosen.choice)||(priority(o)===priority(chosen.choice)&&distance(seat)<distance(chosen.seat))))return;
  }
  if(chosen?.choice.kind==='hu'){
    const ctx=context(g,chosen.seat,p.tile,p);
    if(p.kind==='discard'){const river=g.seats[p.from].river;river.splice(river.lastIndexOf(p.tile),1);}else take(g,p.from,[p.tile]);
    g.seats[chosen.seat].hand=sortEffective(g,[...g.seats[chosen.seat].hand,p.tile]);beginWin(g,chosen.seat,p.from,ctx,now);return;
  }
  if(p.kind==='added'){
    take(g,p.from,[p.tile]);const m=g.seats[p.from].melds[p.meldIndex!];m.kind='kong';m.tiles=sortEffective(g,[...m.tiles,p.tile]);
    chargeKong(g,p.from,'added',now);draw(g,p.from,true,now);return;
  }
  if(!chosen){draw(g,(p.from+1)%4,false,now);return;}
  const {seat,choice}=chosen;take(g,seat,choice.tiles);const river=g.seats[p.from].river;river.splice(river.lastIndexOf(p.tile),1);
  g.seats[seat].melds.push({kind:choice.kind as Meld['kind'],tiles:sortEffective(g,[...choice.tiles,p.tile]),from:p.from,concealed:false});
  if(choice.kind!=='kong')emitVisual(g,seat,choice.kind as 'chi'|'pong',now);
  g.opening=false;g.seats[seat].last=choice.kind==='chi'?'吃':choice.kind==='pong'?'碰':'杠';note(g,`${g.seats[seat].name} ${g.seats[seat].last} ${countLabel(g,p.tile)}`,now);
  g.turn=seat;g.pending=null;g.drawn=null;g.lastDiscard=null;
  if(choice.kind==='kong'){chargeKong(g,seat,'exposed',now);draw(g,seat,true,now);}else due(g,now);
}
export type ModernMove={action:string;tile?:number;key?:string;candidateId?:string;awardIndex?:number};
export function moveModern(g:ModernGame,seat:number,m:ModernMove,now=Date.now()){
  if(seat<0||seat>=g.seats.length)throw Error('你不在这个房间');
  if(g.phase==='revealing'){if(m.action!=='flip_award'||!Number.isInteger(m.awardIndex))throw Error('等待胡牌玩家翻开奖牌');flipAward(g,seat,m.awardIndex!,now);return;}
  if(g.phase==='choosing'){if(m.action!=='confirm_win'||typeof m.candidateId!=='string')throw Error('等待胡牌者确认方案');confirmWin(g,seat,m.candidateId,now);return;}
  if(g.phase!=='playing')throw Error('当前不能操作');const opts=modernOptions(g,seat);
  if(g.pending){
    if(!opts.canPass)throw Error('当前无需你响应，或你已作出选择');if(m.action!=='claim'&&m.action!=='pass')throw Error('请选择吃碰杠胡或跳过');
    const choice=m.action==='pass'?null:opts.claims.find(o=>o.key===m.key);if(choice===undefined)throw Error('这个操作不符合当前牌型');
    g.pending.responses[seat]=choice;resolve(g,now);return;
  }
  if(!opts.canDiscard)throw Error('还没轮到你');
  if(m.action==='hu'){if(!opts.canHu)throw Error('还未组成可胡的牌型');beginWin(g,seat,seat,context(g,seat),now);return;}
  if(m.action==='kong'){
    const k=opts.kongs.find(o=>o.key===m.key);if(!k)throw Error('这些牌不能开杠');g.opening=false;g.flower=false;
    if(k.kind==='concealed'){take(g,seat,k.tiles);g.seats[seat].melds.push({kind:'kong',tiles:k.tiles,from:seat,concealed:true});chargeKong(g,seat,'concealed',now);draw(g,seat,true,now);}
    else startPending(g,{kind:'added',from:seat,tile:k.tiles[0],meldIndex:k.meldIndex,eligible:[],responses:{},earth:false},now);
    return;
  }
  if(m.action!=='discard'||!Number.isInteger(m.tile)||!g.seats[seat].hand.includes(m.tile!))throw Error('请选择自己的一张手牌');
  if(!opts.discardable.includes(m.tile!))throw Error('本桌赖子不能打出，请选择其他手牌');
  const tile=m.tile!;take(g,seat,[tile]);emitVisual(g,seat,'discard',now);g.seats[seat].river.push(tile);g.seats[seat].last=`打 ${countLabel(g,tile)}`;g.lastDiscard={seat,tile};
  const earth=g.opening&&g.discardCount===0&&seat===g.dealer;g.discardCount++;g.opening=false;
  note(g,`${g.seats[seat].name} 打出 ${countLabel(g,tile)}`,now);startPending(g,{kind:'discard',from:seat,tile,eligible:[],responses:{},earth},now);
}
export function timeoutModern(g:ModernGame,now=Date.now()){
  if(!['playing','choosing','revealing'].includes(g.phase)||g.deadline>now)return false;
  if(g.phase==='revealing')flipAward(g,g.winner,g.reveal!.awards.length,now,true);
  else if(g.phase==='choosing'){const plan=bestWinPlan(g.choice!);if(!plan)throw Error('胡牌方案缺失');confirmWin(g,g.winner,plan.id,now,true);}
  else if(g.pending){for(const seat of g.pending.eligible)if(!Object.hasOwn(g.pending.responses,String(seat)))g.pending.responses[seat]=null;resolve(g,now);}
  else {const allowed=legalDiscards(g,g.turn);moveModern(g,g.turn,{action:'discard',tile:g.drawn!==null&&allowed.includes(g.drawn)?g.drawn:allowed.at(-1)!},now);}
  return true;
}
export function closeModern(g:ModernGame,force=false,now=Date.now(),reason:'admin'|'practice'|'empty'='admin'){
  if(g.phase==='closed')return;
  if(['playing','choosing','revealing'].includes(g.phase)){
    if(!force)throw Error('请在本局结束后再结束整桌');
    const refunds=g.seats.map((s,i)=>(BigInt(g.roundStart[i])-BigInt(s.balance)).toString());
    if(refunds.some(v=>v!=='0'))entry(g,'refund',-1,refunds,'撤销中止局的全部杠分',now);
    if(g.reveal)g.wall.push(...g.reveal.awards.map(a=>a.tile).reverse());
    finish(g,'aborted',now);
  }
  g.phase='closed';g.deadline=0;g.pending=null;g.choice=null;g.ended=now;note(g,reason==='empty'?'全部玩家已离桌，房间自动关闭':reason==='practice'?'房主结束人机测试':force?'管理员结束整桌':'房主结束整桌',now);
}
export function modernView(g:ModernGame,id:string){
  const own=g.seats.findIndex(s=>s.id===id),reveal=g.phase==='finished'||g.phase==='closed'&&g.friendlyMatch?.status==='finished',leaving=!!g.leavingIds?.includes(id),departed=!!g.departedIds?.includes(id);
  return {friendlyMatch:g.friendlyMatch,visualEvents:publicVisuals(g),practice:g.practice?{difficulty:g.practice.difficulty,roomType:g.practice.roomType}:null,kind:g.kind,schemaVersion:2 as const,rules:g.rules,phase:g.phase,host:g.host,turn:g.turn,dealer:g.dealer,round:g.round,roundNumber:g.roundNumber,seconds:g.seconds,deadline:g.deadline,
    remaining:g.wall.length,drawn:own===g.turn?g.drawn:null,lastDiscard:g.lastDiscard,pending:g.pending?{kind:g.pending.kind,from:g.pending.from,tile:g.pending.tile}:null,
    winner:g.winner,source:g.source,winType:g.winType,deltas:g.deltas,log:g.log,options:modernOptions(g,leaving||departed?-1:own),wildcard:g.wildcard,result:g.result,
    session:{initialChips:g.initialChips,baseChips:g.baseChips,started:g.started,ended:g.ended,stats:g.stats,streak:g.streak,fixed:g.fixedIds.length>0},
    entries:g.entries,canChoose:!leaving&&!departed&&g.phase==='choosing'&&own===g.winner,
    awardReveal:g.phase==='revealing'&&g.reveal?{plan:g.reveal.plan,awards:g.reveal.awards,canFlip:!leaving&&!departed&&own===g.winner}:null,
    seats:g.seats.map((s,i)=>({id:s.id,name:s.name,bot:!!s.bot,leaving:!!g.leavingIds?.includes(s.id),departed:!!g.departedIds?.includes(s.id),ready:s.ready,last:s.last,count:s.hand.length,river:s.river,balance:s.balance,
      hand:i===own||reveal?s.hand:[],melds:s.melds.map(m=>({...m,tiles:m.concealed&&i!==own&&!reveal?[]:m.tiles}))})),
  };
}
