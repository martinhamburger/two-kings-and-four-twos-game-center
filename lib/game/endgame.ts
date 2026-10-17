import {DEFAULT_LANDLORD_RULES,newGame,play,rank,sorted,type Game} from './engine.ts';

/** Portable starting position; deliberately contains no account or room state. */
export type Endgame={version:1;hands:number[][];landlord:number;turn:number};
export const emptyEndgame=():Endgame=>({version:1,hands:[[],[],[]],landlord:0,turn:0});
export function readEndgame(value:unknown,complete=true):Endgame{
 if(!value||typeof value!=='object')throw Error('残局文件格式无效');
 const v=value as Endgame;
 if(v.version!==1||!Array.isArray(v.hands)||v.hands.length!==3||![v.landlord,v.turn].every(n=>Number.isInteger(n)&&n>=0&&n<3))throw Error('残局版本、座位或先手无效');
 const seen=new Set<number>();
 const hands=v.hands.map((hand,i)=>{
  if(!Array.isArray(hand)||hand.length>(i===v.landlord?20:17)||complete&&!hand.length)throw Error('每家至少 1 张牌，地主最多 20 张，农民最多 17 张');
  for(const card of hand){if(!Number.isInteger(card)||card<0||card>53||seen.has(card))throw Error('只能使用一副扑克牌，同一张牌不能重复分配');seen.add(card);}
  return sorted(hand);
 });
 return {version:1,hands,landlord:v.landlord,turn:v.turn};
}
export const endgameSeatName=(seat:number,landlord:number)=>`${seat+1} 号 · ${seat===landlord?'地主':'农民'}`;
export function startEndgame(value:unknown):Game{
 const position=readEndgame(value),g=newGame('designer','残局设计');
 g.rules={...DEFAULT_LANDLORD_RULES,allowDouble:false,bombDouble:false,springDouble:false};
 g.seats=position.hands.map((hand,i)=>({id:`design-${i}`,name:endgameSeatName(i,position.landlord),hand,ready:false,plays:0,last:''}));
 g.phase='playing';g.landlord=position.landlord;g.turn=position.turn;g.bid=1;g.round='endgame';g.tableActions=[null,null,null];
 return g;
}
/** Reuse the ordinary rules without timers, bots, persistence or settlement. */
export function moveEndgame(game:Game,cards:number[]):Game{
 const next=structuredClone(game);play(next,next.turn,cards);next.deadline=0;next.deltas=[];return next;
}

/** Rank-level editor keeps unique physical cards behind the single visible tile. */
export function endgameRankStock(position:Endgame,value:number){
 const used=new Set(position.hands.flat());
 return Array.from({length:54},(_,i)=>i).filter(card=>rank(card)===value&&!used.has(card));
}
export function changeEndgameRank(position:Endgame,seat:number,value:number,delta:1|-1):Endgame{
 if(!Number.isInteger(seat)||seat<0||seat>2||!Number.isInteger(value)||value<3||value>17)throw Error('请选择有效的座位与点数');
 const next=readEndgame(position,false),hand=next.hands[seat];
 if(delta===1){const card=endgameRankStock(next,value)[0];if(card===undefined)throw Error('这个点数的牌已全部分配');hand.push(card);}
 else {const index=hand.findIndex(card=>rank(card)===value);if(index<0)throw Error('这家没有这个点数的牌');hand.splice(index,1);}
 return readEndgame(next,false);
}
