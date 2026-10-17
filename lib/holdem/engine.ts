import type {FriendlyMatch} from '../friendly-match.ts';
import {evaluate,type HandValue} from './evaluate.ts';
export type Money=string;
export type HoldemRules={id:'holdem-v1'|'holdem-v2'|'holdem-v3'|'holdem-v4'|'holdem-v5';name:string;capacity:number;initial:Money;ante:Money;small:Money;big:Money;seconds:number};
export type HoldemSeatAction={id:string;kind:'fold'|'check'|'call'|'raise'|'allin';paid:Money;at:number;street:HoldemGame['street']};
export type HoldemSeat={id:string;name:string;bot:boolean;ready:boolean;hand:number[];stack:Money;brought:Money;bet:Money;total:Money;folded:boolean;allIn:boolean;actedAt:Money|null;last:string;action?:HoldemSeatAction;timeoutChoice?:HoldemTimeoutChoice};
export type Pot={amount:Money;eligible:number[];winners:number[];refund?:boolean};
export type HoldemResult={kind:'holdem';id:string;roundNumber:number;rules:HoldemRules;type:'showdown'|'fold'|'aborted';board:number[];button:number;pots:Pot[];seats:{id:string;name:string;bot:boolean;delta:Money;stack:Money;brought:Money;hand:number[];value:HandValue|null}[];ended:number};
export type HoldemGame={friendlyMatch?:FriendlyMatch;kind:'holdem';schemaVersion:1;rules:HoldemRules;host:string;seats:HoldemSeat[];phase:'waiting'|'playing'|'runout'|'finished'|'closed';street:'preflop'|'flop'|'turn'|'river';round:string;roundNumber:number;button:number;smallSeat:number;bigSeat:number;turn:number;deadline:number;deck:number[];burns:number[];board:number[];currentBet:Money;lastRaise:Money;roundStart:Money[];log:{text:string;at:number}[];result:HoldemResult|null;fixed:boolean;ended:number};
const n=(s:Money)=>BigInt(s),min=(a:bigint,b:bigint)=>a<b?a:b;
export function money(v:unknown,fallback:string,zero=false){const s=v===undefined?fallback:String(v);if(!/^(0|[1-9]\d{0,14})$/.test(s)||!zero&&s==='0'||typeof v==='number'&&!Number.isSafeInteger(v))throw Error('筹码请输入有效整数，最多 15 位');return s;}
function wager(v:unknown){const s=String(v);if(!/^(0|[1-9]\d{0,99})$/.test(s)||typeof v==='number'&&!Number.isSafeInteger(v))throw Error('加注请输入有效整数');return BigInt(s);}
export function holdemRules(b:{capacity?:unknown;initial?:unknown;ante?:unknown;small?:unknown;big?:unknown;seconds?:unknown}={}):HoldemRules{
 const capacity=b.capacity===undefined?6:b.capacity;if(!Number.isInteger(capacity)||Number(capacity)<4||Number(capacity)>10)throw Error('房间人数须为 4–10 人');
 const initial=money(b.initial,'1000'),ante=money(b.ante,'10',true),small=money(b.small,'20'),big=money(b.big,'30'),seconds=b.seconds===undefined?30:Number(b.seconds);
 if(n(small)>=n(big)||n(initial)<n(big)||n(ante)>n(small))throw Error('大盲须大于小盲，前注不得高于小盲，初始筹码须至少足够支付大盲');if(![15,30,45,60].includes(seconds))throw Error('请选择有效的操作时限');
 return {id:'holdem-v5',name:'无限注德州扑克',capacity:Number(capacity),initial,ante,small,big,seconds};
}
export const holdemSeat=(id:string,name:string,initial:Money,bot=false):HoldemSeat=>({id,name,bot,ready:bot,hand:[],stack:initial,brought:initial,bet:'0',total:'0',folded:false,allIn:false,actedAt:null,last:''});
export function newHoldem(id:string,name:string,rules=holdemRules()):HoldemGame{return{kind:'holdem',schemaVersion:1,rules,host:id,seats:[holdemSeat(id,name,rules.initial)],phase:'waiting',street:'preflop',round:'',roundNumber:0,button:-1,smallSeat:-1,bigSeat:-1,turn:-1,deadline:0,deck:[],burns:[],board:[],currentBet:'0',lastRaise:rules.big,roundStart:[],log:[],result:null,fixed:false,ended:0};}
export const isHoldem=(g:unknown):g is HoldemGame=>!!g&&typeof g==='object'&&'kind'in g&&g.kind==='holdem';
function note(g:HoldemGame,text:string,now:number){g.log.push({text,at:now});g.log=g.log.slice(-250);}
function rng(max:number){const lim=Math.floor(0x100000000/max)*max;let x;do{x=crypto.getRandomValues(new Uint32Array(1))[0];}while(x>=lim);return x%max;}
function next(g:HoldemGame,from:number,p:(s:HoldemSeat)=>boolean){for(let d=1;d<=g.seats.length;d++){const i=(from+d+g.seats.length)%g.seats.length;if(p(g.seats[i]))return i;}return -1;}
function pay(s:HoldemSeat,amount:bigint,live=true){amount=min(n(s.stack),amount);s.stack=(n(s.stack)-amount).toString();s.total=(n(s.total)+amount).toString();if(live)s.bet=(n(s.bet)+amount).toString();s.allIn=s.stack==='0';return amount;}
const active=(s:HoldemSeat)=>!s.folded&&!s.allIn;
const needs=(g:HoldemGame,s:HoldemSeat)=>active(s)&&(s.actedAt===null||n(s.bet)<n(g.currentBet));
function setTurn(g:HoldemGame,seat:number,now:number){g.turn=seat;g.deadline=now+(g.seats[seat].bot?1200:g.rules.seconds*1000);}
export function startHoldem(g:HoldemGame,now=Date.now()){
 if(!['waiting','finished'].includes(g.phase)||g.seats.length!==g.rules.capacity||g.seats.some(s=>n(s.stack)<=0n||!s.ready))throw Error('坐满且每人有筹码并准备后才能开局');
 g.fixed=true;g.round=crypto.randomUUID();g.roundNumber++;g.button=(g.button+1)%g.seats.length;g.smallSeat=(g.button+1)%g.seats.length;g.bigSeat=(g.button+2)%g.seats.length;g.phase='playing';g.street='preflop';g.board=[];g.burns=[];g.result=null;g.roundStart=g.seats.map(s=>s.stack);g.log=[];
 g.deck=Array.from({length:52},(_,i)=>i);for(let i=51;i>0;i--){const j=rng(i+1);[g.deck[i],g.deck[j]]=[g.deck[j],g.deck[i]];}
 for(const s of g.seats){s.hand=[];s.bet='0';s.total='0';s.folded=false;s.allIn=false;s.actedAt=null;s.last='';s.action=undefined;s.timeoutChoice=undefined;s.ready=false;pay(s,n(g.rules.ante),['holdem-v3','holdem-v4','holdem-v5'].includes(g.rules.id));}
 // Deal clockwise, one card per seat, twice. Burn cards stay server-private.
 for(let pass=0;pass<2;pass++)for(let d=1;d<=g.seats.length;d++)g.seats[(g.button+d)%g.seats.length].hand.push(g.deck.pop()!);
 for(const [index,target] of [[g.smallSeat,g.rules.small],[g.bigSeat,g.rules.big]] as const){const seat=g.seats[index];pay(seat,n(target)-(['holdem-v3','holdem-v4','holdem-v5'].includes(g.rules.id)?n(seat.bet):0n));}g.currentBet=g.rules.big;g.lastRaise=g.rules.big;
 g.seats[g.smallSeat].last='小盲 '+g.seats[g.smallSeat].bet;g.seats[g.bigSeat].last='大盲 '+g.seats[g.bigSeat].bet;
 note(g,`第 ${g.roundNumber} 局开始，前注 ${g.rules.ante}，小盲 ${g.rules.small}，大盲 ${g.rules.big}`,now);progress(g,g.bigSeat,now);
}
export function holdemBetStep(r:HoldemRules):Money{return ['holdem-v2','holdem-v3','holdem-v5'].includes(r.id)&&n(r.ante)>0n?r.ante:'1';}
export type HoldemActionPreview={check:boolean;call:Money;minRaise:Money;maxRaise:Money;betStep?:Money;canRaise:boolean;canAllIn:boolean;raiseReason:string;allInReason:string};
/** Evaluate only this player's rights at the current public wager, without granting a turn. */
export function holdemActionPreview(g:HoldemGame,id:string):HoldemActionPreview|null{
 const seat=g.seats.findIndex(s=>s.id===id),s=g.seats[seat];
 if(g.phase!=='playing'||!s||!active(s))return null;
 const owed=n(g.currentBet)-n(s.bet),maximum=n(s.bet)+n(s.stack),right=g.rules.id==='holdem-v4'||s.actedAt===null||n(g.currentBet)-n(s.actedAt)>=n(g.lastRaise),step=n(holdemBetStep(g.rules)),minimum=g.rules.id==='holdem-v4'?n(g.currentBet)+1n:((n(g.currentBet)+n(g.lastRaise)+step-1n)/step)*step;
 const opponentCanBet=g.seats.some((o,i)=>i!==seat&&active(o));
 const canRaise=right&&opponentCanBet&&maximum/step*step>=minimum,canAllIn=maximum<=n(g.currentBet)||right&&opponentCanBet;
 return {betStep:step.toString(),check:owed===0n,call:min(owed,n(s.stack)).toString(),minRaise:minimum.toString(),maxRaise:maximum.toString(),canRaise,canAllIn,
  raiseReason:canRaise?'':!opponentCanBet?'没有仍可下注的对手':!right?'本轮加注权尚未重新开放':'筹码不足最低加注额，可选择合法的全下',
  allInReason:canAllIn?'':!opponentCanBet?'没有仍可下注的对手':'本轮加注权尚未重新开放'};
}
export function holdemOptions(g:HoldemGame,id:string){
 const preview=holdemActionPreview(g,id);
 if(!preview||g.seats[g.turn]?.id!==id)return {acting:false,check:false,call:'0',minRaise:'0',maxRaise:'0',canRaise:false,canAllIn:false};
 const {check,call,minRaise,maxRaise,canRaise,canAllIn}=preview;
 return {acting:true,check,call,minRaise,maxRaise,canRaise,canAllIn};
}

