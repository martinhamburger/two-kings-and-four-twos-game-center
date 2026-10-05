import type {Practice} from '../practice/types.ts';
import {beats,classify,face,hints,isVirtualCard,rank,sorted,virtualCard,type Combo,type Seat,type TableAction} from './engine.ts';
import {DDZ_EFFECTS,emitVisual,publicVisuals,type VisualEvent} from '../motion/events.ts';

export type V3Equipment={instanceId:string;id:string;level:1|2|3|4;price:string;nonSellable?:boolean};
export type V3Offer={offerId:string;id:string;level:1|2|3|4;price:string;bought:boolean};
export type V3Shop={offers:V3Offer[]};
export type V3Family='copy'|'precision'|'bomb'|'less';
export type V3CatalogEntry={id:string;level:1|2|3|4;price:string;name:string;effect:string;family?:V3Family;tableOnce?:boolean;stake?:boolean;map?:number;exclusive?:string[]};
export type LandlordV3Rules={id:'landlord-v3';equipmentCatalog:V3CatalogEntry[];catalogVersion:number;noCallPolicy?:'dealer-free'};
export type V3Loss={id:string;level:number};
export type V3Effect=
 |{seat:number;kind:'opening'}
 |{seat:number;kind:'stake'}
 |{seat:number;kind:'bet'}
 |{seat:number;kind:'bomb';max:number}
 |{seat:number;kind:'discard';max:number}
 |{seat:number;kind:'thirteen';max:number}
 |{seat:number;kind:'aftershock';max:number}
 |{seat:number;kind:'borrowed'}
 |{seat:number;kind:'transfer'}
 |{seat:number;kind:'reveal';max:number}
 |{seat:number;kind:'target'}
 |{seat:number;kind:'lead'};
