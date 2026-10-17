import type {FriendlyMatch} from '../friendly-match.ts';
import {emitVisual,publicVisuals,type VisualEvent} from '../motion/events.ts';
import {BASIC_136, type MahjongRules} from './rules.ts';
import type {Practice} from '../practice/types.ts';
export type Phase='waiting'|'playing'|'finished'|'closed';
export type Meld={kind:'chi'|'pong'|'kong';tiles:number[];from:number;concealed:boolean};
export type Seat={id:string;name:string;hand:number[];melds:Meld[];river:number[];ready:boolean;last:string;bot?:boolean};
export type Option={key:string;kind:'chi'|'pong'|'kong'|'hu'|'concealed'|'added';tiles:number[];meldIndex?:number};
type Pending={kind:'discard'|'added';from:number;tile:number;meldIndex?:number;eligible:number[];responses:Record<string,Option|null>};
export type MahjongGame={friendlyMatch?:FriendlyMatch;
 visualEvents?:VisualEvent[];
 practice?:Practice;kind:'mahjong';schemaVersion:1;rules:MahjongRules;phase:Phase;host:string;seats:Seat[];
 wall:number[];turn:number;dealer:number;round:string;roundNumber:number;seconds:number;deadline:number;
 drawn:number|null;lastDiscard:{seat:number;tile:number}|null;pending:Pending|null;
 winner:number;winType:'self'|'discard'|'rob'|'draw'|null;source:number;deltas:number[];log:{text:string;at:number}[];
};
export const tileType=(id:number)=>Math.floor(id/4);
export const tileSuit=(id:number)=>Math.floor(tileType(id)/9);
export const tileRank=(id:number)=>tileType(id)%9+1;
export function tileLabel(id:number){const t=tileType(id);return t<27?`${t%9+1}${['万','筒','条'][Math.floor(t/9)]}`:['东','南','西','北','中','发','白'][t-27];}
export const sortTiles=(tiles:number[])=>[...tiles].sort((a,b)=>a-b);
export const newSeat=(id:string,name:string):Seat=>({id,name,hand:[],melds:[],river:[],ready:false,last:''});
export function newMahjong(id:string,name:string,seconds=30):MahjongGame{return{kind:'mahjong',schemaVersion:1,rules:{...BASIC_136},phase:'waiting',host:id,seats:[newSeat(id,name)],wall:[],turn:0,dealer:0,round:'',roundNumber:0,seconds,deadline:0,drawn:null,lastDiscard:null,pending:null,winner:-1,winType:null,source:-1,deltas:[],log:[]};}
function rand(n:number){const max=Math.floor(0x100000000/n)*n;let v;do{v=crypto.getRandomValues(new Uint32Array(1))[0];}while(v>=max);return v%n;}
function note(g:MahjongGame,text:string,now:number){g.log.push({text,at:now});g.log=g.log.slice(-400);}
function due(g:MahjongGame,now:number){g.deadline=g.phase==='playing'?now+g.seconds*1000:0;}
export function dealMahjong(g:MahjongGame,now=Date.now()){
 if(g.seats.length!==4)throw Error('需要四人入座');
 const deck=Array.from({length:136},(_,i)=>i);for(let i=135;i>0;i--){const j=rand(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
 g.dealer=g.roundNumber?(g.dealer+1)%4:0;g.roundNumber++;g.round=crypto.randomUUID();g.visualEvents=[];g.turn=g.dealer;g.phase='playing';
 g.seats.forEach(s=>{s.hand=sortTiles(deck.splice(0,13));s.melds=[];s.river=[];s.ready=false;s.last='';});
 g.wall=deck;g.drawn=g.wall.shift()!;g.seats[g.turn].hand=sortTiles([...g.seats[g.turn].hand,g.drawn]);
 g.lastDiscard=null;g.pending=null;g.winner=-1;g.source=-1;g.winType=null;g.deltas=[];g.log=[];
 note(g,`第 ${g.roundNumber} 局开始，${g.seats[g.dealer].name} 坐庄`,now);due(g,now);
}
/** Exact decomposition of a concealed hand into remaining melds and one pair. */
export function isWinning(tiles:number[],meldCount=0,sevenPairs=false):boolean{
 if(!Number.isInteger(meldCount)||meldCount<0||meldCount>4||tiles.length!==14-3*meldCount||new Set(tiles).size!==tiles.length||tiles.some(t=>!Number.isInteger(t)||t<0||t>=136))return false;
 const counts=Array(34).fill(0) as number[];for(const t of tiles)counts[tileType(t)]++;
 if(counts.some(n=>n>4))return false;
 if(sevenPairs&&meldCount===0&&counts.every(n=>n%2===0))return true;
 const memo=new Map<string,boolean>();
 function melds():boolean{const first=counts.findIndex(n=>n>0);if(first<0)return true;const key=counts.join('');if(memo.has(key))return memo.get(key)!;
  let ok=false;
  if(counts[first]>=3){counts[first]-=3;ok=melds();counts[first]+=3;}
  if(!ok&&first<27&&first%9<=6&&counts[first+1]>0&&counts[first+2]>0){counts[first]--;counts[first+1]--;counts[first+2]--;ok=melds();counts[first]++;counts[first+1]++;counts[first+2]++;}
  memo.set(key,ok);return ok;
 }
 for(let i=0;i<34;i++)if(counts[i]>=2){counts[i]-=2;const ok=melds();counts[i]+=2;if(ok)return true;}
 return false;
}
function wins(g:MahjongGame,seat:number,tile?:number){const s=g.seats[seat];return isWinning(tile===undefined?s.hand:[...s.hand,tile],s.melds.length,g.rules.sevenPairs);}
function option(kind:Option['kind'],tiles:number[],meldIndex?:number):Option{return{kind,tiles:sortTiles(tiles),key:`${kind}:${sortTiles(tiles).join(',')}`, ...(meldIndex===undefined?{}:{meldIndex})};}
function matching(hand:number[],type:number){return hand.filter(t=>tileType(t)===type);}
function claimOptions(g:MahjongGame,seat:number,p:Pending):Option[]{
 if(seat===p.from)return [];const s=g.seats[seat],out:Option[]=[];
 if(wins(g,seat,p.tile))out.push(option('hu',[]));
 if(p.kind==='added')return out;
 const t=tileType(p.tile),same=matching(s.hand,t);
 if(same.length>=2)out.push(option('pong',same.slice(0,2)));
 if(same.length===3&&g.wall.length)out.push(option('kong',same));
 if(g.rules.allowChi&&(p.from+1)%4===seat&&t<27){for(let first=t-2;first<=t;first++){
  if(first<0||first>=27||Math.floor(first/9)!==Math.floor(t/9)||first%9>6)continue;
  const needed=[first,first+1,first+2].filter(v=>v!==t),cards=needed.map(type=>matching(s.hand,type)[0]);
  if(cards.every(c=>c!==undefined))out.push(option('chi',cards));
 }}
 return out;
}
export function mahjongOptions(g:MahjongGame,seat:number){
 const out:{canDiscard:boolean;canHu:boolean;canPass:boolean;claims:Option[];kongs:Option[]}={canDiscard:false,canHu:false,canPass:false,claims:[],kongs:[]};
 if(g.phase!=='playing'||seat<0)return out;
 if(g.pending){if(g.pending.eligible.includes(seat)&&!Object.hasOwn(g.pending.responses,String(seat))){out.claims=claimOptions(g,seat,g.pending);out.canPass=true;}return out;}
 if(g.turn!==seat)return out;
 out.canDiscard=true;out.canHu=g.drawn!==null&&wins(g,seat);
 if(g.wall.length&&g.drawn!==null){const s=g.seats[seat];for(let t=0;t<34;t++){const same=matching(s.hand,t);if(same.length===4)out.kongs.push(option('concealed',same));}
 s.melds.forEach((m,i)=>{if(m.kind==='pong'){const tile=matching(s.hand,tileType(m.tiles[0]))[0];if(tile!==undefined)out.kongs.push(option('added',[tile],i));}});}
 return out;
}
function take(s:Seat,tiles:number[]){if(new Set(tiles).size!==tiles.length||tiles.some(t=>!s.hand.includes(t)))throw Error('只能使用自己的手牌');s.hand=s.hand.filter(t=>!tiles.includes(t));}
function finish(g:MahjongGame,winner:number,source:number,type:'self'|'discard'|'rob'|'draw',now:number){
 if(type!=='draw')emitVisual(g,winner,'hu',now,type);
 g.phase='finished';g.winner=winner;g.source=source;g.winType=type;g.pending=null;g.deadline=0;g.deltas=[0,0,0,0];g.seats.forEach(s=>s.ready=false);
 if(type==='self'){g.deltas=g.seats.map((_,i)=>i===winner?3*g.rules.selfDrawUnit:-g.rules.selfDrawUnit);}
 else if(type!=='draw'){g.deltas[winner]=g.rules.discardUnit;g.deltas[source]=-g.rules.discardUnit;}
 note(g,type==='draw'?'牌墙已摸完，本局流局':`${g.seats[winner].name} ${type==='self'?'自摸':type==='rob'?'抢杠胡':'胡牌'}，本局结束`,now);
}
function draw(g:MahjongGame,seat:number,replacement:boolean,now:number){
 g.pending=null;if(!g.wall.length){finish(g,-1,-1,'draw',now);return;}
 const tile=replacement?g.wall.pop()!:g.wall.shift()!;g.turn=seat;g.drawn=tile;g.seats[seat].hand=sortTiles([...g.seats[seat].hand,tile]);g.seats[seat].last=replacement?'杠后补牌':'摸牌';due(g,now);
 // Drawn face is deliberately absent from public logs.
 note(g,`${g.seats[seat].name} ${replacement?'杠后补牌':'摸牌'}`,now);
}
function startPending(g:MahjongGame,p:Pending,now:number){
 g.pending=p;g.drawn=null;p.eligible=g.seats.map((_,i)=>i).filter(i=>claimOptions(g,i,p).length>0);due(g,now);
 if(!p.eligible.length)resolve(g,now);
}
function resolve(g:MahjongGame,now:number){
 const p=g.pending!;if(p.eligible.some(i=>!Object.hasOwn(p.responses,String(i))))return;
 const priority=(o:Option)=>o.kind==='hu'?3:o.kind==='chi'?1:2;
 const claims=p.eligible.flatMap(seat=>p.responses[seat]?[{seat,choice:p.responses[seat]!}]:[]).sort((a,b)=>priority(b.choice)-priority(a.choice)||((a.seat-p.from+4)%4)-((b.seat-p.from+4)%4));
 const chosen=claims[0];
 if(chosen?.choice.kind==='hu'){
  if(p.kind==='discard'){const river=g.seats[p.from].river;river.splice(river.lastIndexOf(p.tile),1);}else take(g.seats[p.from],[p.tile]);
  g.seats[chosen.seat].hand=sortTiles([...g.seats[chosen.seat].hand,p.tile]);finish(g,chosen.seat,p.from,p.kind==='added'?'rob':'discard',now);return;
 }
 if(p.kind==='added'){
  const s=g.seats[p.from];take(s,[p.tile]);const m=s.melds[p.meldIndex!];m.kind='kong';m.tiles=sortTiles([...m.tiles,p.tile]);
  emitVisual(g,p.from,'kong',now,'added');note(g,`${s.name} 补杠 ${tileLabel(p.tile)}`,now);draw(g,p.from,true,now);return;
 }
 if(!chosen){draw(g,(p.from+1)%4,false,now);return;}
 const {seat,choice}=chosen,s=g.seats[seat];take(s,choice.tiles);const river=g.seats[p.from].river;river.splice(river.lastIndexOf(p.tile),1);
 s.melds.push({kind:choice.kind as 'chi'|'pong'|'kong',tiles:sortTiles([...choice.tiles,p.tile]),from:p.from,concealed:false});
 emitVisual(g,seat,choice.kind as 'chi'|'pong'|'kong',now,choice.kind==='kong'?'exposed':undefined);
 s.last=choice.kind==='chi'?'吃':choice.kind==='pong'?'碰':'杠';note(g,`${s.name} ${s.last} ${tileLabel(p.tile)}`,now);
 g.turn=seat;g.pending=null;g.drawn=null;g.lastDiscard=null;
 if(choice.kind==='kong')draw(g,seat,true,now);else due(g,now);
}
export type Move={action:'discard'|'claim'|'pass'|'hu'|'kong';tile?:number;key?:string};
export function moveMahjong(g:MahjongGame,seat:number,m:Move,now=Date.now()){
 if(g.phase!=='playing'||seat<0||seat>=g.seats.length)throw Error('当前不能操作');
 const opts=mahjongOptions(g,seat),s=g.seats[seat];
 if(g.pending){
  if(!opts.canPass)throw Error('当前无需你响应，或你已作出选择');
  if(m.action!=='pass'&&m.action!=='claim')throw Error('请先选择吃碰杠胡或跳过');
  const choice=m.action==='pass'?null:opts.claims.find(o=>o.key===m.key);
  if(choice===undefined)throw Error('这个操作不符合当前牌型');
  g.pending.responses[seat]=choice;resolve(g,now);return;
 }
 if(!opts.canDiscard)throw Error('还没轮到你');
 if(m.action==='hu'){if(!opts.canHu)throw Error('还未组成可胡的牌型');finish(g,seat,seat,'self',now);return;}
 if(m.action==='kong'){
  const k=opts.kongs.find(o=>o.key===m.key);if(!k)throw Error('这些牌不能开杠');
  if(k.kind==='concealed'){take(s,k.tiles);s.melds.push({kind:'kong',tiles:k.tiles,from:seat,concealed:true});emitVisual(g,seat,'kong',now,'concealed');note(g,`${s.name} 暗杠`,now);draw(g,seat,true,now);}
  else if(g.rules.allowRobAddedKong)startPending(g,{kind:'added',from:seat,tile:k.tiles[0],meldIndex:k.meldIndex,eligible:[],responses:{}},now);
  else{take(s,k.tiles);const meld=s.melds[k.meldIndex!];meld.kind='kong';meld.tiles=sortTiles([...meld.tiles,...k.tiles]);emitVisual(g,seat,'kong',now,'added');note(g,`${s.name} 补杠 ${tileLabel(k.tiles[0])}`,now);draw(g,seat,true,now);}
  return;
 }
 if(m.action!=='discard'||typeof m.tile!=='number'||!Number.isInteger(m.tile)||!s.hand.includes(m.tile))throw Error('请选择自己的一张手牌');
 take(s,[m.tile]);emitVisual(g,seat,'discard',now);s.river.push(m.tile);s.last=`打 ${tileLabel(m.tile)}`;g.lastDiscard={seat,tile:m.tile};
 note(g,`${s.name} 打出 ${tileLabel(m.tile)}`,now);startPending(g,{kind:'discard',from:seat,tile:m.tile,eligible:[],responses:{}},now);
}
export function timeoutMahjong(g:MahjongGame,now=Date.now()){
 if(g.phase!=='playing'||g.deadline>now)return false;
 if(g.pending){for(const seat of g.pending.eligible)if(!Object.hasOwn(g.pending.responses,String(seat)))g.pending.responses[seat]=null;resolve(g,now);}
 else moveMahjong(g,g.turn,{action:'discard',tile:g.drawn??g.seats[g.turn].hand.at(-1)!},now);
 return true;
}
export function mahjongView(g:MahjongGame,id:string){
 const own=g.seats.findIndex(s=>s.id===id),finished=g.phase==='finished'||g.phase==='closed'&&g.friendlyMatch?.status==='finished';
 // Whitelist every visible field. Never return the wall, eligibility or other players' choices.
 return {friendlyMatch:g.friendlyMatch,visualEvents:publicVisuals(g),kind:g.kind,rules:g.rules,phase:g.phase,host:g.host,turn:g.turn,dealer:g.dealer,round:g.round,roundNumber:g.roundNumber,seconds:g.seconds,deadline:g.deadline,
  remaining:g.wall.length,drawn:own===g.turn?g.drawn:null,lastDiscard:g.lastDiscard,
  pending:g.pending?{kind:g.pending.kind,from:g.pending.from,tile:g.pending.tile}:null,
  winner:g.winner,winType:g.winType,source:g.source,deltas:g.deltas,log:g.log,options:mahjongOptions(g,own),
  seats:g.seats.map((s,i)=>({id:s.id,name:s.name,ready:s.ready,last:s.last,count:s.hand.length,river:s.river,
   hand:i===own||finished?s.hand:[],melds:s.melds.map(m=>({...m,tiles:m.concealed&&i!==own&&!finished?[]:m.tiles}))})),
 };
}
export type MahjongView=ReturnType<typeof mahjongView>;
