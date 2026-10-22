export type HistoryGame='landlord'|'mahjong'|'holdem';
export type HistoryItem={id:string;code:string;game:HistoryGame;created:number;title:string;label:string;delta:string;unit:string;practice:boolean;replayAvailable?:boolean;modern?:boolean;rounds?:number;initial?:string;balance?:string;players?:{name:string;initial:string;balance:string;delta:string}[]};
export function roundSummary(row:{id:string;room_code:string;created:number;result:string},userId:string):HistoryItem{
 const r=JSON.parse(row.result),v3=r.kind==='landlord-v3',game=(v3?'landlord':r.kind??'landlord') as HistoryGame,me=r.seats.find((s:any)=>s.id===userId);if(!me)throw Error('Not a participant');
 const label=v3?`${r.seats[r.winner]?.name??'牌友'} 获得扩展赛制胜利`:game==='landlord'?(r.winner===r.landlord?'地主获胜':'农民获胜'):game==='holdem'?({showdown:'摊牌结算',fold:r.rules?.id==='holdem-v5'?'弃牌结算 · 全员亮牌':'无需摊牌',aborted:'本手中止'}[r.type as string]??'已结算'):r.winType==='draw'?'流局':r.winType==='aborted'?'本局中止':`${r.seats[r.winner]?.name??'牌友'}${r.winType==='self'?'自摸':'胡牌'}`;
 return {id:row.id,code:row.room_code,created:row.created,game,title:v3?'扩展赛制战报':r.roundNumber?`第 ${r.roundNumber} ${game==='holdem'?'手':'局'}`:'单局记录',label,delta:String(v3?0:me.delta??0),unit:v3?'赛制':game==='holdem'||game==='mahjong'&&r.schemaVersion===2?'筹码':'积分',practice:!!r.practice||r.seats.some((s:any)=>s.bot),modern:game==='mahjong'&&r.schemaVersion===2};
}
/** A table archive contains balances only, never its internal room state or hidden hands. */
export function tableSummary(row:{code:string;title:string;updated:number;state:string},userId:string):HistoryItem{
 const g=JSON.parse(row.state),me=g.seats.find((s:any)=>s.id===userId);if(!me)throw Error('Not a participant');
 const players=g.seats.map((s:any)=>{const initial=String(g.kind==='holdem'?s.brought:g.initialChips),balance=String(g.kind==='holdem'?s.stack:s.balance);return {name:s.name,initial,balance,delta:(BigInt(balance)-BigInt(initial)).toString()}}),own=players[g.seats.indexOf(me)];
 return {id:row.code,code:row.code,game:g.kind,created:g.ended||row.updated,title:row.title,label:'整桌结束',delta:own.delta,unit:'筹码',practice:!!g.practice||g.seats.some((s:any)=>s.bot),modern:g.kind==='mahjong',rounds:g.roundNumber,initial:own.initial,balance:own.balance,players};
}