export type V3Action={cards?:unknown;mapping?:unknown;target?:unknown;choice?:unknown;offerId?:unknown;instanceId?:unknown;equipmentId?:unknown;side?:unknown;index?:unknown;effect?:unknown};
export type V3Game={
 kind:'landlord-v3';rules:LandlordV3Rules;visualEvents?:VisualEvent[];practice?:Practice;
 phase:'waiting'|'shopping'|'bidding'|'playing'|'equipment'|'finished'|'closed';seats:Seat[];host:string;bottom:number[];turn:number;landlord:number;dealer:number;
 bid:string;stake:string;initialPasses:number;bidPasses:number;passes:number;last:{seat:number;cards:number[];combo:Combo}|null;tableActions:(TableAction|null)[];
 deadline:number;seconds:number;round:string;roundNumber:number;suddenDeath:boolean;winner:number;champion:number;victoryPoints:string[];coins:string[];equipment:V3Equipment[][];shops:V3Shop[];
 firstFinisher:number;deltas:number[];log:{text:string;at:number;kind?:'equipment';id?:string}[];roundHistory:{round:number;suddenDeath:boolean;winner:number;landlord:number;victoryPoints:string[];coins:string[]}[];
 equipmentUsed:string[];virtualSerial:number;rocketUsed:boolean;pendingEffect?:V3Effect;developerMode?:boolean;
 effectResumeTurn?:number;privatePeeks?:Record<string,number[]>;pending?:V3Effect[];tableUsed?:string[];revealed?:{card:number;from:number}[];peeked?:number[];peekedSeat?:number;betUsedRound?:number;betIsSet?:{seat:number};mapUsed?:string[];passStreak?:boolean[];
 stakeUsedRound?:number;lossStreak?:string[];allIn?:{seat:number;amount:string};sideBet?:{seat:number;side:'landlord'|'farmers'};cutIncome?:{seat:number;source:number};maxPlayed?:number[];
};
export const V3_CATALOG_VERSION=2;
/** Frozen IDs remain documented, but unfinished effects must never be sold. */
export const V3_UNAVAILABLE_EQUIPMENT=['quit-early','last-stand'] as const;
export const equipmentAvailable=(id:string)=>!V3_UNAVAILABLE_EQUIPMENT.some(pending=>pending===id);
const item=(id:string,level:1|2|3|4,name:string,effect:string,extra:Partial<V3CatalogEntry>={}):V3CatalogEntry=>({id,level,price:String(2**(level-1)),name,effect,...extra});
export const V3_EQUIPMENT_CATALOG:V3CatalogEntry[]=[
 item('peek-bottom',1,'看底牌','竞价开始前，可私下查看 1 张底牌。'),
 item('borrowed-light',1,'借光','别人出牌后，可弃掉自己 1 张同点数的牌；每局 2 次。'),
 item('piggy-bank',1,'存钱罐','只在前 6 局可买；第 7 局开始得 5 金币并移除。',{tableOnce:true}),
 item('endgame-change',1,'残局','每局结算后，手牌 0--5 张时得 1 金币。'),
 item('copy-1',1,'搞一张','发牌后随机复制 1 张手牌。',{family:'copy'}),
 item('bomb-1',1,'小炸弹','每局首次打出炸弹后，可弃 1 张手牌。',{family:'bomb'}),
 item('extra-refresh',1,'额外刷新','每局商店可额外刷新 1 次候选。'),
 item('change',1,'找零','每局首次买一级装备，返还 1 金币。'),
 item('dealer-change',1,'庄家零钱','自己是庄家且首次不叫地主，得 1 金币。'),
 item('no-bid',1,'我不叫','声明后本局自动不叫；别人当地主时得 1 金币。'),
 item('no-chase',1,'穷寇莫追','每局结算后，没赢且手牌 1--5 张时得 1 金币。'),
 item('precision-copy-1',2,'点一张','开局自选 1 张非王牌，复制 1 张同点数的牌。',{family:'precision',exclusive:['copy']}),
 item('return-lead',2,'三年之期已到','连续两墩都没出后重新领出前，可弃 1 张手牌。'),
 item('side-bet',2,'押注','竞价前托管 1 金币押一方胜；猜中每人付你 1 金币。',{stake:true}),
 item('copy-2',2,'搞两张','发牌后随机复制 2 张不同手牌。',{family:'copy'}),
 item('bomb-2',2,'中炸弹','每局首次打出炸弹后，可弃至多 2 张手牌。',{family:'bomb'}),
 item('take-the-lot',2,'我全都要','打出三带二或四带二后，可弃 1 张手牌；每局 3 次。'),
 item('solo-diet',2,'独食','每局结算后，本局每手都不超过 3 张时得 3 金币。'),
 item('richest',2,'首富','每局结算后，金币并列或最高时得 1 金币。'),
 item('interest',2,'计息','每局结算后，按金币的四分之一得 1--2 金币。'),
 item('appearance-fee',2,'出场费','第 3、6、9 局发牌后得 2 金币；每桌 3 次。'),
 item('bet-is-set',2,'买定离手','竞价前托管 2 金币；自己这方赢了返还并再得 2 金币。',{stake:true}),
 item('shadow-rank',3,'影子牌','出牌时自动把至多 2 张牌换成相邻点数，凑成能压过的牌型。',{map:2}),
 item('four-with-two-pass',3,'王の四带二','打出四带二时，可把两张带牌转给一名对手；每局 1 次。'),
 item('aftershock',3,'余威','打出顺子或连对后，可弃至多 2 张手牌。'),
 item('follow-through',3,'连打','两墩都没出后重新领出前，可弃 1 张单牌。'),
 item('copy-3',3,'搞三张','发牌后自选 1 张、随机 2 张，共复制 3 张。',{family:'copy'}),
 item('bomb-3',3,'大炸弹','每局首次打出炸弹后，可弃至多 3 张手牌。',{family:'bomb'}),
 item('smith',3,'史密斯夫妇','出牌时自动把 J 和 Q 互换，凑成更强的牌型。'),
 item('thirteen',3,'13 恐惧症','手牌正好剩 13 张时，可弃掉点数和为 13 的手牌。'),
 item('precision-copy-2',3,'点二张','开局自选 2 张不同的非王牌，各复制 1 张。',{family:'precision',exclusive:['copy']}),
 item('raise-stake',3,'加倍','作为地主首次出牌前，把赌注翻倍。',{stake:true}),
 item('all-in',3,'孤注','首次出牌前托管一半金币，押自己这方获胜。',{stake:true}),
 item('lucky-star',3,'福星','连输 3 局后下次获胜，额外得 3--5 金币并移除本装备。'),
 item('stand-up-fight',3,'站起来跟他打','地主确定后弃 1--5 张，此后手牌对另外两人可见。'),
 item('quit-early',3,'溜了溜了','手牌 1--5 张时退出本局，立即得 4 金币。'),
 item('last-stand',3,'殊死一搏','金币最低时花光金币，随机获得 1 件四级装备。'),
 item('cut-off-income',3,'断你财路','自己回合开始时指定 1 名对手，本局他的装备金币减半。'),
 item('clearance',4,'清仓','商店阶段免费买 1 件候选；每桌 1 次。',{tableOnce:true}),
 item('skip-straight',4,'接龙','5 张以上、相邻差 1 或 2 的牌，可按顺子打出。'),
 item('airdrop',4,'空投','每局结算后，金币不是最高时得 5 金币；每桌 3 次。'),
 item('connections',4,'人脉','商店阶段付 6 金币，指定购买 1 件四级装备。'),
 item('bomb-4',4,'超级炸弹','每局首次用炸弹或王炸后，可弃 1--4 张手牌。',{family:'bomb'}),
 item('copy-4',4,'搞四张','发牌后自选 2 张、随机 2 张，共复制 4 张。',{family:'copy'}),
 item('rocket-win',4,'王炸！！！','打出王炸立即获胜；常规局胜利点翻倍。')
];
export const DEFAULT_LANDLORD_V3_RULES:LandlordV3Rules={id:'landlord-v3',catalogVersion:V3_CATALOG_VERSION,noCallPolicy:'dealer-free',equipmentCatalog:V3_EQUIPMENT_CATALOG.map(x=>({...x}))};
const coin=(value:string)=>BigInt(value);
const setCoin=(g:V3Game,seat:number,value:bigint)=>{if(value<0n)throw Error('金币不能为负数');g.coins[seat]=value.toString();};
const addCoin=(g:V3Game,seat:number,value:bigint)=>setCoin(g,seat,coin(g.coins[seat])+value);
const note=(g:V3Game,text:string,now:number)=>{g.log.push({text,at:now});g.log=g.log.slice(-250);};
/** 装备发动的公开提示：kind 让牌桌弹出提醒，id 用来点亮对应装备。 */
const notice=(g:V3Game,text:string,now:number,id?:string)=>{g.log.push({text,at:now,kind:'equipment',...(id?{id}:{})});g.log=g.log.slice(-250);};
const cardFaces=(cards:number[])=>sorted(cards).map(face).join(' ');
const RANK_LABELS:Record<number,string>={11:'J',12:'Q',13:'K',14:'A',15:'2',16:'小王',17:'大王'};
const rankLabel=(value:number)=>RANK_LABELS[value]??String(value);
const random=(n:number)=>{const max=Math.floor(0x100000000/n)*n;let value=0;do{value=crypto.getRandomValues(new Uint32Array(1))[0];}while(value>=max);return value%n;};
const shuffledDeck=()=>{const deck=Array.from({length:54},(_,i)=>i);for(let i=53;i>0;i--){const j=random(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}return deck;};
const next=(seat:number)=>(seat+1)%3;
const actions=(g:V3Game)=>g.tableActions.map(action=>action?.kind==='play'?{...action,cards:[...action.cards]}:action);
const order=(g:V3Game,from:number)=>{const start=from<0?0:from%3;return [0,1,2].map(offset=>(start+offset)%3);};
const mark=(g:V3Game,seat:number,key:string)=>{g.equipmentUsed??=[];const token=`${seat}:${key}`;if(!g.equipmentUsed.includes(token))g.equipmentUsed.push(token);};
const used=(g:V3Game,seat:number,key:string)=>(g.equipmentUsed??=[]).some(entry=>entry===`${seat}:${key}`||entry.startsWith(`${seat}:${key}:`));
const markUse=(g:V3Game,seat:number,key:string)=>{const count=(g.equipmentUsed??=[]).filter(entry=>entry.startsWith(`${seat}:${key}`)).length;g.equipmentUsed.push(`${seat}:${key}:${count+1}`);};
const tableMark=(g:V3Game,key:string)=>{(g.tableUsed??=[]).push(key);};
const tableUsed=(g:V3Game,key:string)=>(g.tableUsed??=[]).includes(key);
const tableCount=(g:V3Game,key:string)=>(g.tableUsed??=[]).filter(entry=>entry===key).length;
const catalog=(g:V3Game,id:string):V3CatalogEntry|undefined=>g.rules.equipmentCatalog.find(item=>item.id===id);
const owned=(g:V3Game,seat:number,id:string)=>g.equipment[seat].some(item=>item.id===id);
const held=(g:V3Game,seat:number,id:string)=>g.equipment[seat].find(item=>item.id===id);
const familyEquipment=(g:V3Game,seat:number,family:V3Family)=>g.equipment[seat].find(item=>catalog(g,item.id)?.family===family);
const removeEquipment=(g:V3Game,seat:number,id:string)=>{const index=g.equipment[seat].findIndex(item=>item.id===id);return index<0?undefined:g.equipment[seat].splice(index,1)[0];};
const countRank=(g:V3Game,seat:number,value:number)=>g.seats[seat].hand.filter(card=>rank(card)===value).length;
const physical=(g:V3Game,seat:number)=>g.seats[seat].hand.filter(card=>!isVirtualCard(card)&&rank(card)<16);

export function isLandlordV3(g:unknown):g is V3Game{return !!g&&typeof g==='object'&&(g as {kind?:unknown}).kind==='landlord-v3';}
export function newLandlordV3(host:string,name:string,seconds=30,developerMode=false):V3Game{
 return{kind:'landlord-v3',rules:{...DEFAULT_LANDLORD_V3_RULES,equipmentCatalog:V3_EQUIPMENT_CATALOG.map(x=>({...x}))},phase:'waiting',seats:[{id:host,name,hand:[],ready:false,plays:0,last:''}],host,bottom:[],turn:0,landlord:-1,dealer:-1,bid:'0',stake:'0',initialPasses:0,bidPasses:0,passes:0,last:null,tableActions:[],deadline:0,seconds,round:'',roundNumber:0,suddenDeath:false,winner:-1,champion:-1,victoryPoints:['0','0','0'],coins:['2','2','2'],equipment:[[],[],[]],shops:[{offers:[]},{offers:[]},{offers:[]}],firstFinisher:-1,deltas:[0,0,0],log:[],roundHistory:[],equipmentUsed:[],virtualSerial:0,rocketUsed:false,pending:[],tableUsed:[],revealed:[],peeked:[],betUsedRound:0,mapUsed:[],passStreak:[false,false,false],stakeUsedRound:0,lossStreak:['0','0','0'],maxPlayed:[0,0,0],...(developerMode?{developerMode:true}:{})};
}
function randomOffers(g:V3Game,seat:number,level:1|2|3|4,revision=0){
 const levelItems=g.rules.equipmentCatalog.filter(item=>item.level===level&&equipmentAvailable(item.id)&&!(item.id==='piggy-bank'&&g.roundNumber>6));
 const repeatable=levelItems.filter(item=>item.id==='extra-refresh'||item.id==='change');
 const optional=levelItems.filter(item=>!repeatable.includes(item)&&!owned(g,seat,item.id));
 const source=[...repeatable,...(optional.length?optional:levelItems.filter(item=>!repeatable.includes(item)))],pool=[...source],picked:V3Offer[]=[];
 while(pool.length&&picked.length<3){const index=random(pool.length),entry=pool.splice(index,1)[0];picked.push({offerId:`${g.round}:${seat}:${level}:${revision}:${picked.length}`,id:entry.id,level:entry.level,price:entry.price,bought:false});}
 return picked;
}
function refreshShops(g:V3Game){g.shops=g.seats.map((_,seat)=>({offers:([1,2,3,4] as const).flatMap(level=>randomOffers(g,seat,level))}));}
function replaceOffers(g:V3Game,seat:number){const kept=g.shops[seat].offers.filter(offer=>offer.bought),fresh=([1,2,3,4] as const).flatMap(level=>randomOffers(g,seat,level,1).slice(0,Math.max(0,3-kept.filter(offer=>offer.level===level).length)));const combined=[...kept,...fresh];g.shops[seat].offers=[...new Map(combined.map(offer=>[offer.offerId,offer])).values()];}
function addCopy(g:V3Game,seat:number,value:number){if(value>=16)throw Error('王不能被复制');g.virtualSerial++;g.seats[seat].hand=sorted([...g.seats[seat].hand,virtualCard(value,g.virtualSerial)]);}
/** 随机复制来源：只挑「再复制一张也不会超过 4 张同点」的实体非王牌，避免随机部分把整次结算拖垮。 */
function randomCopySources(g:V3Game,seat:number,count:number,exclude:number[]=[],planned:number[]=[]){
 const room=(value:number)=>4-countRank(g,seat,value)-planned.filter(rank=>rank===value).length;
 const pool=g.seats[seat].hand.filter(card=>!isVirtualCard(card)&&rank(card)<16&&!exclude.includes(card)&&room(rank(card))>0),out:number[]=[];
 while(pool.length&&out.length<count){const card=pool.splice(random(pool.length),1)[0];if(room(rank(card))<=0)continue;out.push(card);planned.push(rank(card));}
 return out;
}
function applyMaps(cards:number[],maps:number[]|undefined){return cards.map(card=>{const found=maps?.find(token=>Math.floor(token/100)===card);return found===undefined?card:virtualCard(found%100,700000+card);});}
/** 只对给定的牌面（映射已经套用完毕）判定牌型；影子牌与史密斯夫妇的替代都在这里生效。 */
function comboOf(g:V3Game,seat:number,mapped:number[]){
 const found:Combo[]=[];
 if(new Set(mapped).size!==mapped.length)return null;
 const normal=classify(mapped);
 if(normal)found.push(normal);else if(owned(g,seat,'skip-straight')&&!used(g,seat,'skip-straight')){const skipped=classifySkippedStraight(mapped);if(skipped)found.push(skipped);}
 if(owned(g,seat,'smith')){
  const choices=mapped.map(card=>rank(card)===11||rank(card)===12?[rank(card),rank(card)===11?12:11]:[rank(card)]);
  const visit=(index:number,values:number[])=>{if(index===mapped.length){const combo=classify(values);if(combo)found.push(combo);return;}for(const value of choices[index])visit(index+1,[...values,value===rank(mapped[index])?mapped[index]:virtualCard(value,500000+index)]);};
  visit(0,[]);
 }
 if(!found.length)return null;
 return found.reduce((best,combo)=>combo.rank>best.rank?combo:best);
}
function classifyV3(g:V3Game,seat:number,cards:number[],maps:number[]|undefined){
 if(new Set(cards).size!==cards.length)return null;
 return comboOf(g,seat,applyMaps(cards,maps));
}
// 接龙：相邻两张差 1 或差 2 的单张组合按「顺子」结算（例如 3 5 6 7 8），不产生新牌型。
function classifySkippedStraight(cards:number[]):Combo|null{
 if(cards.length<5||new Set(cards).size!==cards.length)return null;
 const values=cards.map(rank).sort((a,b)=>a-b);
 if(values.some(value=>value<3||value>14))return null;
 if(!values.every((value,index)=>index===0||value-values[index-1]===1||value-values[index-1]===2))return null;
 return {kind:'顺子',rank:values[values.length-1],size:cards.length,chain:cards.length};
}
function countFamilies(g:V3Game,seat:number,family:V3Family){return g.equipment[seat].filter(entry=>catalog(g,entry.id)?.family===family).length;}
function hasCopyWindow(g:V3Game,seat:number){
 const copy=familyEquipment(g,seat,'copy'),precision=familyEquipment(g,seat,'precision'),pool=physical(g,seat);
 if(copy&&(copy.id==='copy-3'||copy.id==='copy-4')&&!used(g,seat,'copy'))return true;
 // 用过（或用过跳过）之后不能再算「还有开局装备」，否则窗口会在原地反复重开，轮不到下一个座位。
 if(!precision||used(g,seat,'precision'))return false;
 if(precision.id==='precision-copy-3')return pool.some(card=>countRank(g,seat,rank(card))<=2); // 复刻已下架，仅旧快照保留
 return pool.length>=(precision.id==='precision-copy-1'?1:2);
}
function hasOpeningEquipment(g:V3Game,seat:number){return (lessLimit(g,seat)>0&&!used(g,seat,'less'))||hasCopyWindow(g,seat);}
// Retained only for rooms whose frozen catalog still contains the retired series.
function lessLimit(g:V3Game,seat:number){const entry=familyEquipment(g,seat,'less');if(!entry)return 0;if(entry.id==='less-n')return Math.min(...g.seats[seat].hand.map(rank));return entry.level;}
function stakeOption(g:V3Game,seat:number){
 if(g.suddenDeath||g.stakeUsedRound===g.roundNumber)return null;
 const amount=coin(g.coins[seat]);
 if(owned(g,seat,'all-in')&&!used(g,seat,'all-in')&&amount>=1n)return 'all-in' as const;
 if(owned(g,seat,'raise-stake')&&!used(g,seat,'raise-stake')&&seat===g.landlord&&amount>=coin(g.stake))return 'raise-stake' as const;
 return null;
}
/** 借光只在手牌里真有可弃的牌（与上一次出牌任一点数相同）时才询问，否则不弹窗。 */
function canBorrow(g:V3Game,seat:number){const recent=g.last?.cards??[];return (g.seats[seat]?.hand??[]).some(card=>recent.some(played=>rank(played)===rank(card)));}
function valid(g:V3Game,effect:V3Effect):boolean{
 if(g.phase==='finished'||g.phase==='closed')return false;
 const hand=g.seats[effect.seat]?.hand??[];
 switch(effect.kind){
  case 'opening':return hasOpeningEquipment(g,effect.seat);
  case 'stake':return stakeOption(g,effect.seat)!==null;
  case 'bet':return !g.suddenDeath&&g.stakeUsedRound!==g.roundNumber&&coin(g.coins[effect.seat])>=(owned(g,effect.seat,'side-bet')?1n:2n)&&!used(g,effect.seat,'side-bet')&&!used(g,effect.seat,'bet-is-set')&&(owned(g,effect.seat,'side-bet')||owned(g,effect.seat,'bet-is-set'));
  case 'bomb':return hand.length>0&&!!familyEquipment(g,effect.seat,'bomb')&&!used(g,effect.seat,'bomb');
  case 'discard':return hand.length>0&&owned(g,effect.seat,'take-the-lot')&&(g.equipmentUsed??[]).filter(entry=>entry.startsWith(`${effect.seat}:take-the-lot`)).length<3;
  case 'thirteen':return hand.some(card=>rank(card)<16)&&owned(g,effect.seat,'thirteen')&&!used(g,effect.seat,'thirteen');
  case 'aftershock':return hand.length>0&&owned(g,effect.seat,'aftershock')&&!used(g,effect.seat,'aftershock');
  case 'borrowed':return hand.length>1&&owned(g,effect.seat,'borrowed-light')&&(g.equipmentUsed??[]).filter(entry=>entry.startsWith(`${effect.seat}:borrowed-light`)).length<2&&canBorrow(g,effect.seat);
  case 'transfer':return g.last?.combo.kind==='四带二'&&owned(g,effect.seat,'four-with-two-pass')&&!used(g,effect.seat,'four-with-two-pass');
  case 'reveal':return !g.suddenDeath&&!g.equipmentUsed.some(token=>token.endsWith(':stand-up-fight'))&&hand.length>1&&owned(g,effect.seat,'stand-up-fight')&&!used(g,effect.seat,'stand-up-fight');
  case 'target':return !g.suddenDeath&&g.turn===effect.seat&&['playing','equipment'].includes(g.phase)&&g.seats.some((_,index)=>index!==effect.seat&&g.seats[index].hand.length>0)&&owned(g,effect.seat,'cut-off-income')&&!used(g,effect.seat,'cut-off-income');
  case 'lead':return hand.length>0&&(['return-lead','follow-through'] as const).some(id=>owned(g,effect.seat,id)&&!used(g,effect.seat,id));
 }
}
function queue(g:V3Game,...effects:V3Effect[]){g.pending??=[];g.pending.push(...effects.filter(effect=>valid(g,effect)));}
function nextEffect(g:V3Game,now=Date.now()){
 g.pending??=[];
 while(g.pending.length){
  const effect=g.pending.shift()!;
  if(!valid(g,effect))continue;
  // 打开装备窗口时不清空牌桌显示：别人刚出的牌必须一直看得到，否则没法决定怎么压。
  g.effectResumeTurn??=g.turn;g.pendingEffect=effect;g.phase='equipment';g.turn=effect.seat;g.deadline=now+g.seconds*1000;
  return true;
 }
 g.pendingEffect=undefined;
 if(g.phase==='equipment')g.phase=g.landlord>=0?'playing':'bidding';
 if(g.effectResumeTurn!==undefined){g.turn=g.effectResumeTurn;g.effectResumeTurn=undefined;g.deadline=now+g.seconds*1000;}
 return false;
}
function beginBidding(g:V3Game,now:number){
 const dealer=g.dealer>=0&&g.dealer<g.seats.length?g.dealer:0;
 g.phase='bidding';g.pending=[];g.pendingEffect=undefined;g.turn=dealer;g.seats.forEach(player=>player.last='');g.tableActions=[null,null,null];g.deadline=now+g.seconds*1000;
 note(g,`${g.seats[dealer].name} 先叫地主`,now);
}
function advanceOpening(g:V3Game,now:number){
 g.seats.forEach((_,seat)=>{const copy=familyEquipment(g,seat,'copy');if((copy?.id==='copy-1'||copy?.id==='copy-2')&&!used(g,seat,'copy')){const sources=randomCopySources(g,seat,copy.id==='copy-1'?1:2);sources.forEach(card=>addCopy(g,seat,rank(card)));mark(g,seat,'copy');if(sources.length)notice(g,`${g.seats[seat].name} 的${catalog(g,copy.id)?.name}发动：复制了 ${sources.length} 张牌`,now,copy.id);}});

 g.pending=(g.pending??[]).filter(effect=>effect.kind!=='opening');
 g.pendingEffect=undefined;
 const seat=g.seats.findIndex((_,index)=>hasOpeningEquipment(g,index));
 if(seat>=0){g.pendingEffect={seat,kind:'opening'};g.phase='equipment';g.turn=seat;g.tableActions=[null,null,null];g.deadline=now+g.seconds*1000;note(g,`${g.seats[seat].name} 整理开局装备`,now);return;}
 // 押注与买定离手都在竞价开始前声明：此时地主尚未确定，押注才有意义。
 queue(g,...order(g,g.dealer).map(index=>({seat:index,kind:'bet' as const})));
 if(nextEffect(g,now))return;
 beginBidding(g,now);
}
function startRound(g:V3Game,now:number){
 if(g.seats.length!==3)throw Error('需要三人入座');
 const firstRound=g.roundNumber===0;g.roundNumber++;g.suddenDeath=g.roundNumber===13;g.dealer=firstRound?random(3):next(g.dealer);g.round=crypto.randomUUID();g.winner=-1;g.landlord=-1;g.bid='0';g.stake='0';g.initialPasses=0;g.bidPasses=0;g.passes=0;g.last=null;g.firstFinisher=-1;g.tableActions=[null,null,null];g.deltas=[0,0,0];g.visualEvents=[];g.log=[];
 g.equipmentUsed=[];g.effectResumeTurn=undefined;g.privatePeeks={};g.peekedSeat=undefined;g.pending=[];g.pendingEffect=undefined;g.revealed=[];g.peeked=[];g.mapUsed=[];g.passStreak=[false,false,false];g.stakeUsedRound=0;g.betUsedRound=0;g.allIn=undefined;g.sideBet=undefined;g.betIsSet=undefined;g.cutIncome=undefined;g.maxPlayed=[0,0,0];
 const deck=shuffledDeck(),cardsEach=g.suddenDeath?18:17;
 g.seats.forEach((seat,index)=>{seat.hand=sorted(deck.slice(index*cardsEach,index*cardsEach+cardsEach));seat.plays=0;seat.last='';seat.ready=false;});
 g.bottom=g.suddenDeath?[]:deck.slice(51);g.turn=g.dealer;g.deadline=now+g.seconds*1000;
 if(g.suddenDeath){g.phase='playing';note(g,'第 13 局突然死亡开始：三人各自为战',now);return;}
 g.seats.forEach((_,seat)=>{
  if(held(g,seat,'piggy-bank')&&g.roundNumber===7){removeEquipment(g,seat,'piggy-bank');equipmentReward(g,seat,5n,now,'piggy-bank');}
  if(held(g,seat,'appearance-fee')&&[3,6,9].includes(g.roundNumber)&&tableCount(g,`fee:${seat}`)<3){tableMark(g,`fee:${seat}`);addCoin(g,seat,2n);notice(g,`${g.seats[seat].name} 收取出场费 2 金币`,now,'appearance-fee');} });
 refreshShops(g);g.phase='shopping';note(g,`第 ${g.roundNumber} 局商店已刷新`,now);
}
export function readyV3(g:V3Game,seat:number,now=Date.now()){
 if(!['waiting','finished'].includes(g.phase))throw Error('对局中不能修改准备状态');if(g.champion>=0)throw Error('本桌赛制已经结束');
 g.seats[seat].ready=!g.seats[seat].ready;
 if(g.seats.length===3&&g.seats.every(player=>player.ready))startRound(g,now);
}
export function finishShopping(g:V3Game,seat:number,now=Date.now()){
 if(g.phase==='bidding')return;if(g.phase!=='shopping')throw Error('当前不在商店阶段');if(g.seats[seat].last==='商店完成')return;
 g.seats[seat].last='商店完成';note(g,`${g.seats[seat].name} 完成商店`,now);
 if(g.seats.every(player=>player.last==='商店完成'))advanceOpening(g,now);
}
function grant(g:V3Game,seat:number,entry:V3CatalogEntry,now:number,options:{free?:boolean;nonSellable?:boolean;source?:string;price?:bigint}={}){
 if(!equipmentAvailable(entry.id))throw Error('这件装备尚未开放购买');
 if(entry.tableOnce&&tableUsed(g,`buy:${entry.id}`))throw Error('这件装备本桌已经售出过');
 if(owned(g,seat,entry.id))throw Error('已经持有这件装备');
 const own=g.equipment[seat],sameFamily=entry.family?own.find(entry2=>catalog(g,entry2.id)?.family===entry.family):undefined,predecessor=sameFamily?.level===entry.level-1?sameFamily:undefined;
 if(sameFamily&&sameFamily.level>=entry.level)throw Error('同一系列只能向更高等级升级');
 if(own.some(entry2=>(catalog(g,entry2.id)?.exclusive??[]).includes(entry.family??'')))throw Error('这件装备不能与已持有的系列共存');
 for(const group of entry.exclusive??[])if(own.some(entry2=>(catalog(g,entry2.id)?.exclusive??[]).includes(group)||catalog(g,entry2.id)?.family===group))throw Error('这件装备不能与已持有的系列共存');
 if(predecessor&&entry.family&&countFamilies(g,seat,entry.family)>1)throw Error('同一系列同一时刻只能持有一个等级');
 if(!sameFamily&&own.length>=8)throw Error('最多持有 8 件装备');
 const price=options.free?0n:options.price??(coin(entry.price)/(predecessor?2n:1n));
 if(coin(g.coins[seat])<price)throw Error('金币不足');
 setCoin(g,seat,coin(g.coins[seat])-price);
 if(sameFamily)own.splice(own.indexOf(sameFamily),1);
 if(entry.tableOnce)tableMark(g,`buy:${entry.id}`);
 if(entry.id==='lucky-star'){g.lossStreak??=['0','0','0'];g.lossStreak[seat]='0';}
 own.push({instanceId:crypto.randomUUID(),id:entry.id,level:entry.level,price:entry.price,...(options.nonSellable?{nonSellable:true}:{})});
 if(entry.level===1&&!predecessor&&!options.free&&owned(g,seat,'change')&&!used(g,seat,'change')){mark(g,seat,'change');addCoin(g,seat,1n);notice(g,`${g.seats[seat].name} 的找零发动：返还 1 金币`,now,'change');}
 note(g,`${g.seats[seat].name} ${options.source??'购买'} ${entry.name}${predecessor?'（半价升级）':''}`,now);
}
function shopping(g:V3Game,seat:number){if(g.phase!=='shopping'||g.seats[seat].last==='商店完成')throw Error('当前不在可操作的商店阶段');}
export function buyV3Equipment(g:V3Game,seat:number,offerId:unknown,now=Date.now()){
 shopping(g,seat);
 if(g.phase!=='shopping')throw Error('只能在商店阶段购买装备');if(typeof offerId!=='string')throw Error('装备选择无效');
 const offer=g.shops[seat]?.offers.find(entry=>entry.offerId===offerId),entry=offer&&catalog(g,offer.id);
 if(!offer||!entry||offer.bought)throw Error('该装备不可购买');
 if(entry.id==='piggy-bank'&&g.roundNumber>6)throw Error('存钱罐只能在第 1--6 局购买');
 grant(g,seat,entry,now);offer.bought=true;
}
export function clearanceV3(g:V3Game,seat:number,offerId:unknown,now=Date.now()){
 shopping(g,seat);
 if(g.phase!=='shopping')throw Error('只能在商店阶段使用清仓');if(typeof offerId!=='string')throw Error('装备选择无效');
 if(used(g,seat,'connections'))throw Error('人脉与清仓不能在同一局共同触发');
 if(!owned(g,seat,'clearance'))throw Error('没有清仓装备');if(tableUsed(g,'clearance'))throw Error('本桌已经有人使用过清仓');
 const offer=g.shops[seat]?.offers.find(entry=>entry.offerId===offerId),entry=offer&&catalog(g,offer.id);
 if(!offer||!entry||offer.bought)throw Error('该候选不可清仓');
 grant(g,seat,entry,now,{free:true,source:'清仓免费获得'});offer.bought=true;tableMark(g,'clearance');mark(g,seat,'clearance');
 notice(g,`${g.seats[seat].name} 的清仓发动：免费获得 ${entry.name}`,now,'clearance');
}
export function connectionsV3(g:V3Game,seat:number,equipmentId:unknown,now=Date.now()){
 shopping(g,seat);
 if(g.phase!=='shopping')throw Error('只能在商店阶段使用人脉');if(typeof equipmentId!=='string')throw Error('装备选择无效');
 if(!owned(g,seat,'connections'))throw Error('没有人脉装备');if(tableUsed(g,`connections:${seat}`))throw Error('本桌已经使用过人脉');
 if(used(g,seat,'clearance'))throw Error('人脉与清仓不能在同一局共同触发');
 const entry=catalog(g,equipmentId);if(!entry||entry.level!==4)throw Error('人脉只能指定四级装备');
 grant(g,seat,entry,now,{price:6n,source:'通过人脉购买'});mark(g,seat,'connections');tableMark(g,`connections:${seat}`);
 notice(g,`${g.seats[seat].name} 的人脉发动：花 6 金币指定购买 ${entry.name}`,now,'connections');
}
export function sellV3Equipment(g:V3Game,seat:number,instanceId:unknown,now=Date.now()){
 shopping(g,seat);
 if(typeof instanceId!=='string')throw Error('装备选择无效');
 const index=g.equipment[seat].findIndex(item=>item.instanceId===instanceId);if(index<0)throw Error('没有这件装备');
 const entry=g.equipment[seat][index];if(entry.nonSellable)throw Error('这件装备不能出售');
 g.equipment[seat].splice(index,1);const refund=entry.level===1?0n:coin(entry.price)/2n;addCoin(g,seat,refund);
 note(g,`${g.seats[seat].name} 出售 ${catalog(g,entry.id)?.name??`${entry.level} 级装备`}，返还 ${refund} 金币`,now);
}
export function refreshV3Shop(g:V3Game,seat:number,now=Date.now()){
 shopping(g,seat);
 if(g.phase!=='shopping'||!owned(g,seat,'extra-refresh')||used(g,seat,'refresh'))throw Error('当前不能额外刷新');
 replaceOffers(g,seat);mark(g,seat,'refresh');notice(g,`${g.seats[seat].name} 使用额外刷新`,now,'extra-refresh');
}
export function placeV3Bet(g:V3Game,seat:number,side:unknown,now=Date.now(),kind:'side'|'hold'='side'){
 if(g.suddenDeath)throw Error('第 13 局禁用赌注类装备');
 if(g.phase!=='shopping'&&!(g.phase==='equipment'&&g.pendingEffect?.kind==='bet'&&g.pendingEffect.seat===seat))throw Error('押注只能在竞价前声明');
 if(g.stakeUsedRound===g.roundNumber)throw Error('本局已经有赌注类装备触发');
 if(kind==='hold'){
  if(!owned(g,seat,'bet-is-set')||used(g,seat,'bet-is-set'))throw Error('本局不能再次买定离手');
  if(coin(g.coins[seat])<2n)throw Error('金币不足，需要托管 2 金币');
  setCoin(g,seat,coin(g.coins[seat])-2n);mark(g,seat,'bet-is-set');g.stakeUsedRound=g.roundNumber;g.betUsedRound=g.roundNumber;g.betIsSet={seat};
  notice(g,`${g.seats[seat].name} 买定离手：托管 2 金币，押自己这方获胜`,now,'bet-is-set');
  return;
 }
 if(side!=='landlord'&&side!=='farmers')throw Error('请选择押注地主方还是农民方');
 if(!owned(g,seat,'side-bet')||used(g,seat,'side-bet'))throw Error('本局不能再次押注');
 setCoin(g,seat,coin(g.coins[seat])-1n);mark(g,seat,'side-bet');g.stakeUsedRound=g.roundNumber;g.betUsedRound=g.roundNumber;g.sideBet={seat,side};
 notice(g,`${g.seats[seat].name} 押注 ${side==='landlord'?'地主方':'农民方'}获胜，托管 1 金币`,now,'side-bet');
}
export function skipV3Bet(g:V3Game,seat:number,phase:'shopping'|'playing'|'equipment'='shopping',now=Date.now()){
 void phase;
 if(owned(g,seat,'side-bet')&&!used(g,seat,'side-bet'))mark(g,seat,'side-bet');
 if(owned(g,seat,'bet-is-set')&&!used(g,seat,'bet-is-set'))mark(g,seat,'bet-is-set');
 note(g,`${g.seats[seat].name} 放弃押注`,now);
}
export function peekV3Bottom(g:V3Game,seat:number,index:unknown,now=Date.now()){
 if(g.phase!=='bidding')throw Error('只能在竞价开始前查看底牌');
 if(!owned(g,seat,'peek-bottom')||used(g,seat,'peek'))throw Error('本局不能再次查看底牌');
 if(typeof index!=='number'||![0,1,2].includes(index))throw Error('请选择一张底牌');
 if(index>=g.bottom.length)throw Error('本局没有这张底牌');
 mark(g,seat,'peek');g.privatePeeks??={};g.privatePeeks[String(seat)]=[index];
}
export function useV3OpeningEquipment(g:V3Game,seat:number,cards:unknown,now=Date.now()){
 if(g.phase!=='equipment'||g.pendingEffect?.kind!=='opening'||g.pendingEffect.seat!==seat)throw Error('当前没有可整理的开局装备');
 if(!Array.isArray(cards)||cards.some(card=>!Number.isSafeInteger(card))||new Set(cards).size!==cards.length)throw Error('请选择不重复的手牌');
 const hand=g.seats[seat].hand,limit=lessLimit(g,seat);
 if(limit&&!used(g,seat,'less')&&(cards.length===0||cards.length<=limit)){
  if(cards.some(card=>!hand.includes(card)))throw Error('只能弃掉自己的手牌');
  g.seats[seat].hand=hand.filter(card=>!cards.includes(card));mark(g,seat,'less');note(g,`${g.seats[seat].name} 触发少手系列，公开弃掉 ${cards.length} 张牌`,now);advanceOpening(g,now);return;
 }
 const copy=familyEquipment(g,seat,'copy'),copyEntry=copy&&catalog(g,copy.id),precision=familyEquipment(g,seat,'precision'),precisionEntry=precision&&catalog(g,precision.id),pool=physical(g,seat);
 if(!pool.length)throw Error('没有可复制的非王牌');
 if(copy&&(copy.id==='copy-3'||copy.id==='copy-4')&&!used(g,seat,'copy')){
  let sources:number[],planned:number[];
  if(copy.id==='copy-3'){
   if(cards.length!==1||!pool.includes(cards[0]))throw Error('搞三张需要选择 1 张非王牌');
   planned=[rank(cards[0])];
   if(countRank(g,seat,planned[0])>=4)throw Error('这个点数已经是 4 张，不能再复制');
   sources=[cards[0],...randomCopySources(g,seat,2,cards,planned)];
  }else{
   const chosen=cards.length===1?[cards[0],cards[0]]:cards;
   if(chosen.length!==2||chosen.some(card=>!pool.includes(card)))throw Error('搞四张需要选择 1 或 2 张非王牌');
   for(const value of new Set(chosen.map(rank)))if(countRank(g,seat,value)+chosen.filter(card=>rank(card)===value).length>4)throw Error('这个点数复制后会超过 4 张，请换一个点数');
   planned=chosen.map(rank);
   sources=[...chosen,...randomCopySources(g,seat,2,[],planned)];
  }
  for(const value of new Set(sources.map(rank)))if(countRank(g,seat,value)+sources.filter(card=>rank(card)===value).length>4)throw Error('复制后会超过 4 张同点，无法复制该点数');
  sources.forEach(card=>addCopy(g,seat,rank(card)));mark(g,seat,'copy');notice(g,`${g.seats[seat].name} 的${copyEntry?.name}发动：复制了 ${sources.length} 张牌`,now,copy.id);advanceOpening(g,now);return;
 }
 if(precision&&!used(g,seat,'precision')){
  let values:number[],count:number;
  if(precision.id==='precision-copy-1'){
   if(cards.length!==1||!pool.includes(cards[0]))throw Error('点一张需要选择 1 张非王牌');
   values=[rank(cards[0])];count=1;
  }else if(precision.id==='precision-copy-2'){
   if(cards.length!==2||new Set(cards).size!==2||cards.some(card=>!pool.includes(card)))throw Error('点二张需要选择 2 张不同的非王牌');
   values=cards.map(rank);count=2;
  }else{
   const candidates=[...new Set(pool.map(rank))].filter(value=>value<16&&countRank(g,seat,value)<=2).sort((a,b)=>b-a);
   if(!candidates.length)throw Error('没有可以复刻的点数');values=[candidates[0]];count=2;
  }
  for(const value of new Set(values))if(countRank(g,seat,value)+(precision.id==='precision-copy-2'?values.filter(rank=>rank===value).length:count)>4)throw Error(`该点数复制后会超过 4 张，无法复制（点数 ${value}，现有 ${countRank(g,seat,value)}，新增 ${count}）`);
  for(let copyCount=0;copyCount<count;copyCount++)addCopy(g,seat,values[precision.id==='precision-copy-2'?copyCount:0]);
  mark(g,seat,'precision');notice(g,`${g.seats[seat].name} 的${precisionEntry?.name}发动：复制了 ${count} 张牌`,now,precision.id);advanceOpening(g,now);return;
 }
 throw Error('当前没有可用的开局装备');
}
export function skipV3OpeningEquipment(g:V3Game,seat:number,now=Date.now()){
 if(g.phase!=='equipment'||g.pendingEffect?.kind!=='opening'||g.pendingEffect.seat!==seat)throw Error('当前没有可结束的开局装备窗口');
 if(familyEquipment(g,seat,'copy')&&!used(g,seat,'copy'))mark(g,seat,'copy');
 if(familyEquipment(g,seat,'precision')&&!used(g,seat,'precision'))mark(g,seat,'precision');
 if(lessLimit(g,seat)>0&&!used(g,seat,'less'))mark(g,seat,'less');
 note(g,`${g.seats[seat].name} 结束开局装备窗口`,now);advanceOpening(g,now);
}
export function declareV3NoBid(g:V3Game,seat:number,now=Date.now()){
 if(g.phase!=='bidding')throw Error('只能在本局竞价开始后声明');
 if(!owned(g,seat,'no-bid')||used(g,seat,'no-bid'))throw Error('本局不能再次声明');
 mark(g,seat,'no-bid');notice(g,`${g.seats[seat].name} 声明我不叫，本局不再抢地主`,now,'no-bid');
}
export function bidV3(g:V3Game,seat:number,call:unknown,now=Date.now()){
 if(g.phase!=='bidding'||g.turn!==seat)throw Error('还没轮到你叫地主');
 if(typeof call!=='boolean')throw Error('叫地主选择无效');
 const locked=owned(g,seat,'no-bid')&&used(g,seat,'no-bid');
 if(call&&locked)throw Error('本局已经声明我不叫，只能提交不叫');
 const effective=locked?false:call;
 const a=actions(g);a[seat]={kind:'bid',value:effective?1:0};g.tableActions=a;
 if(!effective){
  g.seats[seat].last='不叫';
  if(seat===g.dealer&&g.initialPasses===0&&owned(g,seat,'dealer-change')&&!used(g,seat,'dealer-change')){mark(g,seat,'dealer-change');addCoin(g,seat,1n);notice(g,`${g.seats[seat].name} 的庄家零钱发动：获得 1 金币`,now,'dealer-change');}
  note(g,`${g.seats[seat].name} 不叫`,now);
  if(g.landlord<0){
   g.initialPasses++;
   if(g.initialPasses===3){forceLandlord(g,now);return;}
  }else{g.bidPasses++;if(g.bidPasses===2){appointLandlord(g,g.landlord,coin(g.stake),now);return;}}
  g.turn=next(seat);g.tableActions[g.turn]=null;g.deadline=now+g.seconds*1000;return;
 }
 const stake=coin(g.stake)+1n;if(coin(g.coins[seat])<stake)throw Error('可用金币不足，不能叫/抢地主');
 if(g.landlord>=0)addCoin(g,g.landlord,coin(g.stake));
 setCoin(g,seat,coin(g.coins[seat])-stake);g.landlord=seat;g.stake=stake.toString();g.bid=stake.toString();g.bidPasses=0;g.seats[seat].last=`下注 ${stake}`;note(g,`${g.seats[seat].name} 抢地主，托管 ${stake} 金币`,now);
 g.turn=next(seat);g.tableActions[g.turn]=null;g.deadline=now+g.seconds*1000;
}
function appointLandlord(g:V3Game,seat:number,stake:bigint,now:number,forced=false){
 g.landlord=seat;g.stake=stake.toString();g.bid=stake.toString();g.phase='playing';g.turn=seat;g.seats[seat].hand=sorted([...g.seats[seat].hand,...g.bottom]);g.seats.forEach(player=>player.last='');g.tableActions=[null,null,null];g.passes=0;g.passStreak=[false,false,false];g.deadline=now+g.seconds*1000;
 note(g,`${g.seats[seat].name}${forced?'被指定':'成为'}地主${stake?`，托管 ${stake} 金币`:''}`,now);
 // 我不叫：本局最终地主不是声明者时发放 1 金币；声明者自己被指定为地主则不发放。
 for(let index=0;index<g.seats.length;index++)if(index!==seat&&owned(g,index,'no-bid')&&used(g,index,'no-bid')){addCoin(g,index,1n);notice(g,`${g.seats[index].name} 的我不叫发动：获得 1 金币`,now,'no-bid');}
 queue(g,...order(g,g.dealer).map(index=>({seat:index,kind:'stake' as const})),...order(g,g.dealer).map(index=>({seat:index,kind:'reveal' as const,max:5})),...order(g,g.dealer).map(index=>({seat:index,kind:'target' as const})));
 nextEffect(g,now);
}
function forceLandlord(g:V3Game,now:number){
 if(g.rules.noCallPolicy==='dealer-free'){note(g,'全员不叫，庄家免费成为地主（托管 0 金币）',now);appointLandlord(g,g.dealer,0n,now,true);return;}
 const amounts=g.coins.map(coin),maximum=amounts.reduce((a,b)=>a>b?a:b,0n);
 if(maximum===0n){appointLandlord(g,g.dealer,0n,now,true);return;}
 const seat=order(g,g.dealer).find(index=>amounts[index]===maximum)!;setCoin(g,seat,amounts[seat]-1n);appointLandlord(g,seat,1n,now,true);
}
export function stakeV3(g:V3Game,seat:number,choice:unknown,now=Date.now()){
 if(g.phase!=='equipment'||g.pendingEffect?.kind!=='stake'||g.pendingEffect.seat!==seat)throw Error('当前没有可以使用的赌注装备');
 if(!choice){if(owned(g,seat,'all-in'))mark(g,seat,'all-in');if(owned(g,seat,'raise-stake'))mark(g,seat,'raise-stake');note(g,`${g.seats[seat].name} 不使用赌注装备`,now);}
 else{
  const option=stakeOption(g,seat);if(!option)throw Error('当前不能使用赌注装备');
  if(option==='raise-stake'){const current=coin(g.stake);setCoin(g,seat,coin(g.coins[seat])-current);g.stake=(current*2n).toString();notice(g,`${g.seats[seat].name} 的加倍发动：赌注变为 ${g.stake} 金币`,now,'raise-stake');}
  else{const amount=coin(g.coins[seat])/2n||1n;setCoin(g,seat,coin(g.coins[seat])-amount);g.allIn={amount:amount.toString(),seat};notice(g,`${g.seats[seat].name} 的孤注发动：托管 ${amount} 金币押自己这方获胜`,now,'all-in');}
  g.stakeUsedRound=g.roundNumber;
 }
 if(choice)g.pending=(g.pending??[]).filter(effect=>effect.kind!=='stake');
 nextEffect(g,now);
}
function equipmentReward(g:V3Game,seat:number,amount:bigint,now:number,id:string){
 if(amount<=0n)return;
 const cut=g.cutIncome?.source===seat?amount/2n:amount;
 if(cut<=0n)return;
 addCoin(g,seat,cut);notice(g,`${g.seats[seat].name} 的${catalog(g,id)?.name??id}发动：获得 ${cut} 金币${cut===amount?'':'（被断你财路减半）'}`,now,id);
}
function firstFinisherOf(g:V3Game,landlordWon:boolean){
 if(g.firstFinisher<0)return -1;
 const farmers=[0,1,2].filter(index=>index!==g.landlord);
 const team=landlordWon?g.firstFinisher===g.landlord:farmers.includes(g.firstFinisher);
 return team?g.firstFinisher:-1;
}
function settleAllIn(g:V3Game,landlordWon:boolean,now:number){
 const allIn=g.allIn;if(!allIn)return;
 const farmers=[0,1,2].filter(index=>index!==g.landlord),amount=coin(allIn.amount),won=(allIn.seat===g.landlord)===landlordWon;
 if(won){
  addCoin(g,allIn.seat,amount);
  const opponents=allIn.seat===g.landlord?farmers:[g.landlord],owed=allIn.seat===g.landlord?amount:amount*2n;
  for(const opponent of opponents){const paid=coin(g.coins[opponent])<owed?coin(g.coins[opponent]):owed;setCoin(g,opponent,coin(g.coins[opponent])-paid);addCoin(g,allIn.seat,paid);}
 }else{const target=firstFinisherOf(g,landlordWon);if(target>=0)addCoin(g,target,amount);}
 notice(g,`${g.seats[allIn.seat].name} 的孤注${won?'猜中':'猜错'}，${amount} 金币已结算`,now,'all-in');
 g.allIn=undefined;
}
function settleBet(g:V3Game,landlordWon:boolean,now:number){
 const bet=g.sideBet;if(!bet)return;
 const farmers=[0,1,2].filter(index=>index!==g.landlord),won=(bet.side==='landlord')===landlordWon;
 if(won){
  addCoin(g,bet.seat,1n);
  const opponents=bet.side==='landlord'?farmers:[g.landlord];
  for(const opponent of opponents){const paid=coin(g.coins[opponent])<1n?coin(g.coins[opponent]):1n;setCoin(g,opponent,coin(g.coins[opponent])-paid);addCoin(g,bet.seat,paid);}
 }else{const target=firstFinisherOf(g,landlordWon);if(target>=0)addCoin(g,target,1n);}
 notice(g,`${g.seats[bet.seat].name} 的押注${won?'猜中':'猜错'}（押${bet.side==='landlord'?'地主方':'农民方'}），托管 1 金币已结算`,now,'side-bet');
 g.sideBet=undefined;
}
function settleV3(g:V3Game,winner:number,now:number,doublePoints=false){
 const landlordWon=winner===g.landlord,stake=coin(g.stake),farmers=[0,1,2].filter(index=>index!==g.landlord);
 if(landlordWon){
  addCoin(g,g.landlord,stake);
  let payments:[bigint,bigint];
  if(stake%2n===0n)payments=[stake/2n+1n,stake/2n+1n];
  else{
   const low=stake/2n+1n,high=(stake+1n)/2n+1n,[first,second]=farmers;
   if(g.seats[first].hand.length<g.seats[second].hand.length)payments=[low,high];
   else if(g.seats[first].hand.length>g.seats[second].hand.length)payments=[high,low];
   else{const highSeat=order(g,g.dealer).find(index=>farmers.includes(index))!;payments=highSeat===first?[high,low]:[low,high];}
  }
  farmers.forEach((farmer,index)=>{const paid=coin(g.coins[farmer])<payments[index]?coin(g.coins[farmer]):payments[index];setCoin(g,farmer,coin(g.coins[farmer])-paid);addCoin(g,g.landlord,paid);});
 }else{const first=stake/2n,second=stake-first,high=stake%2n===1n?g.firstFinisher:-1;farmers.forEach(farmer=>addCoin(g,farmer,farmer===high?second:first));}
 g.seats.forEach((_,index)=>addCoin(g,index,1n));
 if(g.firstFinisher>=0)addCoin(g,g.firstFinisher,1n);
 settleAllIn(g,landlordWon,now);
 settleBet(g,landlordWon,now);
 const snapshot=g.coins.map(coin);
 const handCounts=g.seats.map(player=>player.hand.length),points=g.victoryPoints.map(Number),multiplier=doublePoints?2:1;
 if(landlordWon)points[g.landlord]+=1*multiplier;else farmers.forEach(farmer=>points[farmer]+=.5*multiplier);
 g.victoryPoints=points.map(value=>String(value));
 g.lossStreak=(g.lossStreak??['0','0','0']).map((value,seat)=>{
  const won=landlordWon?seat===g.landlord:farmers.includes(seat);
  if(!won)return owned(g,seat,'lucky-star')?String(Number(value)+1):'0';
  const losses=Number(value),star=held(g,seat,'lucky-star');
  if(star&&losses>=3){equipmentReward(g,seat,BigInt(Math.min(losses+1,5)),now,'lucky-star');removeEquipment(g,seat,'lucky-star');}
  return '0';
 });
 const maxCoins=snapshot.reduce((a,b)=>a>b?a:b,0n);
 for(let seat=0;seat<3;seat++){
  const winnerSide=landlordWon?seat===g.landlord:farmers.includes(seat);
  if(handCounts[seat]<=5&&owned(g,seat,'endgame-change')&&!used(g,seat,'endgame-change')){mark(g,seat,'endgame-change');equipmentReward(g,seat,1n,now,'endgame-change');}
  if(!winnerSide&&handCounts[seat]>0&&handCounts[seat]<=5&&owned(g,seat,'no-chase')&&!used(g,seat,'no-chase')){mark(g,seat,'no-chase');equipmentReward(g,seat,1n,now,'no-chase');}
  if(g.seats[seat].plays>0&&(g.maxPlayed?.[seat]??0)<=3&&owned(g,seat,'solo-diet')&&!used(g,seat,'solo-diet')){mark(g,seat,'solo-diet');equipmentReward(g,seat,3n,now,'solo-diet');}
  if(snapshot[seat]===maxCoins&&owned(g,seat,'richest')&&!used(g,seat,'richest')){mark(g,seat,'richest');equipmentReward(g,seat,1n,now,'richest');}
  const interest=snapshot[seat]/4n;
  if(interest>0n&&owned(g,seat,'interest')&&!used(g,seat,'interest')){mark(g,seat,'interest');equipmentReward(g,seat,interest>2n?2n:interest,now,'interest');}
  if(snapshot[seat]<maxCoins&&owned(g,seat,'airdrop')){if(tableCount(g,`airdrop:${seat}`)<3){tableMark(g,`airdrop:${seat}`);equipmentReward(g,seat,5n,now,'airdrop');}}
 }
 const holdBet=g.betIsSet;
 if(holdBet){
  const bettorWon=landlordWon?holdBet.seat===g.landlord:farmers.includes(holdBet.seat);
  if(bettorWon){addCoin(g,holdBet.seat,2n);equipmentReward(g,holdBet.seat,2n,now,'bet-is-set');notice(g,`${g.seats[holdBet.seat].name} 的买定离手成立，托管与奖励各 2 金币`,now,'bet-is-set');}
  else notice(g,`${g.seats[holdBet.seat].name} 的买定离手失败，托管 2 金币移出本局`,now,'bet-is-set');
  g.betIsSet=undefined;
 }
 const reached=points.map((value,index)=>value>=4?index:-1).filter(index=>index>=0);
 if(reached.length){g.champion=reached.length===1?reached[0]:g.firstFinisher;note(g,`${g.seats[g.champion].name} 达到 4 胜利点，获得整桌胜利`,now);}
 else if(g.roundNumber===12){const lowest=Math.min(...points);points.forEach((value,index)=>{if(value===lowest)addCoin(g,index,8n);});note(g,'12 局结束，最低胜利点玩家获得 8 金币，进入突然死亡',now);}
 g.pending=[];g.pendingEffect=undefined;
}
function finishSuddenDeath(g:V3Game,winner:number,now:number){g.champion=winner;note(g,`${g.seats[winner].name} 首位出完牌，获得整桌胜利`,now);}
function endRound(g:V3Game,winner:number,now:number,doublePoints=false){
 g.winner=winner;g.phase='finished';g.deadline=0;g.deltas=[0,0,0];
 if(g.suddenDeath)finishSuddenDeath(g,winner,now);else settleV3(g,winner,now,doublePoints);
 g.roundHistory.push({round:g.roundNumber,suddenDeath:g.suddenDeath,winner,landlord:g.landlord,victoryPoints:[...g.victoryPoints],coins:[...g.coins]});
}
function nextWithCards(g:V3Game,seat:number){return [0,1,2].map(offset=>(seat+offset)%3).find(index=>g.seats[index].hand.length>0)??seat;}
function leadTurn(g:V3Game,seat:number,now:number){
 // 两人都不出后把牌权交还给上一名出牌者：必须清空上一手，否则领出者仍被要求压过自己的牌型，也无法在超时自动操作时领出。
 g.passes=0;g.passStreak=[false,false,false];g.last=null;g.seats.forEach(player=>player.last='');g.tableActions=[null,null,null];g.deadline=now+g.seconds*1000;
 if(!g.seats[seat].hand.length){endRound(g,seat,now);return;}
 g.turn=seat;queue(g,{seat,kind:'target'});nextEffect(g,now);
}
function continueTurn(g:V3Game,seat:number,now:number){g.turn=nextWithCards(g,next(seat));g.tableActions[g.turn]=null;g.deadline=now+g.seconds*1000;queue(g,{seat:g.turn,kind:'target'});nextEffect(g,now);}
function grantLeadIfReady(g:V3Game,seat:number,now:number){
 const eligible=(['return-lead','follow-through'] as const).filter(id=>owned(g,seat,id)&&!used(g,seat,id));
 if(!eligible.length)return false;
 queue(g,...eligible.map(id=>({seat,kind:'lead' as const})));
 return nextEffect(g,now);
}
function continueAfterPlay(g:V3Game,seat:number,now:number){
 if(!g.seats[seat].hand.length){g.firstFinisher=seat;endRound(g,seat,now);return;}
 g.passStreak=[false,false,false];
 continueTurn(g,seat,now);
}
function afterPlay(g:V3Game,seat:number,now:number){
 const combo=g.last?.combo,empty=g.seats[seat].hand.length===0;
 const effects:V3Effect[]=[];
 if(!empty&&combo&&(combo.kind==='顺子'||combo.kind==='连对')&&owned(g,seat,'aftershock')&&!used(g,seat,'aftershock'))effects.push({seat,kind:'aftershock',max:2});
 if(!empty&&combo&&(combo.kind==='三带二'||combo.kind==='四带二')&&owned(g,seat,'take-the-lot')&&(g.equipmentUsed??=[]).filter(entry=>entry.startsWith(`${seat}:take-the-lot`)).length<3)effects.push({seat,kind:'discard',max:1});
 if(combo?.kind==='四带二'&&owned(g,seat,'four-with-two-pass')&&!used(g,seat,'four-with-two-pass'))effects.push({seat,kind:'transfer'});
 if(combo&&(combo.kind==='炸弹'||combo.kind==='王炸')){
  const bomb=familyEquipment(g,seat,'bomb');
  if(bomb&&!used(g,seat,'bomb')&&!(bomb.id!=='bomb-4'&&combo.kind==='王炸'))effects.push({seat,kind:'bomb',max:bomb.id==='bomb-4'?4:bomb.level});
 }
 if(!empty&&owned(g,seat,'thirteen')&&!used(g,seat,'thirteen')&&g.seats[seat].hand.length===13)effects.push({seat,kind:'thirteen',max:13});
 queue(g,...effects);
 // 借光是别人的被动窗口：本家主动与被动效果结算完之后再询问，终局出牌不触发。
 if(!empty)for(const target of order(g,g.dealer).filter(index=>index!==seat))if(valid(g,{seat:target,kind:'borrowed'}))queue(g,{seat:target,kind:'borrowed'});
 if(nextEffect(g,now))return; continueAfterPlay(g,seat,now);
}
export function resolveV3Equipment(g:V3Game,seat:number,cards:unknown,now=Date.now(),extra:V3Action={}){
 const pending=g.pendingEffect; if(g.phase!=='equipment'||!pending||pending.seat!==seat)throw Error('当前没有可处理的装备效果');
 if(!Array.isArray(cards)||cards.some(card=>!Number.isSafeInteger(card))||new Set(cards).size!==cards.length)throw Error('请选择不重复的手牌');
 // 效果种类以服务端队列里的 pendingEffect 为准；客户端只提交手牌、选项和目标。
 // 同一种效果只保留一套实现，避免「按钮路径」与「默认路径」出现两套不同规则。
 const skip=extra.choice==='skip',picked:number[]=skip?[]:cards;
 const hand=g.seats[seat].hand;
 const finish=(actor=g.last?.seat??seat)=>{nextEffect(g,now);if(g.phase==='equipment')return;if(!g.seats[actor].hand.length){g.firstFinisher=actor;endRound(g,actor,now);return;}continueAfterPlay(g,actor,now);};
 const discardFor=(kind:'bomb'|'aftershock'|'thirteen'|'discard',max:number)=>{
  if(picked.length){
   if(picked.some(card=>!hand.includes(card)))throw Error('只能弃掉自己的手牌');
   if(kind==='thirteen'){if(picked.some(card=>rank(card)>=16)||picked.reduce((sum,card)=>sum+thirteenValue(card),0)!==13)throw Error('13 恐惧症需要弃掉点数和为 13 的非王牌');}
   else{
    if(kind==='discard'&&picked.some(card=>isVirtualCard(card)))throw Error('我全都要只能弃置实体手牌');
    if(picked.length>max)throw Error('弃牌数量不符合装备要求');
   }
   g.seats[seat].hand=hand.filter(card=>!picked.includes(card));
   if(kind==='discard')markUse(g,seat,'take-the-lot');else mark(g,seat,kind);
   const id=kind==='discard'?'take-the-lot':kind==='bomb'?familyEquipment(g,seat,'bomb')?.id:kind;
   notice(g,`${g.seats[seat].name} 的${catalog(g,id??'')?.name??'装备'}发动：公开弃掉 ${cardFaces(picked)}`,now,id);
   if(!g.seats[seat].hand.length){g.firstFinisher=seat;endRound(g,seat,now);return;}
  }else if(kind!=='discard')mark(g,seat,kind);
  finish();
 };
 const borrowFor=()=>{
  if(picked.length){
   if(picked.length!==1||!hand.includes(picked[0]))throw Error('借光只能弃掉自己手中的 1 张牌');
   if(hand.length<=1)throw Error('借光弃牌后必须仍有至少 1 张手牌');
   const value=rank(picked[0]),recent=g.last?.cards??[];
   if(!recent.some(card=>rank(card)===value))throw Error('只能弃掉与上一次出牌点数相同的牌');
   g.seats[seat].hand=hand.filter(card=>card!==picked[0]);markUse(g,seat,'borrowed-light');
   notice(g,`${g.seats[seat].name} 的借光发动：公开弃掉 ${face(picked[0])}`,now,'borrowed-light');
   if(!g.seats[seat].hand.length){g.firstFinisher=seat;endRound(g,seat,now);return;}
  }else note(g,`${g.seats[seat].name} 放弃借光`,now);
  // 借光是别人出牌后的被动窗口：回合仍要从出牌者继续，不能跳过下一名玩家。
  finish(g.last?.seat??seat);
 };
 const transferFor=()=>{
  if(picked.length){
   const target=typeof extra.target==='number'?extra.target:-1;
   if(!Number.isInteger(target)||target<0||target>2||target===seat)throw Error('请选择一名其他玩家作为转移目标');
   const played=g.last?.cards??[],combo=g.last?.combo;
   if(!combo||combo.kind!=='四带二')throw Error('当前没有四带二出牌');
   const singles=played.filter(card=>rank(card)!==combo.rank);
   if(picked.length!==2||new Set(picked).size!==2||picked.some(card=>!singles.includes(card)))throw Error('只能转移本次四带二中的两张单牌带牌');
   g.seats[target].hand=sorted([...g.seats[target].hand,...picked]);
   g.revealed=[...(g.revealed??[]),...picked.map(card=>({card,from:seat}))];
   mark(g,seat,'four-with-two-pass');
   notice(g,`${g.seats[seat].name} 的王の四带二发动：把 ${cardFaces(picked)} 转给 ${g.seats[target].name}`,now,'four-with-two-pass');
  }else mark(g,seat,'four-with-two-pass');
  finish();
 };
 switch(pending.kind){
  case 'stake':{
   stakeV3(g,seat,!skip&&(extra.choice==='use'||extra.choice===true),now);
   if(!g.pendingEffect)g.phase='playing';
   return;
  }
  case 'bet':{
   const choice=skip?undefined:extra.choice;
   if(choice==='hold')placeV3Bet(g,seat,undefined,now,'hold');
   else if(choice==='landlord'||choice==='farmers')placeV3Bet(g,seat,choice,now,'side');
   else skipV3Bet(g,seat,'equipment',now);
   nextEffect(g,now);
   if(!g.pendingEffect){if(g.landlord>=0)g.phase='playing';else beginBidding(g,now);}
   return;
  }
  case 'reveal':{
   if(picked.length){
    if(picked.length>pending.max)throw Error('站起来跟他打最多弃置 5 张实体手牌');
    if(picked.some(card=>!hand.includes(card)))throw Error('只能弃掉自己的手牌');
    if(picked.some(card=>isVirtualCard(card)))throw Error('站起来跟他打只能弃置实体手牌');
    if(hand.length-picked.length<1)throw Error('弃牌后必须保留至少 1 张手牌');
    g.seats[seat].hand=hand.filter(card=>!picked.includes(card));mark(g,seat,'stand-up-fight');
    notice(g,`${g.seats[seat].name} 的站起来跟他打发动：公开弃掉 ${cardFaces(picked)}，本局手牌对其他两人可见`,now,'stand-up-fight');
   }
   nextEffect(g,now);if(!g.pendingEffect)g.phase='playing';
   return;
  }
  case 'target':{
   const target=typeof extra.target==='number'?extra.target:-1;
   if(skip||target<0){mark(g,seat,'cut-off-income');note(g,`${g.seats[seat].name} 放弃断你财路`,now);}
   else{
    if(!Number.isInteger(target)||target>2||target===seat)throw Error('请选择一名仍在局内的对手');
    if(!g.seats[target].hand.length)throw Error('目标必须仍在局内');
    mark(g,seat,'cut-off-income');g.cutIncome={seat,source:target};
    notice(g,`${g.seats[seat].name} 的断你财路发动：目标 ${g.seats[target].name}，本局他的装备金币减半`,now,'cut-off-income');
   }
   nextEffect(g,now);if(!g.pendingEffect)g.phase='playing';
   return;
  }
  case 'lead':{
   if(picked.length){
    if(picked.length!==1||!hand.includes(picked[0]))throw Error('领出前只能弃掉 1 张手牌');
    const id=owned(g,seat,'return-lead')&&!used(g,seat,'return-lead')?'return-lead':'follow-through';
    g.seats[seat].hand=hand.filter(card=>card!==picked[0]);mark(g,seat,id);
    notice(g,`${g.seats[seat].name} 的${catalog(g,id)?.name}发动：公开弃掉 ${face(picked[0])}，重新领出`,now,id);
    if(!g.seats[seat].hand.length){g.firstFinisher=seat;endRound(g,seat,now);return;}
   }
   nextEffect(g,now);if(!g.pendingEffect)leadTurn(g,seat,now);
   return;
  }
  case 'borrowed':borrowFor();return;
  case 'transfer':transferFor();return;
  case 'bomb':case 'aftershock':case 'thirteen':case 'discard':
   discardFor(pending.kind,pending.kind==='thirteen'?1:pending.max);return;
  default:throw Error('开局装备请在开局窗口中处理');
 }
}
function thirteenValue(card:number){const value=rank(card);return value===14?1:value===15?2:value;}
function applyShadow(g:V3Game,seat:number,cards:number[],mapping:unknown,now:number){
 const bits=Number(mapping);
 if(!Number.isInteger(bits)||bits<=0)return undefined;
 if(!owned(g,seat,'shadow-rank'))throw Error('没有影子牌装备，不能声明点数映射');
 const perPlay=catalog(g,'shadow-rank')?.map??2,declared=cards.filter((_,index)=>((bits>>index)&1)===1);
 if(!declared.length)return undefined;
 if(declared.length>perPlay)throw Error(`影子牌每次出牌最多映射 ${perPlay} 张牌`);
 if(declared.some(card=>rank(card)>=16))throw Error('王不能被映射');
 const targets=[...new Set(declared.flatMap(card=>[rank(card)+1,rank(card)-1]))].filter(value=>value>=3&&value<=14);
 const maps=declared.map((card:number)=>card*100+rank(card));
 let chosen=maps;
 for(const target of targets){
  // 2 只能映射为 3--2 范围内的相邻点数，不能映射为 A。
  if(target===14&&declared.some(card=>rank(card)===15))continue;
  const candidate=declared.map((card:number)=>card*100+target);
  if(classifyV3(g,seat,cards,candidate)){chosen=candidate;break;}
 }
 if(chosen.every((token,index)=>token%100===rank(declared[index])))throw Error('映射后必须构成标准既有牌型，且结果仍在 3--2 范围内');
 g.mapUsed=[...(g.mapUsed??[]),...declared.map(String)];
 notice(g,`${g.seats[seat].name} 声明影子牌：${declared.map((card,index)=>`${face(card)}→${rankLabel(chosen[index]%100)}`).join('、')}`,now,'shadow-rank');
 return chosen;
}
/** 影子牌：无需声明。原始牌型已经能压过上一手时不动它；只有打不出去时，才挑一个能压过的相邻点数映射。 */
function shadowMaps(g:V3Game,seat:number,cards:number[]):number[]|undefined{
 if(!owned(g,seat,'shadow-rank'))return undefined;
 const last=g.last?.combo??null,plain=comboOf(g,seat,cards);
 if(plain&&beats(plain,last))return undefined;
 const perPlay=catalog(g,'shadow-rank')?.map??2;
 const weight=(combo:Combo)=>combo.kind==='王炸'?3:combo.kind==='炸弹'?2:1;
 const pool=cards.map((card,index)=>({card,index})).filter(entry=>rank(entry.card)<=14);
 let best:{maps:number[];combo:Combo}|undefined;
 const consider=(pick:{card:number;index:number}[],values:number[])=>{
  const maps=pick.map((entry,position)=>entry.card*100+values[position]);
  // 只用映射后的牌面判定：映射必须自己成立，不能借原始牌型蒙混过关。
  const combo=comboOf(g,seat,applyMaps(cards,maps));
  if(!combo||!beats(combo,last))return;
  if(!best||combo.rank>best.combo.rank||(combo.rank===best.combo.rank&&weight(combo)>weight(best.combo)))best={maps,combo};
 };
 const options=(entry:{card:number;index:number})=>[rank(entry.card)-1,rank(entry.card)+1].filter(value=>value>=3&&value<=14);
 for(let first=0;first<pool.length;first++){
  if(perPlay<1)break;
  const single=pool[first],singleOptions=options(single);
  for(const value of singleOptions)consider([single],[value]);
  if(perPlay<2)continue;
  for(let second=first+1;second<pool.length;second++){
   const pair=[single,pool[second]];
   for(const value of singleOptions)for(const other of options(pair[1]))consider(pair,[value,other]);
  }
 }
 if(!best)return undefined;
 return best.maps;
}
function autoShadow(g:V3Game,seat:number,cards:number[],now:number):number[]|undefined{
 const maps=shadowMaps(g,seat,cards);
 if(maps)notice(g,`${g.seats[seat].name} 的影子牌发动：${maps.map(token=>`${face(Math.floor(token/100))}→${rankLabel(token%100)}`).join('、')}`,now,'shadow-rank');
 return maps;
}
/** 出牌按钮用的判定：和 playV3 走同一套牌型逻辑（含影子牌映射、史密斯夫妇替代、接龙），只读、不写状态。 */
export function selectionCombo(g:V3Game,seat:number,cards:number[]):Combo|null{
 if(seat<0||seat>=g.seats.length||!cards.length)return null;
 if(cards.some(card=>!Number.isSafeInteger(card))||new Set(cards).size!==cards.length)return null;
 return classifyV3(g,seat,cards,shadowMaps(g,seat,cards));
}
export function playV3(g:V3Game,seat:number,cards:number[],now=Date.now(),mapping?:unknown){
 if(g.phase!=='playing'||g.turn!==seat)throw Error('还没轮到你出牌');
 if(!Array.isArray(cards)||cards.some(card=>!Number.isSafeInteger(card))||new Set(cards).size!==cards.length)throw Error('请选择不重复的手牌');
 const player=g.seats[seat],a=actions(g);
 if(!cards.length){
  if(!g.last||g.last.seat===seat)throw Error('新一轮必须出牌');
  player.last='不出';a[seat]={kind:'pass'};
  const streak=(g.passStreak??[false,false,false]).slice();streak[seat]=true;g.passStreak=streak;
  g.passes=(g.passes??0)+1;g.tableActions=a;
  if(g.passes>=2){
   const leader=g.last.seat;
   const passedTwice=(g.passStreak??[]).filter(Boolean).length>=2;
   if(g.seats[leader].hand.length===0){endRound(g,leader,now);return;}
   if(passedTwice&&grantLeadIfReady(g,leader,now))return;
   leadTurn(g,leader,now);return;
  }  continueTurn(g,seat,now);return;
 }
 if(cards.some(card=>!player.hand.includes(card)))throw Error('只能出自己手中的牌');
 const maps=mapping===undefined?autoShadow(g,seat,cards,now):applyShadow(g,seat,cards,mapping,now);
 const combo=classifyV3(g,seat,cards,maps);
 if(!combo)throw Error('这些牌不能组成合法牌型');
 if(!beats(combo,g.last?.combo??null))throw Error('需要出相同牌型中更大的牌，或使用炸弹');
 if(combo.kind==='顺子'&&!classify(applyMaps(cards,maps)))mark(g,seat,'skip-straight');
 player.hand=player.hand.filter(card=>!cards.includes(card));player.plays++;player.last=combo.kind;
 g.maxPlayed=g.maxPlayed??[0,0,0];g.maxPlayed[seat]=Math.max(g.maxPlayed[seat]??0,cards.length);
 a[seat]={kind:'play',cards:sorted(cards),label:combo.kind,...(DDZ_EFFECTS[combo.kind]?{eventId:emitVisual(g,seat,DDZ_EFFECTS[combo.kind],now)}:{})};
 g.last={seat,cards:sorted(cards),combo};g.passes=0;g.tableActions=a;
 g.passStreak=[false,false,false];
 note(g,`${player.name}：${combo.kind} ${cardFaces(cards)}`,now);
 if(owned(g,seat,'smith')){const plain=classify(cards);if(!plain||plain.kind!==combo.kind||plain.rank!==combo.rank)notice(g,`${player.name} 的史密斯夫妇发动：J 与 Q 互换后按「${combo.kind} ${rankLabel(combo.rank)}」结算`,now,'smith');}
 if(combo.kind==='王炸'&&owned(g,seat,'rocket-win')&&!g.rocketUsed){g.rocketUsed=true;g.firstFinisher=seat;notice(g,`${player.name} 的王炸！！！发动：立即结算本局胜利`,now,'rocket-win');endRound(g,seat,now,true);return;}
 afterPlay(g,seat,now);
}
/** Equipment windows that can end a hand still settle through the same win path. */
export function timeoutV3(g:V3Game,now=Date.now()){
 if(g.deadline>now||!['shopping','bidding','playing','equipment'].includes(g.phase))return false;
 if(g.phase==='shopping'){for(let seat=0;seat<3;seat++)if(g.seats[seat].last!=='商店完成')finishShopping(g,seat,now);return true;}
 if(g.phase==='bidding'){bidV3(g,g.turn,false,now);return true;} if(g.phase==='equipment'){
  const pending=g.pendingEffect!;
  if(pending.kind==='opening')skipV3OpeningEquipment(g,pending.seat,now);
  else if(pending.kind==='stake')stakeV3(g,pending.seat,false,now);
  else resolveV3Equipment(g,pending.seat,[],now);
  return true;
 }
 const seat=g.turn;playV3(g,seat,g.last?[]:[sorted(g.seats[seat].hand).at(-1)!],now);return true;
}
export function v3BotAction(g:V3Game,seat:number,now=Date.now()){
 if(g.phase==='shopping'){
  for(const offer of g.shops[seat].offers)if(!offer.bought&&coin(g.coins[seat])>=coin(offer.price)&&g.equipment[seat].length<8){try{buyV3Equipment(g,seat,offer.offerId,now);}catch{}}
  if(g.phase==='shopping')finishShopping(g,seat,now);
  return;
 }
 if(g.phase==='bidding'){bidV3(g,seat,!used(g,seat,'no-bid')&&coin(g.coins[seat])>coin(g.stake),now);return;}
 if(g.phase==='equipment'){
  const pending=g.pendingEffect;
  if(pending?.kind==='opening')skipV3OpeningEquipment(g,seat,now);
  else if(pending?.kind==='stake')stakeV3(g,seat,false,now);
  else resolveV3Equipment(g,seat,[],now);
  return;
 }
 const options=hints(g.seats[seat].hand,g.last?.combo??null);playV3(g,seat,options.length?options[0]:[],now);
}
function peekedSeat(g:V3Game){return typeof g.peekedSeat==='number'?g.peekedSeat:-1;}
export function viewV3(g:V3Game,id:string){
 const own=g.seats.findIndex(player=>player.id===id);
 const faceUp=g.seats.map((_,index)=>used(g,index,'stand-up-fight'));
 const view:V3Game&{peeked?:number[]}=Object.assign({},g,{visualEvents:publicVisuals(g),tableActions:actions(g),peeked:undefined,bottom:[...g.bottom],shops:g.shops.map(shop=>({offers:shop.offers.map(offer=>({...offer}))})),equipment:g.equipment.map(items=>items.map(item=>({...item}))),seats:g.seats.map(player=>({...player,hand:[...player.hand]}))});
 const peeks=g.privatePeeks?.[String(own)]??(peekedSeat(g)===own?g.peeked??[]:[]);
 delete view.privatePeeks;delete view.peekedSeat;delete view.pending;delete view.effectResumeTurn;
 // 竞价期间底牌必须保密：只有「看底牌」指定的那一张，持有者才看得到。
 if(g.phase==='shopping'||g.phase==='bidding'||g.phase==='equipment'&&g.landlord<0)view.bottom=g.bottom.map((card,index)=>g.phase!=='shopping'&&peeks.includes(index)?card:-1);
 view.seats[own]={...g.seats[own],count:g.seats[own].hand.length,hand:g.phase==='shopping'?[]:[...g.seats[own].hand]} as typeof view.seats[number]; for(let seat=0;seat<view.seats.length;seat++){
  if(seat===own)continue;
  view.shops[seat]={offers:[]};
  view.equipment[seat]=g.equipment[seat].map(item=>({id:item.id,level:item.level})) as V3Equipment[];
  const face=faceUp[seat]&&g.phase!=='shopping';
  view.seats[seat]={...g.seats[seat],count:g.seats[seat].hand.length,hand:g.phase==='finished'||face?g.seats[seat].hand:[]} as typeof view.seats[number];
 }
 return view;
}
