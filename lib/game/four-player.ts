import type {Combo} from './engine.ts';
/** Two decks have distinct instance IDs 0..107; rank ignores the deck copy. */
export const fourRank=(c:number)=>c%54<52?Math.floor((c%54)/4)+3:c%54===52?16:17;
const groups=(cards:number[])=>[...cards.reduce((m,c)=>m.set(fourRank(c),[...(m.get(fourRank(c))??[]),c]),new Map<number,number[]>())].sort((a,b)=>a[0]-b[0]);
const consecutive=(rs:number[])=>rs.at(-1)!<=14&&rs.every((r,i)=>!i||r===rs[i-1]+1);
export function classifyFour(cards:number[]):Combo|null{
 if(!cards.length||cards.length>33||new Set(cards).size!==cards.length||cards.some(c=>!Number.isInteger(c)||c<0||c>=108))return null;
 const n=cards.length,g=groups(cards),rs=g.map(([r])=>r),ns=g.map(([,cs])=>cs.length),make=(kind:string,rank:number,chain=1)=>({kind,rank,size:n,chain});
 if(n===4&&g.length===2&&rs[0]===16&&rs[1]===17&&ns.every(n=>n===2))return make('王炸',17);
 if(n===1)return make('单张',rs[0]);
 if(g.length===1){if(n===2)return make('对子',rs[0]);if(n===3&&rs[0]<16)return make('三张',rs[0]);if(n>=4&&n<=8&&rs[0]<16)return make('炸弹',rs[0]);}
 if(n===5&&ns.includes(3)&&ns.includes(2))return make('三带二',rs[ns.indexOf(3)]);
 if(n>=5&&ns.every(n=>n===1)&&consecutive(rs))return make('顺子',rs.at(-1)!,n);
 if(n>=6&&ns.every(n=>n===2)&&consecutive(rs))return make('连对',rs.at(-1)!,n/2);
 if(n>=6&&ns.every(n=>n===3)&&consecutive(rs))return make('飞机',rs.at(-1)!,n/3);
 const m=n/5;
 if(Number.isInteger(m)&&m>=2)for(let start=3;start+m-1<=14;start++){
  const body=Array.from({length:m},(_,i)=>start+i),rest=g.filter(([r])=>!body.includes(r));
  if(body.every(r=>g.some(([v,cs])=>v===r&&cs.length===3))&&rest.length===m&&rest.every(([,cs])=>cs.length===2))return make('飞机带对',start+m-1,m);
 }
 return null;
}
export function beatsFour(a:Combo,b:Combo|null){
 if(!b)return true;if(b.kind==='王炸')return false;if(a.kind==='王炸')return true;
 if(a.kind==='炸弹')return b.kind!=='炸弹'||a.size>b.size||a.size===b.size&&a.rank>b.rank;
 return b.kind!=='炸弹'&&a.kind===b.kind&&a.size===b.size&&a.chain===b.chain&&a.rank>b.rank;
}
export function hintsFour(hand:number[],last:Combo|null):number[][]{
 const g=groups(hand),out=new Map<string,number[]>(),add=(cs:number[])=>{const combo=classifyFour(cs);if(combo&&beatsFour(combo,last)){const sorted=[...cs].sort((a,b)=>fourRank(b)-fourRank(a)||a-b);out.set(sorted.join(','),sorted);}};
 for(const [r,cs] of g){for(let n=1;n<=cs.length;n++)add(cs.slice(0,n));if(cs.length>=3&&r<16)for(const [other,wing]of g)if(other!==r&&wing.length>=2)add([...cs.slice(0,3),...wing.slice(0,2)]);}
 if([52,53,106,107].every(c=>hand.includes(c)))add([52,53,106,107]);
 for(let width=1;width<=3;width++)for(let start=3;start<=14;start++){
  let body:number[]=[];
  for(let end=start;end<=14;end++){
   const cs=g.find(([r])=>r===end)?.[1];if(!cs||cs.length<width)break;body=[...body,...cs.slice(0,width)];
   const m=end-start+1;if(m<(width===1?5:width===2?3:2))continue;add(body);
   if(width===3){const wings=g.filter(([r,cs])=>(r<start||r>end)&&cs.length>=2);if(wings.length>=m)add([...body,...wings.slice(0,m).flatMap(([,cs])=>cs.slice(0,2))]);}
  }
 }
 return [...out.values()].sort((a,b)=>{const x=classifyFour(a)!,y=classifyFour(b)!;return (x.kind==='王炸'?2:x.kind==='炸弹'?1:0)-(y.kind==='王炸'?2:y.kind==='炸弹'?1:0)||a.length-b.length||x.rank-y.rank;});
}
