import type {Practice} from '../practice/types.ts';
import {emitVisual,publicVisuals,DDZ_EFFECTS,type VisualEvent} from '../motion/events.ts';
export type LandlordRules={id:'landlord-v2'|'landlord-v4';allowDouble:boolean;bombDouble:boolean;springDouble:boolean};
export const DEFAULT_LANDLORD_RULES:LandlordRules={id:'landlord-v4',allowDouble:true,bombDouble:true,springDouble:true};
/** Saved v2 and unversioned rooms keep their original deal and reveal timing. */
export const blindDouble=(g:Pick<Game,'rules'>)=>g.rules?.id==='landlord-v4';
export function landlordRules(v:unknown):LandlordRules{if(v===undefined)return {...DEFAULT_LANDLORD_RULES};if(!v||typeof v!=='object'||Array.isArray(v))throw Error('房间规则无效');const r={...DEFAULT_LANDLORD_RULES};for(const key of ['allowDouble','bombDouble','springDouble'] as const){if(key in v){const value=(v as Record<string,unknown>)[key];if(typeof value!=='boolean')throw Error('规则开关必须为是或否');r[key]=value;}}return r;}
export type Combo = {kind:string; rank:number; size:number; chain:number};
export type Seat = {id:string; name:string; hand:number[]; ready:boolean; plays:number; last:string;bot?:boolean};
export type TableAction={kind:'play';cards:number[];label:string;eventId?:string}|{kind:'pass'}|{kind:'bid';value:number}|{kind:'double';value:boolean};
export type Game = {visualEvents?:VisualEvent[];rules?:LandlordRules;doubles?:(boolean|null)[];tableActions?:(TableAction|null)[];practice?:Practice;phase:'waiting'|'bidding'|'doubling'|'playing'|'finished'|'closed'; seats:Seat[]; host:string; bottom:number[]; turn:number; landlord:number; bid:number; bidPasses:number; passes:number; last:{seat:number; cards:number[]; combo:Combo}|null; multiplier:number; deadline:number; seconds:number; round:string; winner:number; spring:boolean; deltas:number[]; log:{text:string; at:number}[]};
/** Virtual cards are unique, private hand instances used by landlord-v3 copies. */
export const VIRTUAL_CARD_BASE=100000;
export const virtualCard=(value:number,serial:number)=>VIRTUAL_CARD_BASE+serial*32+value;
export const isVirtualCard=(c:number)=>c>=VIRTUAL_CARD_BASE;
export const rank=(c:number)=>isVirtualCard(c)?c%32:c<52?Math.floor(c/4)+3:c===52?16:17;
export const face=(c:number)=>({11:'J',12:'Q',13:'K',14:'A',15:'2',16:'小王',17:'大王'}[rank(c)]||String(rank(c)));
export const suit=(c:number)=>isVirtualCard(c)?'◇':c>=52?'★':['♠','♥','♣','♦'][c%4];
export const sorted=(cards:number[])=>[...cards].sort((a,b)=>rank(b)-rank(a)||a-b);
function groups(cards:number[]){const g=new Map<number,number[]>();for(const c of cards)g.set(rank(c),[...(g.get(rank(c))||[]),c]);return [...g.entries()].sort((a,b)=>a[0]-b[0]);}
const sequential=(r:number[])=>r.length>0&&r.at(-1)!<=14&&r.every((v,i)=>i===0||v===r[i-1]+1);
export function classify(cards:number[]):Combo|null{
 if(!cards.length||cards.length>20||new Set(cards).size!==cards.length||cards.some(c=>!Number.isInteger(c)||c<0||(!isVirtualCard(c)&&c>53)||rank(c)<3||rank(c)>17))return null;
 const n=cards.length,g=groups(cards),r=g.map(x=>x[0]),counts=g.map(x=>x[1].length);const make=(kind:string,key:number,chain=1)=>({kind,rank:key,size:n,chain});
 if(n===1)return make('单张',r[0]);
 if(n===2&&r[0]===16&&r[1]===17&&cards.every(c=>!isVirtualCard(c)))return make('王炸',17);
 if(g.length===1&&n<=4)return make(n===2?'对子':n===3?'三张':'炸弹',r[0]);
 if(n===4&&counts.includes(3))return make('三带一',r[counts.indexOf(3)]);
 if(n===5&&counts.includes(3)&&counts.includes(2))return make('三带二',r[counts.indexOf(3)]);
 if(n>=5&&counts.every(c=>c===1)&&sequential(r))return make('顺子',r.at(-1)!,n);
 if(n>=6&&n%2===0&&counts.every(c=>c===2)&&sequential(r))return make('连对',r.at(-1)!,n/2);
 if(n>=6&&n%3===0&&counts.every(c=>c===3)&&sequential(r))return make('飞机',r.at(-1)!,n/3);
 for(const wing of [1,2]){const m=n/(3+wing);if(!Number.isInteger(m)||m<2)continue;for(let start=3;start+m-1<=14;start++){const body=Array.from({length:m},(_,i)=>start+i);if(!body.every(x=>g.some(([v,cs])=>v===x&&cs.length===3)))continue;const rest=g.filter(([v])=>!body.includes(v));if(wing===1&&rest.reduce((a,[,cs])=>a+cs.length,0)===m&&rest.every(([,cs])=>cs.length<=2)&&!(rest.some(([v])=>v===16)&&rest.some(([v])=>v===17)))return make('飞机带单',start+m-1,m);if(wing===2&&rest.length===m&&rest.every(([,cs])=>cs.length===2))return make('飞机带对',start+m-1,m);}}
 if(counts.includes(4)){const q=r[counts.indexOf(4)],rest=g.filter(([v])=>v!==q);if(n===6&&rest.every(([,cs])=>cs.length<=2)&&!(r.includes(16)&&r.includes(17)))return make('四带二',q);if(n===8&&rest.length===2&&rest.every(([,cs])=>cs.length===2))return make('四带两对',q);}
 return null;
}
export function beats(a:Combo,b:Combo|null){if(!b)return true;if(b.kind==='王炸')return false;if(a.kind==='王炸')return true;if(a.kind==='炸弹'&&b.kind!=='炸弹')return true;return a.kind===b.kind&&a.size===b.size&&a.chain===b.chain&&a.rank>b.rank;}
export function hints(hand:number[],last:Combo|null):number[][]{
 const g=groups(hand),out:number[][]=[];const add=(cs:number[])=>{const c=classify(cs);if(c&&beats(c,last))out.push(sorted(cs));};
 for(const [,cs] of g){for(let n=1;n<=cs.length;n++)add(cs.slice(0,n));if(cs.length>=3)for(const [v,other]of g)if(v!==rank(cs[0])){add([...cs.slice(0,3),other[0]]);if(other.length>=2)add([...cs.slice(0,3),...other.slice(0,2)]);}}
 if(hand.includes(52)&&hand.includes(53))add([52,53]);
 const wings=(body:number[],m:number,pair:boolean)=>{const rest=g.filter(([v])=>!body.some(c=>rank(c)===v));if(pair){const ps=rest.filter(([,cs])=>cs.length>=2);if(ps.length>=m)add([...body,...ps.slice(0,m).flatMap(([,cs])=>cs.slice(0,2))]);}else{let cs=rest.flatMap(([,cs])=>cs.slice(0,2));if(cs.includes(52)&&cs.includes(53))cs=cs.filter(c=>c!==53);if(cs.length>=m)add([...body,...cs.slice(0,m)]);}};
 for(let width=1;width<=3;width++)for(let start=3;start<=14;start++){let cs:number[]=[];for(let end=start;end<=14;end++){const group=g.find(([v])=>v===end)?.[1];if(!group||group.length<width)break;cs.push(...group.slice(0,width));const m=end-start+1;if(m>=(width===1?5:width===2?3:2)){add(cs);if(width===3){wings(cs,m,false);wings(cs,m,true);}}}}
 for(const [,cs]of g)if(cs.length===4){wings(cs,2,false);wings(cs,2,true);}
 const unique=[...new Map(out.map(cs=>[cs.join(','),cs])).values()];return unique.sort((a,b)=>{const x=classify(a)!,y=classify(b)!;return (x.kind==='王炸'?2:x.kind==='炸弹'?1:0)-(y.kind==='王炸'?2:y.kind==='炸弹'?1:0)||a.length-b.length||x.rank-y.rank;});
}
export function newGame(host:string,name:string,seconds=30):Game{return{phase:'waiting',seats:[{id:host,name,hand:[],ready:false,plays:0,last:''}],host,bottom:[],turn:0,landlord:-1,bid:0,bidPasses:0,passes:0,last:null,multiplier:1,deadline:0,seconds,round:'',winner:-1,spring:false,deltas:[],log:[]};}
function rand(n:number){const max=Math.floor(0x100000000/n)*n;let v;do{v=crypto.getRandomValues(new Uint32Array(1))[0];}while(v>=max);return v%n;}
function note(g:Game,text:string,now:number){g.log.push({text,at:now});g.log=g.log.slice(-250);}
export function deal(g:Game,now=Date.now()){
 if(g.seats.length!==3)throw Error('需要三人入座');
 const deck=Array.from({length:54},(_,i)=>i);for(let i=53;i>0;i--){const j=rand(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
 g.seats.forEach((s,i)=>{s.hand=sorted(deck.slice(i*17,i*17+17));s.plays=0;s.last='';s.ready=false;});g.tableActions=[null,null,null];g.doubles=[null,null,null];g.bottom=deck.slice(51);g.phase='bidding';g.turn=rand(3);g.landlord=-1;g.bid=0;g.bidPasses=0;g.passes=0;g.last=null;g.multiplier=1;g.round=crypto.randomUUID();g.visualEvents=[];g.winner=-1;g.spring=false;g.deltas=[];g.deadline=now+g.seconds*1000;g.log=[];note(g,'发牌完成，开始叫分',now);
}
export function bid(g:Game,seat:number,value:number,now=Date.now()){
 if(g.phase!=='bidding'||g.turn!==seat)throw Error('还没轮到你叫分');
 if(!Number.isInteger(value)||value<0||value>3||(value!==0&&value<=g.bid))throw Error('叫分必须高于当前分数');
 const s=g.seats[seat];const actions=tableActions(g);actions[seat]={kind:'bid',value};s.last=value?`${value} 分`:'不叫';note(g,`${s.name} ${s.last}`,now);
 if(value){g.bid=value;g.landlord=seat;g.bidPasses=0;}else g.bidPasses++;
 if(g.bid===0&&g.bidPasses===3){deal(g,now);note(g,'无人叫分，重新发牌',now);return;}
 if(value===3||(g.bid>0&&g.bidPasses===2)){g.phase=g.rules?.allowDouble?'doubling':'playing';g.turn=g.landlord;if(g.phase==='playing'||!blindDouble(g))g.seats[g.landlord].hand=sorted([...g.seats[g.landlord].hand,...g.bottom]);g.seats.forEach(s=>s.last='');note(g,`${g.seats[g.landlord].name} 成为地主`,now);}else g.turn=(seat+1)%3;
 if(g.phase==='playing'||g.phase==='doubling')actions.fill(null);else actions[g.turn]=null;g.tableActions=actions;g.deadline=now+g.seconds*1000;
}
/** Only reconstruct information that was already public in pre-layout rooms. */
export function tableActions(g:Game):(TableAction|null)[]{
 const actions=g.tableActions?g.tableActions.map(a=>a?.kind==='play'?{...a,cards:[...a.cards]}:a):g.seats.map((s,i)=>g.last?.seat===i?{kind:'play' as const,cards:[...g.last.cards],label:g.last.combo.kind}:s.last==='不出'?{kind:'pass' as const}:null);
 if(['playing','bidding'].includes(g.phase))actions[g.turn]=null;
 return actions;
}
export function play(g:Game,seat:number,cards:number[],now=Date.now()){
 if(g.phase!=='playing'||g.turn!==seat)throw Error('还没轮到你出牌');const s=g.seats[seat];const actions=tableActions(g);
 if(!cards.length){if(!g.last||g.last.seat===seat)throw Error('新一轮必须出牌');s.last='不出';actions[seat]={kind:'pass'};note(g,`${s.name} 不出`,now);g.passes++;if(g.passes===2){g.turn=g.last.seat;g.last=null;g.passes=0;g.seats.forEach(s=>s.last='');actions.fill(null);}else g.turn=(seat+1)%3;}
 else{if(cards.some(c=>!s.hand.includes(c)))throw Error('只能出自己手中的牌');const combo=classify(cards);if(!combo)throw Error('这些牌不能组成合法牌型');if(!beats(combo,g.last?.combo??null))throw Error('需要出相同牌型中更大的牌，或使用炸弹');s.hand=s.hand.filter(c=>!cards.includes(c));s.plays++;s.last=combo.kind;actions[seat]={kind:'play',cards:sorted(cards),label:combo.kind,...(DDZ_EFFECTS[combo.kind]?{eventId:emitVisual(g,seat,DDZ_EFFECTS[combo.kind],now)}:{})};g.last={seat,cards:sorted(cards),combo};g.passes=0;if(g.rules?.bombDouble!==false&&(combo.kind==='炸弹'||combo.kind==='王炸'))g.multiplier*=2;note(g,`${s.name}：${combo.kind} ${sorted(cards).map(face).join(' ')}`,now);
 if(!s.hand.length){g.phase='finished';g.winner=seat;const won=seat===g.landlord;g.spring=g.rules?.springDouble!==false&&(won?g.seats.every((s,i)=>i===g.landlord||s.plays===0):g.seats[g.landlord].plays===1);if(g.spring){g.multiplier*=2;emitVisual(g,seat,won?'spring':'anti-spring',now);}const unit=g.bid*g.multiplier;g.deltas=g.seats.map((_,i)=>i===g.landlord?0:-unit*(won?1:-1)*(g.doubles?.[g.landlord]?2:1)*(g.doubles?.[i]?2:1));g.deltas[g.landlord]=-g.deltas.reduce((a,b)=>a+b,0);note(g,`${won?'地主':'农民'}获胜${g.spring?' · 春天翻倍':''}`,now);}else g.turn=(seat+1)%3;
 }if(g.phase!=='finished')actions[g.turn]=null;g.tableActions=actions;g.deadline=g.phase==='finished'?0:now+g.seconds*1000;
}
export function doubleChoice(g:Game,seat:number,value:boolean,now=Date.now()){if(g.phase!=='doubling'||!g.rules?.allowDouble||seat<0||seat>=3||typeof value!=='boolean'||g.doubles?.[seat]!==null)throw Error('当前不能选择加倍');g.doubles![seat]=value;g.tableActions![seat]={kind:'double',value};g.seats[seat].last=value?'加倍 ×2':'不加倍';note(g,g.seats[seat].name+' '+g.seats[seat].last,now);if(g.doubles!.every(v=>v!==null)){if(blindDouble(g))g.seats[g.landlord].hand=sorted([...g.seats[g.landlord].hand,...g.bottom]);g.phase='playing';g.turn=g.landlord;g.deadline=now+g.seconds*1000;g.tableActions=[null,null,null];}else g.turn=g.doubles!.findIndex(v=>v===null);}
export function timeout(g:Game,now=Date.now()){if(g.deadline>now||!['bidding','doubling','playing'].includes(g.phase))return false;if(g.phase==='doubling'){for(let i=0;i<3;i++)if(g.doubles?.[i]===null)doubleChoice(g,i,false,now);}else if(g.phase==='bidding')bid(g,g.turn,0,now);else play(g,g.turn,g.last?[]:[sorted(g.seats[g.turn].hand).at(-1)!],now);return true;}
export function view(g:Game,id:string){return {...g,visualEvents:publicVisuals(g),tableActions:tableActions(g),seats:g.seats.map(s=>({...s,count:s.hand.length,hand:s.id===id||g.phase==='finished'?s.hand:[]})),bottom:g.phase==='bidding'||blindDouble(g)&&g.phase==='doubling'?[]:g.bottom};}
