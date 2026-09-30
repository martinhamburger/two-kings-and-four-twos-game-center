import {mahjongScores,type ScoreReport} from '../reports/score.ts';
import type {ModernGame,RoundResult} from './modern.ts';
import type {Fan,WinPlan} from './solver.ts';
export type PublicRound = {
  family?:WinPlan['family'];
  number:number;winner:string|null;source:string|null;type:RoundResult['winType'];ended:number;wildcard:number;base:string;
  multiplier:string;automatic:boolean;fans:Fan[];groups:{kind:string;types:number[];wild:boolean[];incoming:number;exposed:boolean}[];
  awards:{tile:number;type:number;hit:boolean}[];players:{name:string;bot?:boolean;delta:string;balance:string}[];
  entries:{kind:string;description:string;deltas:string[]}[];
};
export type Report = {
  practice?:boolean;
  scores?:ScoreReport;
  version:1;scope:'round'|'table';title:string;ruleName:string;initialChips:string;baseChips:string;started:number;ended:number;
  stats:{completed:number;draws:number;aborted:number};players:{name:string;bot?:boolean;initial:string;delta:string;balance:string}[];
  rounds:PublicRound[];totalRounds:number;page:number;pageSize:number;
};
/** Public data is constructed field by field; never spread a room, seat or persisted result. */
export function publicRound(r:RoundResult):PublicRound {
  return {number:r.roundNumber,winner:r.seats[r.winner]?.name??null,source:r.source!==r.winner?r.seats[r.source]?.name??null:null,type:r.winType,ended:r.ended,wildcard:r.wildcard,base:r.baseChips,
    family:r.plan?.family,multiplier:r.plan?.multiplier??'1',automatic:r.automatic,fans:r.plan?.fans.map(f=>({id:f.id,name:f.name,multiplier:f.multiplier}))??[],
    groups:r.plan?.groups.map(g=>({kind:g.kind,types:[...g.types],wild:[...g.wild],incoming:g.incoming,exposed:!!g.exposed}))??[],
    awards:r.awards.map(a=>({tile:a.tile,type:a.type,hit:a.hit})),players:r.seats.map(s=>({name:s.name,bot:!!s.bot,delta:s.delta,balance:s.balance})),
    entries:r.entries.map(e=>({kind:e.kind,description:e.description,deltas:[...e.deltas]}))};
}
export function roundReport(title:string,r:RoundResult):Report {
  return {scores:mahjongScores(r.seats,[publicRound(r)],title),practice:!!r.practice,version:1,scope:'round',title,ruleName:r.rules.name,initialChips:r.initialChips,baseChips:r.baseChips,started:r.started,ended:r.ended,
    stats:{completed:r.winType==='aborted'?0:1,draws:r.winType==='draw'?1:0,aborted:r.winType==='aborted'?1:0},
    players:r.seats.map(s=>({name:s.name,bot:!!s.bot,initial:(BigInt(s.balance)-BigInt(s.delta)).toString(),delta:s.delta,balance:s.balance})),rounds:[publicRound(r)],totalRounds:1,page:0,pageSize:20};
}
export function tableReport(title:string,g:ModernGame):Report {
  return {practice:!!g.practice,version:1,scope:'table',title,ruleName:g.rules.name,initialChips:g.initialChips,baseChips:g.baseChips,started:g.started,ended:g.ended,stats:{...g.stats},
    players:g.seats.map(s=>({name:s.name,bot:!!s.bot,initial:g.initialChips,delta:(BigInt(s.balance)-BigInt(g.initialChips)).toString(),balance:s.balance})),rounds:[],totalRounds:g.stats.completed+g.stats.aborted,page:0,pageSize:20};
}
export function chips(v:string|number,sign=false){const n=BigInt(v);return (sign&&n>0n?'+':'')+n.toLocaleString('zh-CN');}
export const resultName=(r:Pick<PublicRound,'type'|'winner'>)=>r.type==='draw'?'流局':r.type==='aborted'?'本局中止':`${r.winner} · ${r.type==='self'?'自摸':r.type==='rob'?'抢杠胡':'胡牌'}`;
