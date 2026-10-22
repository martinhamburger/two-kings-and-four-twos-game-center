import type {ReplayFrame, ReplayGame, ReplayState} from './types.ts';
import type {V3Shop} from '../game/landlord-v3.ts';

type Seat = {
  id?: string; name: string; bot?: boolean; hand: number[]; ready?: boolean; last?: string; plays?: number;
  river?: number[]; melds?: {kind: string; tiles: number[]; from?: number; concealed?: boolean}[];
  balance?: string; stack?: string; brought?: string; bet?: string; total?: string;
  folded?: boolean; allIn?: boolean; action?: {id:string;kind:string;paid:string;at:number;street:string};
};
type CaptureGame = {
  kind?: string; phase: string; round: string; turn?: number; seats: Seat[];
  schemaVersion?: number; roundNumber?: number; rules?: {id?: string; name?: string; [key: string]: unknown};
  bottom?: number[]; last?: {seat:number; cards: number[]; combo?: {kind:string;rank:number;size:number;chain:number}}|null;
  tableActions?: ({kind:string;cards?:number[];label?:string;eventId?:string;value?:number|boolean}|null)[];
  wall?: number[]; board?: number[]; street?: string; replay?: ReplayState;
  wildcard?: number; dealer?: number; winner?: number; landlord?: number;
  bid?: number|string; multiplier?: number; doubles?: (boolean|null)[]; spring?: boolean;
  deltas?: (number|string)[]; champion?:number; coins?:string[]; victoryPoints?:string[];
  stake?:string; equipment?:ReplayFrame['scene']['equipment']; shops?:V3Shop[]; button?:number; smallSeat?:number; bigSeat?:number;
  currentBet?:string; result?:unknown; seconds?:number; deadline?:number;
  drawn?:number|null; pending?:unknown; winType?:string|null;
  lastDiscard?: {seat: number; tile: number}|null;
};

function gameKind(g: CaptureGame): ReplayGame {
  if(g.kind==='landlord-v3')return 'landlord-v3';
  if(g.kind==='mahjong')return 'mahjong';
  if(g.kind==='holdem')return 'holdem';
  return 'landlord';
}

