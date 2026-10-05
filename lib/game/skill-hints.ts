import {beats,hints,rank,sorted} from './engine.ts';
import {selectionCombo,type V3Game} from './landlord-v3.ts';

/** Uses only the current player's hand and public seat counts. Never submits a move. */
export function skillHints(g:Omit<V3Game,'seats'> & {seats:(V3Game['seats'][number]&{count?:number})[]},seat:number):number[][]{
 const hand=g.seats[seat]?.hand??[];
 if(g.phase!=='playing'||g.turn!==seat||!hand.length)return [];
 const target=g.last?.combo??null,counts=new Map<number,number>();
 hand.forEach(c=>counts.set(rank(c),(counts.get(rank(c))??0)+1));
 const opponents=g.seats.filter((_,i)=>i!==seat&&(g.landlord<0||seat===g.landlord||i===g.landlord));
 const danger=opponents.some(s=>s.count===1);
 const next=(seat+1)%3,nextIsOpponent=next!==seat&&(g.landlord<0||seat===g.landlord||next===g.landlord);
 const blockSingle=nextIsOpponent&&g.seats[next]?.count===1&&(!target||target.kind==='单张');
 const candidateMap=new Map(hints(hand,null).map(cs=>[sorted(cs).join(','),cs]));
 candidateMap.set(sorted(hand).join(','),sorted(hand)); // Includes a whole-hand skill finish.
 const estimates=new Map<string,number>();
 function remainingTurns(cards:number[]):number{
  const key=sorted(cards).join(','),cached=estimates.get(key);if(cached!==undefined)return cached;
  let rest=cards,turns=0;
  // A bounded greedy partition estimate; actual card instances preserve generated cards.
  while(rest.length){
   const moves=hints(rest,null);
   const best=moves.sort((a,b)=>b.length-a.length||rank(a[0])-rank(b[0]))[0]??[rest[0]];
   rest=rest.filter(c=>!best.includes(c));turns++;
  }
  estimates.set(key,turns);return turns;
 }
 return [...candidateMap.values()].flatMap(cards=>{
  const combo=selectionCombo(g,seat,cards);if(!combo||!beats(combo,target))return [];
  const rest=hand.filter(c=>!cards.includes(c)),used=new Map<number,number>();cards.forEach(c=>used.set(rank(c),(used.get(rank(c))??0)+1));
  const split=[...used].reduce((cost,[r,n])=>{const total=counts.get(r)!;return cost+(n<total?(total>=4?90:total===3?30:14):0)},0);
  const bomb=combo.kind==='炸弹'||combo.kind==='王炸';
  let score=remainingTurns(rest)*100+rest.length*2+split+combo.rank*.4+(bomb?65:0)+cards.reduce((n,c)=>n+Math.max(0,rank(c)-13)*5,0);
  if(blockSingle)score+=combo.kind==='单张'?(17-combo.rank)*120:target?0:-300;
  else if(danger&&!target&&combo.kind==='单张')score+=180;
  if(!rest.length)score=-100000;
  if(combo.kind==='王炸'&&!g.rocketUsed&&g.equipment[seat]?.some(e=>e.id==='rocket-win'))score=-200000;
  return [{cards,score}];
 }).sort((a,b)=>a.score-b.score||a.cards.join(',').localeCompare(b.cards.join(','))).map(x=>x.cards);
}

/** Compare card instances, independently of click order, and wrap after the last option. */
export function nextHint(options:number[][],selected:number[]):number[]{
 const key=sorted(selected).join(','),index=options.findIndex(cards=>sorted(cards).join(',')===key);
 return options.length?options[(index+1)%options.length]:[];
}