function revealStreet(g:HoldemGame,now:number){g.burns.push(g.deck.pop()!);const count=g.street==='preflop'?3:1;for(let i=0;i<count;i++)g.board.push(g.deck.pop()!);g.street=g.street==='preflop'?'flop':g.street==='flop'?'turn':'river';g.currentBet='0';g.lastRaise=g.rules.big;for(const s of g.seats){s.bet='0';s.actedAt=null;s.timeoutChoice=undefined;s.last=s.folded?'弃牌':s.allIn?'全下':'';}note(g,`发出${{flop:'翻牌',turn:'转牌',river:'河牌'}[g.street]}`,now);}
/** Layer contributions. Folded chips still fund pots; uncalled excess is refunded. */
export function settlePots(seats:Pick<HoldemSeat,'total'|'folded'>[],values:(number|null)[],button:number):{pots:Pot[];awards:Money[]}{
 const levels=[...new Set(seats.map(s=>s.total).filter(x=>n(x)>0n))].map(n).sort((a,b)=>a<b?-1:a>b?1:0),awards=seats.map(()=>0n),pots:Pot[]=[];let previous=0n;
 for(const level of levels){const donors=seats.flatMap((s,i)=>n(s.total)>=level?[i]:[]),amount=(level-previous)*BigInt(donors.length);previous=level;if(!amount)continue;
 if(donors.length===1){awards[donors[0]]+=amount;pots.push({amount:amount.toString(),eligible:donors,winners:donors,refund:true});continue;}
 const eligible=donors.filter(i=>!seats[i].folded);if(!eligible.length)throw Error('底池缺少有效玩家');
 const best=Math.max(...eligible.map(i=>values[i]??0)),winners=eligible.filter(i=>(values[i]??0)===best).sort((a,b)=>(a-button-1+seats.length)%seats.length-(b-button-1+seats.length)%seats.length);
 const each=amount/BigInt(winners.length),odd=Number(amount%BigInt(winners.length));winners.forEach((i,j)=>awards[i]+=each+(j<odd?1n:0n));pots.push({amount:amount.toString(),eligible,winners});
 }return{pots,awards:awards.map(String)};
}
function finish(g:HoldemGame,type:'fold'|'showdown',now:number){
 const revealAll=g.rules.id==='holdem-v5',values=g.seats.map(s=>(revealAll||!s.folded&&type==='showdown')&&g.board.length>=3?evaluate([...g.board,...s.hand]):null),{pots,awards}=settlePots(g.seats,values.map(v=>v?.score??null),g.button);
 g.seats.forEach((s,i)=>{s.stack=(n(s.stack)+n(awards[i])).toString();s.ready=s.bot;s.timeoutChoice=undefined;});g.phase='finished';g.turn=-1;g.deadline=0;
 g.result={kind:'holdem',id:g.round,roundNumber:g.roundNumber,rules:{...g.rules},type,board:[...g.board],button:g.button,pots,seats:g.seats.map((s,i)=>({id:s.id,name:s.name,bot:s.bot,delta:(n(s.stack)-n(g.roundStart[i])).toString(),stack:s.stack,brought:s.brought,hand:revealAll||type==='showdown'&&!s.folded?[...s.hand]:[],value:values[i]})),ended:now};note(g,type==='fold'?'其余玩家弃牌，本局结束':'摊牌结算完成',now);
}
function progress(g:HoldemGame,from:number,now:number){
 const survivors=g.seats.filter(s=>!s.folded);if(survivors.length===1){finish(g,'fold',now);return;}
 const movable=g.seats.filter(active);
 // A lone stack may still owe a call, but cannot bet into an uncontested side pot.
 if(movable.length<=1&&movable.every(s=>n(s.bet)>=n(g.currentBet))){if(g.street==='river'){finish(g,'showdown',now);return;}g.phase='runout';g.turn=-1;g.deadline=now+1600;return;}
 const to=next(g,from,s=>needs(g,s));if(to>=0){setTurn(g,to,now);return;}
 if(g.street==='river'){finish(g,'showdown',now);return;}revealStreet(g,now);progress(g,g.button,now);
}
export type HoldemMove={action:string;amount?:unknown};
export function moveHoldem(g:HoldemGame,id:string,m:HoldemMove,now=Date.now()){
 const o=holdemOptions(g,id);if(!o.acting)throw Error('还没有轮到你操作');const s=g.seats[g.turn],seat=g.turn,before=n(s.total),street=g.street;
 if(m.action==='fold'){s.folded=true;s.last='弃牌';}
 else if(m.action==='check'){if(!o.check)throw Error('需要跟注，不能过牌');s.last='过牌';}
 else if(m.action==='call'){if(o.check)throw Error('当前无需跟注，请过牌');const amount=pay(s,n(o.call));s.last=(s.allIn?'全下跟注 ':'跟注 ')+amount;}
 else if(m.action==='raise'||m.action==='allin'){
  const target=m.action==='allin'?n(o.maxRaise):wager(m.amount);
  if(m.action==='raise'&&target%n(holdemBetStep(g.rules))!==0n)throw Error(`下注须为 ${holdemBetStep(g.rules)} 的整数倍`);
  if(m.action==='allin'&&!o.canAllIn)throw Error('不足额全下没有重新开放你的加注权');
  if(target<=n(g.currentBet)){if(m.action!=='allin')throw Error('加注额须高于当前下注');pay(s,n(s.stack));s.last='全下跟注 '+s.bet;}
  else {const increase=target-n(g.currentBet);if(target>n(o.maxRaise)||(!o.canRaise&&!(o.canAllIn&&target===n(o.maxRaise)))||g.rules.id!=='holdem-v4'&&increase<n(g.lastRaise)&&target!==n(o.maxRaise))throw Error('加注金额不符合本轮最小加注要求');
   pay(s,target-n(s.bet));if(increase>=n(g.lastRaise))g.lastRaise=increase.toString();g.currentBet=target.toString();s.last=(s.allIn?'全下至 ':'加注至 ')+target;
  }
 }else throw Error('未知德州操作');
 s.action={id:crypto.randomUUID(),kind:s.allIn?'allin':m.action as HoldemSeatAction['kind'],paid:(n(s.total)-before).toString(),at:now,street};
 s.timeoutChoice=undefined;s.actedAt=g.currentBet;note(g,s.name+' '+s.last,now);progress(g,seat,now);
}
export type HoldemTimeoutChoice={action:string;amount?:string;maxCall:string;round:string;street:HoldemGame['street'];bet:string;stack:string};
/** Private to the server: never include this choice in other players' views. */
export function setHoldemTimeoutChoice(g:HoldemGame,id:string,value:unknown,scope:{round:unknown;street:unknown;bet:unknown;stack:unknown}){
 const s=g.seats.find(s=>s.id===id);
 if(!s||g.phase!=='playing'||!active(s))throw Error('当前不能设置到时操作');
 if(scope.round!==g.round||scope.street!==g.street||scope.bet!==s.bet||scope.stack!==s.stack)throw Error('牌局已变化，请重新选择');
 if(value===null){s.timeoutChoice=undefined;return;}
 if(!value||typeof value!=='object')throw Error('到时操作无效');
 const v=value as Record<string,unknown>;
 if(!['fold','check','call','raise','allin'].includes(String(v.action)))throw Error('到时操作无效');
 const choice:HoldemTimeoutChoice={action:String(v.action),maxCall:wager(v.maxCall??'0').toString(),round:g.round,street:g.street,bet:s.bet,stack:s.stack};
 if(choice.action==='raise')choice.amount=wager(v.amount).toString();
 s.timeoutChoice=choice;
 if(!timeoutMove(g,s)){s.timeoutChoice=undefined;throw Error('到时操作已不合法，请重新选择');}
}
export function timeoutMove(g:HoldemGame,s:HoldemSeat):HoldemMove|null{
 const c=s.timeoutChoice,p=holdemActionPreview(g,s.id);
 if(!c||!p||c.round!==g.round||c.street!==g.street||c.bet!==s.bet||c.stack!==s.stack)return null;
 if(c.action==='fold')return {action:'fold'};
 if(c.action==='check')return p.check?{action:'check'}:null;
 if(c.action==='call')return !p.check&&n(p.call)<=n(c.maxCall)?{action:'call'}:p.check?{action:'check'}:null;
 if(c.action==='allin')return p.canAllIn?{action:'allin'}:null;
 if(c.action==='raise'&&c.amount&&p.canRaise&&n(c.amount)>=n(p.minRaise)&&n(c.amount)<=n(p.maxRaise)&&n(c.amount)%n(holdemBetStep(g.rules))===0n)return {action:'raise',amount:c.amount};
 return null;
}
export function timeoutHoldem(g:HoldemGame,now=Date.now()){
 if(g.deadline>now)return false;if(g.phase==='runout'){revealStreet(g,now);if(g.street==='river')finish(g,'showdown',now);else g.deadline=now+1600;return true;}
 if(g.phase!=='playing')return false;const s=g.seats[g.turn],o=holdemOptions(g,s.id);const choice=timeoutMove(g,s);moveHoldem(g,s.id,choice??{action:o.check?'check':'fold'},now);return true;
}
export function rebuyHoldem(g:HoldemGame,id:string,now=Date.now()){
 if(!['waiting','finished'].includes(g.phase))throw Error('只能在两局之间补入筹码');const s=g.seats.find(s=>s.id===id);if(!s||s.stack!=='0')throw Error('筹码输光后可以补入');s.stack=g.rules.initial;s.brought=(n(s.brought)+n(g.rules.initial)).toString();s.ready=s.bot;note(g,s.name+' 补入 '+g.rules.initial+' 筹码',now);
}
export function closeHoldem(g:HoldemGame,force=false,now=Date.now()){
 if(g.phase==='closed')return;if(['playing','runout'].includes(g.phase)){if(!force)throw Error('请在本局结束后结束整桌');g.seats.forEach((s,i)=>s.stack=g.roundStart[i]);g.result={kind:'holdem',id:g.round,roundNumber:g.roundNumber,rules:{...g.rules},type:'aborted',board:[...g.board],button:g.button,pots:[],seats:g.seats.map(s=>({id:s.id,name:s.name,bot:s.bot,delta:'0',stack:s.stack,brought:s.brought,hand:[],value:null})),ended:now};note(g,'本局中止，已退回本局全部下注',now);}
 g.seats.forEach(s=>{s.timeoutChoice=undefined});g.phase='closed';g.turn=-1;g.deadline=0;g.ended=now;
}
export function holdemView(g:HoldemGame,id:string){return{friendlyMatch:g.friendlyMatch,kind:g.kind,rules:g.rules,host:g.host,phase:g.phase,street:g.street,round:g.round,roundNumber:g.roundNumber,button:g.button,smallSeat:g.smallSeat,bigSeat:g.bigSeat,turn:g.turn,deadline:g.deadline,board:g.board,currentBet:g.currentBet,pot:g.seats.reduce((a,s)=>a+n(s.total),0n).toString(),log:g.log,result:g.result,fixed:g.fixed,options:holdemOptions(g,id),actionPreview:holdemActionPreview(g,id),seats:g.seats.map((s,i)=>({id:s.id,name:s.name,bot:s.bot,ready:s.ready,stack:s.stack,brought:s.brought,bet:s.bet,total:s.total,action:s.action,folded:s.folded,allIn:s.allIn,last:s.last,hand:s.id===id?s.hand:g.result?.seats[i]?.hand??[],net:(n(s.stack)-n(s.brought)).toString()}))};}
export type HoldemView=Omit<ReturnType<typeof holdemView>,'actionPreview'>&{actionPreview?:HoldemActionPreview|null};
