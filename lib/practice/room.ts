import {bid,play,view,doubleChoice,rank,fourPlayer,landlordCapacity,hintsFor,type Game} from '../game/engine.ts';
import {isLandlordV3,v3BotAction,type V3Game} from '../game/landlord-v3.ts';
import {modernSeat,modernView,moveModern,confirmWin,type ModernGame} from '../mahjong/modern.ts';
import {BOT_DELAY_MS,BOT_NAMES,soloPractice} from './types.ts';
import {landlordDecision} from './landlord.ts';
import {mahjongDecision,mahjongPlan} from './mahjong.ts';
type PracticeGame=Game|V3Game|ModernGame;
const mahjong=(g:PracticeGame):g is ModernGame=>'kind' in g&&g.kind==='mahjong';
function rosterEditable(g:PracticeGame){
 if(isLandlordV3(g)&&g.roundNumber>0)throw Error('扩展赛制开始后座位固定');
 if(g.phase!=='waiting'||(mahjong(g)&&g.fixedIds.length))throw Error('只能在开局前调整人机座位');
 if(soloPractice(g))throw Error('个人测试房的陪练座位固定，请另开好友房');
}
/** Every human confirms readiness again after a roster change. Bots never ready a human. */
export function resetRosterReady(g:PracticeGame){g.seats.forEach(s=>{s.ready=!!s.bot;});}
export function addRoomBot(g:PracticeGame){
 rosterEditable(g);if(g.seats.length>=(mahjong(g)?4:landlordCapacity(g)))throw Error('座位已满');
 const id='bot:'+crypto.randomUUID(),name=BOT_NAMES.find(n=>!g.seats.some(s=>s.name===n))||'陪练'+(g.seats.filter(s=>s.bot).length+1);
 if(mahjong(g))g.seats.push({...modernSeat(id,name,g.initialChips),bot:true,ready:true});
 else g.seats.push({id,name,hand:[],ready:true,plays:0,last:'',bot:true});
 g.practice??={difficulty:'advanced',roomType:'mixed',botIds:[],nextAt:0};g.practice.botIds.push(id);g.practice.nextAt=0;resetRosterReady(g);
 return id;
}
export function removeRoomBot(g:PracticeGame,id:string){
 rosterEditable(g);const index=g.seats.findIndex(s=>s.id===id&&s.bot);if(index<0)throw Error('只能移除人机座位');
 g.seats.splice(index,1);g.practice!.botIds=g.seats.filter(s=>s.bot).map(s=>s.id);g.practice!.nextAt=0;
 if(!g.practice!.botIds.length)delete g.practice;resetRosterReady(g);
}
/** A robot cannot inherit room ownership or keep an empty waiting room alive. */
export function transferHumanHost(g:PracticeGame){
 g.host=g.seats.find(s=>!s.bot)?.id||'';
 if(!g.host){g.seats=[];g.phase='closed';if(g.practice){g.practice.botIds=[];g.practice.nextAt=0;}}
 resetRosterReady(g);
}
export function fillBots(g:PracticeGame){
 if(g.seats.length!==1||g.phase!=='waiting')throw Error('只能在建房时选择人机测试');
 const botIds:string[]=[];
 for(let i=0;i<(mahjong(g)?3:landlordCapacity(g)-1);i++){const id='bot:'+crypto.randomUUID(),name=BOT_NAMES[i];botIds.push(id);
  if(mahjong(g))g.seats.push({...modernSeat(id,name,g.initialChips),bot:true,ready:true});
  else g.seats.push({id,name,hand:[],ready:true,plays:0,last:'',bot:true});
 }g.practice={difficulty:'advanced',botIds,nextAt:0};
}
export function nextBot(g:PracticeGame){
 if(!g.practice||!['shopping','bidding','doubling','playing','equipment','choosing','revealing'].includes(g.phase))return -1;
 const bot=(i:number)=>!!g.seats[i]?.bot&&g.practice!.botIds.includes(g.seats[i].id);
 if(isLandlordV3(g))return g.phase==='shopping'?g.seats.findIndex((s,i)=>bot(i)&&s.last!=='商店完成'):g.phase==='equipment'&&g.pendingEffect&&bot(g.pendingEffect.seat)?g.pendingEffect.seat:bot(g.turn)?g.turn:-1;
 if(!mahjong(g)&&g.phase==='doubling')return g.seats.findIndex((s,i)=>bot(i)&&g.doubles?.[i]===null);
 if(mahjong(g)&&['choosing','revealing'].includes(g.phase))return bot(g.winner)?g.winner:-1;
 if(mahjong(g)&&g.pending)return g.pending.eligible.find(i=>bot(i)&&!Object.hasOwn(g.pending!.responses,String(i)))??-1;
 return bot(g.turn)?g.turn:-1;
}
/** Called inside the same version-guarded transaction as every game update. */
export function scheduleBots(g:PracticeGame,now=Date.now()){
 if(!g.practice)return;
 if(['waiting','finished'].includes(g.phase))g.seats.forEach(s=>{if(s.bot)s.ready=true;});
 g.practice.nextAt=nextBot(g)>=0?now+BOT_DELAY_MS:0;
}
export function advanceBot(g:PracticeGame,now=Date.now()){
 const seat=nextBot(g);if(seat<0||!g.practice!.nextAt||g.practice!.nextAt>now)return false;
 if(mahjong(g)&&g.pending&&g.deadline<=now)return false;
 if(isLandlordV3(g)){v3BotAction(g,seat,now);return true;}
 if(!mahjong(g)&&g.phase==='doubling'){const hand=g.seats[seat].hand;doubleChoice(g,seat,hand.filter(c=>rank(c)>=14).length>=5||[...new Set(hand.map(rank))].some(r=>hand.filter(c=>rank(c)===r).length===4),now);return true;}
 if(mahjong(g)){
  if(g.phase==='revealing'){moveModern(g,seat,{action:'flip_award',awardIndex:g.reveal!.awards.length},now);return true;}
  if(g.phase==='choosing'){confirmWin(g,seat,mahjongPlan(g.choice!),now);return true;}
  const v=modernView(g,g.seats[seat].id),me=v.seats[seat];
  const action=mahjongDecision({hand:me.hand,melds:me.melds,wildcard:v.wildcard,remaining:v.remaining,visible:v.seats.flatMap(s=>[...s.hand,...s.river,...s.melds.flatMap(m=>m.tiles)]),river:v.seats.flatMap(s=>s.river),options:v.options,pending:v.pending});
  moveModern(g,seat,action,now);
 }else{
  const v=view(g,g.seats[seat].id),opponents=v.seats.filter((_,i)=>(i===v.landlord)!==(seat===v.landlord));
  const next=(seat+1)%landlordCapacity(g),nextEnemy=(next===v.landlord)!==(seat===v.landlord);
  const action=fourPlayer(g)?fourDecision(g,seat):landlordDecision({hand:v.seats[seat].hand,phase:v.phase as 'bidding'|'playing',bid:v.bid,last:v.last?.combo??null,lastIsTeammate:!!v.last&&seat!==v.landlord&&v.last.seat!==v.landlord,nextOpponentCount:nextEnemy?v.seats[next].count:0,opponentMinimum:Math.min(...opponents.map(s=>s.count))});
  if(action.action==='bid')bid(g,seat,action.value,now);else play(g,seat,action.action==='pass'?[]:action.cards,now);
 }return true;
}

/** Four-player policy uses only own cards and public counts/actions, never other hands. */
function fourDecision(g:Game,seat:number):{action:'bid';value:number}|{action:'play';cards:number[]}|{action:'pass'}{
 const v=view(g,g.seats[seat].id),hand=v.seats[seat].hand;
 if(v.phase==='bidding'){const want=hand.filter(c=>rank(c)>=15).length>=5?3:1;return {action:'bid',value:want>v.bid?want:0};}
 const options=hintsFor(g,hand,v.last?.combo??null),finish=options.find(cs=>cs.length===hand.length);
 if(finish)return {action:'play',cards:finish};
 if(!options.length||v.last&&seat!==v.landlord&&v.last.seat!==v.landlord)return {action:'pass'};
 const regular=options.filter(cs=>new Set(cs.map(rank)).size>1||cs.length<4);
 const cards=(v.last?options:regular.length?regular:options).sort((a,b)=>v.last?a.length-b.length||rank(a[0])-rank(b[0]):b.length-a.length||rank(a[0])-rank(b[0]))[0];
 return {action:'play',cards};
}
