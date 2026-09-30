export type ScorePlayer = {key:string;name:string;bot:boolean};
export type ScorePoint = {label:string;round:number;ended:number;values:(string|null)[];deltas:(string|null)[];coins?:string[];outcome:string;detail:string};
export type ScoreReport = {title:string;code?:string;game:string;unit:string;note:string;players:ScorePlayer[];points:ScorePoint[];warnings:string[];champion?:string;balances?:{name:string;initial:string;balance:string;delta:string}[]};
export type ScoreRecord = {id:string;created:number;result:any};
/** Victory points include half-points; use exact tenths for comparisons and plotting. */
export function scoreUnits(value:string|number):bigint {const text=String(value);if(!/^-?\d+(?:\.\d)?$/.test(text))throw Error('无效的结算分数');const negative=text.startsWith('-'),[whole,fraction='0']=text.replace('-','').split('.');return (BigInt(whole)*10n+BigInt(fraction))*(negative?-1n:1n);}
export function scoreValue(units:bigint){const negative=units<0n,abs=negative?-units:units;return (negative?'-':'')+(abs/10n).toString()+(abs%10n?'.'+abs%10n:'');}
export function formatScore(value:string|number,sign=false){const n=scoreUnits(value),abs=n<0n?-n:n;return (n<0n?'-':sign&&n>0n?'+':'')+(abs/10n).toLocaleString('zh-CN')+(abs%10n?'.'+abs%10n:'');}
const integer=(value:unknown)=>BigInt(value as string|number??0).toString();
/** Only settled, explicitly selected fields leave the server. Player keys are report-local. */
export function scoreReport(input:ScoreRecord[],title:string,code?:string):ScoreReport {
 const rows=[...input].sort((a,b)=>a.created-b.created||a.id.localeCompare(b.id));
 const first=rows[0]?.result,extended=first?.kind==='landlord-v3',game=extended?'landlord-v3':first?.kind??'landlord';
 const ids:string[]=[],players:ScorePlayer[]=[];
 for(const row of rows)for(const s of row.result.seats??[]){let i=ids.indexOf(s.id);if(i<0){i=ids.length;ids.push(s.id);players.push({key:'curve-'+i,name:s.name,bot:!!s.bot});}}
 const warnings:string[]=[],unit=extended?'胜利点':game==='holdem'||game==='mahjong'&&first?.schemaVersion===2?'筹码':'积分';
 const note=extended?'胜利点与金币分别展示；金币含装备收支。突然死亡按先出完者决胜，冠军另行标注。':game==='holdem'?'累计每手净输赢，补充带入不计为盈利；中止退款按已保存的结算展示。':'从本报告第一局前的 0 开始，逐局累计已保存的结算；不等于账号总积分或剩余筹码。';
 const points:ScorePoint[]=[{label:'起点',round:0,ended:0,values:players.map((_,i)=>first?.seats.some((s:any)=>s.id===ids[i])?'0':null),deltas:players.map(()=>null),outcome:'结算前',detail:'',...(extended?{coins:players.map(()=> '2')}:{})}];
 const totals=players.map(()=>0n);
 if(extended){
  const r=first,history=r.rounds??[];
  for(const h of history){const prev=points.at(-1)!;points.push({label:`第 ${h.round} 局`,round:h.round,ended:0,values:players.map((_,i)=>scoreValue(scoreUnits(h.victoryPoints[i]))),deltas:players.map((_,i)=>scoreValue(scoreUnits(h.victoryPoints[i])-scoreUnits(prev.values[i]??'0'))),coins:players.map((_,i)=>integer(h.coins[i])),outcome:h.winner===h.landlord?'地主获胜':'农民获胜',detail:`地主：${players[h.landlord]?.name??'未记录'}${h.suddenDeath?' · 加赛':''}`});}
  if(history.some((h:any,i:number)=>h.round!==i+1))warnings.push('部分局号不连续，请以保存的结算节点为准。');
  if(!history.length)warnings.push('这份旧记录未保存逐局分数，无法还原走势。');
 }else rows.forEach((row,index)=>{
  const r=row.result,deltas:(string|null)[]=players.map(()=>null);
  for(const s of r.seats??[]){const i=ids.indexOf(s.id),delta=BigInt(s.delta??0);totals[i]+=delta;deltas[i]=delta.toString();}
  const aborted=r.type==='aborted'||r.winType==='aborted',draw=r.winType==='draw';
  const outcome=aborted?'本局中止':draw?'流局':game==='holdem'?(r.type==='fold'?'弃牌结算':'摊牌结算'):game==='mahjong'?`${r.seats[r.winner]?.name??'牌友'}${r.winType==='self'?'自摸':'胡牌'}`:r.winner===r.landlord?'地主获胜':'农民获胜';
  const detail=game==='landlord'?`地主：${r.seats[r.landlord]?.name??'未记录'} · 叫分 ${r.bid??'—'} · 公共倍数 ×${r.multiplier??'—'}${r.spring?' · 春天':''}${r.doubles?.some(Boolean)?' · 含个人加倍':''}`:'';
  points.push({label:`第 ${r.roundNumber??index+1} ${game==='holdem'?'手':'局'}`,round:r.roundNumber??index+1,ended:row.created,values:totals.map((v,i)=>deltas[i]!==null||points.at(-1)!.values[i]!==null?v.toString():null),deltas,outcome,detail});
 });
 return {title,code,game,unit,note,players,points,warnings,...(extended&&first.winner>=0?{champion:players[first.winner]?.key}:{})};
}
/** Fixed-seat Mahjong shares contain no account identifiers. */
export function mahjongScores(players:{name:string;bot?:boolean}[],rounds:{number:number;ended:number;type:string;winner:string|null;players:{delta:string}[]}[],title:string):ScoreReport {
 return scoreReport([...rounds].sort((a,b)=>a.number-b.number).map(r=>({id:String(r.number).padStart(12,'0'),created:r.ended,result:{kind:'mahjong',schemaVersion:2,roundNumber:r.number,winType:r.type,winner:players.findIndex(p=>p.name===r.winner),seats:players.map((p,i)=>({id:String(i),...p,delta:r.players[i]?.delta??'0'}))}})),title);
}
export const SCORE_COLORS=['#216d67','#c37824','#6162b3','#b74e70','#287ba1','#727d28','#974daa','#b6552b','#38764b','#666b85'];
/** Only bounded geometric ratios become Number; all scores and labels remain exact integers. */
export function scoreScale(values:(string|null)[]){let min=0n,max=0n;for(const v of values){if(v===null)continue;const n=scoreUnits(v);if(n<min)min=n;if(n>max)max=n;}if(max-min<40n){min-=20n;max+=20n;}return {min,max,ratio:(value:string)=>Number((scoreUnits(value)-min)*1000000n/(max-min))/1000000};}
export function scoreInsights(report:ScoreReport){
 const last=report.points.at(-1),ranking=report.players.map((p,i)=>{const values=report.points.map(r=>scoreUnits(r.values[i]??'0')),deltas=report.points.slice(1).map(r=>r.deltas[i]);let streak=0,bestStreak=0;for(const d of deltas){streak=d!==null&&scoreUnits(d)>0n?streak+1:0;bestStreak=Math.max(streak,bestStreak);}return {...p,index:i,total:last?.values[i]??'0',played:deltas.filter(d=>d!==null).length,positive:deltas.filter(d=>d!==null&&scoreUnits(d)>0n).length,bestStreak,low:scoreValue(values.reduce((a,b)=>a<b?a:b,0n))};}).sort((a,b)=>scoreUnits(a.total)>scoreUnits(b.total)?-1:scoreUnits(a.total)<scoreUnits(b.total)?1:a.index-b.index);
 const leaders=ranking.filter(p=>p.total===ranking[0]?.total);let best:{name:string;value:string;label:string}|null=null;
 for(const point of report.points.slice(1))for(const [i,v] of point.deltas.entries()){if(v!==null&&scoreUnits(v)>0n&&(!best||scoreUnits(v)>scoreUnits(best.value)))best={name:report.players[i].name,value:v,label:point.label};}
 return {ranking,leaders,best};
}
