export type FriendlyTarget=1|4|8|12;
export type FriendlyMatch={id:string;version:1;target:FriendlyTarget;status:'waiting'|'playing'|'finished'|'interrupted';roster:{id:string;name:string;bot:boolean}[];rounds:{id:string;ended:number;deltas:string[]}[];totals:string[];unit:'积分'|'筹码';startedAt?:number;endedAt?:number;reason?:string};
type MatchRoom={friendlyMatch?:FriendlyMatch;seats:{id:string;name:string;bot?:boolean}[]};
export function friendlyRounds(value:unknown):FriendlyTarget|undefined{
 if(value===undefined||value===0)return undefined;
 if(value===1||value===4||value===8||value===12)return value;
 throw Error('友谊赛请选择 1、4、8 或 12 局');
}
export function newFriendlyMatch(value:unknown,unit:FriendlyMatch['unit']):FriendlyMatch|undefined{
 const target=friendlyRounds(value);return target?{id:crypto.randomUUID(),version:1,target,status:'waiting',roster:[],rounds:[],totals:[],unit}:undefined;
}
export function assertFriendlyReady(g:MatchRoom){
 const m=g.friendlyMatch;if(!m)return;
 if(m.status==='finished'||m.status==='interrupted'||m.rounds.length>=m.target)throw Error('本场友谊赛已结束，请重新开桌');
 if(m.startedAt!==undefined&&(g.seats.length!==m.roster.length||g.seats.some((s,i)=>s.id!==m.roster[i]?.id)))throw Error('友谊赛开赛后参赛名单固定');
}
export function assertFriendlyRosterEditable(g:MatchRoom){if(g.friendlyMatch?.startedAt!==undefined)throw Error('友谊赛开赛后参赛名单固定');}
/** Called only when a real round has begun, after the last human readies. */
export function lockFriendlyMatch(g:MatchRoom,now=Date.now()){
 const m=g.friendlyMatch;if(!m)return;assertFriendlyReady(g);
 if(m.startedAt===undefined){if(new Set(g.seats.map(s=>s.id)).size!==g.seats.length)throw Error('友谊赛不能重复参赛');m.roster=g.seats.map(s=>({id:s.id,name:s.name,bot:!!s.bot}));m.totals=g.seats.map(()=>'0');m.startedAt=now;m.status='playing';}
}
/** The caller persists this state in the same version-guarded batch as the round. */
export function settleFriendlyMatch(g:MatchRoom,round:{id:string;ended:number;deltas:(string|number)[]},now=Date.now()){
 const m=g.friendlyMatch;if(!m||m.rounds.some(r=>r.id===round.id)||m.status==='finished'||m.status==='interrupted')return false;
 if(!round.id||round.deltas.length!==g.seats.length)throw Error('友谊赛结算资料不完整');
 lockFriendlyMatch(g,now);
 const deltas=round.deltas.map(d=>{const value=String(d);if(!/^-?\d+$/.test(value)||typeof d==='number'&&!Number.isSafeInteger(d))throw Error('友谊赛积分必须为精确整数');return BigInt(value).toString();});
 m.rounds.push({id:round.id,ended:round.ended,deltas});m.totals=m.totals.map((v,i)=>(BigInt(v)+BigInt(deltas[i])).toString());
 if(m.rounds.length===m.target){m.status='finished';m.endedAt=round.ended;}
 return true;
}
export function interruptFriendlyMatch(g:MatchRoom,reason:string,now=Date.now(),pendingDeparture=false){
 const m=g.friendlyMatch;if(!m||m.status==='finished'&&!pendingDeparture||m.status==='interrupted')return;
 m.status='interrupted';m.reason=reason;m.endedAt=now;
 // An unstarted table still has a useful, public participant list in its summary.
 if(!m.roster.length){m.roster=g.seats.map(s=>({id:s.id,name:s.name,bot:!!s.bot}));m.totals=g.seats.map(()=>'0');}
}
export function friendlyStandings(m:FriendlyMatch){
 const players=m.roster.map((s,i)=>({...s,total:m.totals[i]??'0',seat:i}));
 players.sort((a,b)=>BigInt(a.total)>BigInt(b.total)?-1:BigInt(a.total)<BigInt(b.total)?1:a.seat-b.seat);
 return players.map(p=>({...p,rank:players.findIndex(s=>s.total===p.total)+1,champion:m.status==='finished'&&p.total===players[0]?.total}));
}