export function replayScene(g: CaptureGame): ReplayFrame['scene'] {
  const kind=gameKind(g);
  const mahjongPending=kind==='mahjong'&&g.pending&&typeof g.pending==='object'&&!Array.isArray(g.pending)
    ?g.pending as {kind:string;from:number;tile:number}:null;
  const rules=g.rules&&structuredClone(g.rules);
  return {
    game:kind,phase:g.phase,
    ...(g.turn===undefined?{}:{turn:g.turn}),
    ...(g.round?{round:g.round}:{}),
    ...(g.roundNumber!==undefined?{roundNumber:g.roundNumber}:{}),
    ...(g.schemaVersion!==undefined?{schemaVersion:g.schemaVersion}:{}),
    ...(rules?{rules,rulesId:g.rules?.id,rulesName:g.rules?.name}:{}),
    seats:g.seats.map((s,i)=>({
      ...(s.id?{id:s.id}:{}),name:s.name,...(s.bot?{bot:true}:{}),hand:[...s.hand],count:s.hand.length,
      ...(s.ready!==undefined?{ready:s.ready}:{}),...(s.last!==undefined?{last:s.last}:{}),
      ...(s.plays!==undefined?{plays:s.plays}:{}),
      ...(s.river?{river:[...s.river],discards:[...s.river]}:{}),
      ...(s.melds?{melds:s.melds.map(m=>({kind:m.kind,tiles:[...m.tiles],cards:[...m.tiles],...(m.from===undefined?{}:{from:m.from}),...(m.concealed===undefined?{}:{concealed:m.concealed})}))}:{}),
      ...(s.balance!==undefined||s.stack!==undefined?{chips:s.balance??s.stack}:{}),
      ...(s.balance!==undefined?{balance:s.balance}:{}),...(s.stack!==undefined?{stack:s.stack}:{}),
      ...(s.brought!==undefined?{brought:s.brought}:{}),
      ...(s.bet!==undefined?{bet:s.bet}:{}),
      ...(s.total!==undefined?{total:s.total}:{}),
      ...(s.folded!==undefined?{folded:s.folded}:{}),
      ...(s.allIn!==undefined?{allIn:s.allIn}:{}),
      ...(s.action?{action:{...s.action}}:{}),
      ...(g.deltas?.[i]!==undefined?{delta:g.deltas[i]}:{})
    })),
    ...(g.board?{board:[...g.board]}:{}),
    ...(g.bottom?{bottom:[...g.bottom],bottomRevealed:kind==='landlord-v3'?g.phase!=='shopping'&&g.phase!=='bidding':g.phase!=='bidding'&&g.phase!=='doubling'}:{}),
    ...(g.last?.cards?{last:[...g.last.cards]}:{}),
    ...(g.last===undefined?{}:{lastPlay:g.last?structuredClone(g.last):null}),
    ...(g.tableActions?{tableActions:structuredClone(g.tableActions)}:{}),
    ...(g.wall?{wallRemaining:g.wall.length}:{}),
    ...(kind==='holdem'?{pot:g.seats.reduce((sum,s)=>sum+BigInt(s.total??'0'),0n).toString()}:{}),
    ...(g.street?{street:g.street}:{}),
    ...(g.wildcard!==undefined?{wildcard:g.wildcard}:{}),
    ...(g.dealer!==undefined?{dealer:g.dealer}:{}),
    ...(g.winner!==undefined?{winner:g.winner}:{}),
    ...(g.landlord!==undefined?{landlord:g.landlord}:{}),
    ...(g.bid!==undefined?{bid:g.bid}:{}),
    ...(g.multiplier!==undefined?{multiplier:g.multiplier}:{}),
    ...(g.doubles?{doubles:[...g.doubles]}:{}),
    ...(g.spring!==undefined?{spring:g.spring}:{}),
    ...(g.deltas?{deltas:[...g.deltas]}:{}),
    ...(g.champion!==undefined?{champion:g.champion}:{}),
    ...(g.coins?{coins:[...g.coins]}:{}),
    ...(g.victoryPoints?{victoryPoints:[...g.victoryPoints]}:{}),
    ...(g.stake!==undefined?{stake:g.stake}:{}),
    ...(g.equipment?{equipment:structuredClone(g.equipment)}:{}),
    ...(kind==='landlord-v3'&&g.phase==='shopping'&&g.shops?{shops:structuredClone(g.shops)}:{}),
    ...(g.button!==undefined?{button:g.button}:{}),
    ...(g.smallSeat!==undefined?{smallSeat:g.smallSeat}:{}),
    ...(g.bigSeat!==undefined?{bigSeat:g.bigSeat}:{}),
    ...(g.rules&&typeof g.rules.capacity==='number'?{capacity:g.rules.capacity}:{}),
    ...(g.currentBet!==undefined?{currentBet:g.currentBet}:{}),
    ...(g.result&&g.phase==='finished'?{result:structuredClone(g.result)}:{}),
    ...(g.lastDiscard?{lastDiscard:{...g.lastDiscard}}:{}),
    ...(kind==='mahjong'?{mahjong:{round:g.round,roundNumber:g.roundNumber??0,remaining:g.wall?.length??0,
      drawn:g.drawn??null,pending:mahjongPending?{kind:mahjongPending.kind,from:mahjongPending.from,tile:mahjongPending.tile}:null,
      winType:g.winType??null,deltas:[...(g.deltas??[])],rulesId:g.rules?.id,rulesName:g.rules?.name,schemaVersion:g.schemaVersion}}:{})
  };
}

/** Capture a server-side scene; never expose the raw room state through a replay API. */
export function captureReplay(g: CaptureGame, action: string, actor?: number, at=Date.now()): void {
  if(!g.round)return;
  const kind=gameKind(g);
  if(!g.replay||g.replay.roundId!==g.round)
    g.replay={roundId:g.round,game:kind,nextSeq:0,pending:[]};
  if(g.replay.complete)return;
  const window=g.replay.window;
  // The action may already have advanced to the next phase by the time its
  // resulting scene is captured. Consume the previous turn's window once.
  const matchesWindow=actor!==undefined&&window?.actor===actor;
  const timing=actor===undefined?'automatic':g.seats[actor]?.bot?'automatic':matchesWindow
    ?at>=window.deadline?'timeout':'manual':undefined;
  const durationMs=(timing==='manual'||timing==='timeout')&&window
    ?Math.max(0,at-window.openedAt):undefined;
  if(matchesWindow)g.replay.window=undefined;
  g.replay.pending.push({at,action,...(actor===undefined?{}:{actor}),
    ...(timing?{timing}:{}),...(durationMs===undefined?{}:{durationMs}),scene:replayScene(g)});
  g.replay.nextSeq++;
}

/** Finish the last event's scene after the operation advances its turn or phase.
 * Earlier equipment events retain their intermediate hands and outcomes. */
export function refreshReplayScene(g:CaptureGame):void {
  const replay=g.replay,latest=replay?.pending.at(-1);
  if(latest&&!replay?.complete)latest.scene=replayScene(g);
}

/** Mark the current round complete, adding its terminal state only if it changed. */
export function finishReplay(g: CaptureGame, at=Date.now()): void {
  if(!g.round)return;
  if(!g.replay||g.replay.roundId!==g.round)captureReplay(g,'结算',undefined,at);
  else {
    const latest=g.replay.pending.at(-1);
    if(!latest||JSON.stringify(latest.scene)!==JSON.stringify(replayScene(g)))
      captureReplay(g,'结算',undefined,at);
  }
  if(g.replay)g.replay.complete=true;
}
