import type {V3Equipment,V3Shop} from '../game/landlord-v3.ts';

export type ReplayGame = 'landlord' | 'landlord-v3' | 'mahjong' | 'holdem';

export type ReplaySeat = {
  id?: string; name: string; bot?: boolean; hand: number[]; count?: number; ready?: boolean;
  last?: string; plays?: number; river?: number[]; discards?: number[];
  melds?: {kind: string; tiles?: number[]; cards: number[]; from?: number; concealed?: boolean}[];
  chips?: string; balance?: string; stack?: string; brought?: string;
  tableScore?: number | string; delta?: number | string;
  bet?: string; total?: string; folded?: boolean; allIn?: boolean;
  action?: {id: string; kind: string; paid: string; street: string; at?: number};
};

export type ReplayFrame = {
  at: number; action: string; actor?: number;
  durationMs?: number; timing?: 'manual' | 'timeout' | 'automatic';
  scene: {
    game: ReplayGame; phase: string; turn?: number; seats: ReplaySeat[];
    round?: string; roundNumber?: number; schemaVersion?: number;
    rulesId?: string; rulesName?: string; rules?: {id?: string; name?: string; [key: string]: unknown};
    board?: number[]; bottom?: number[]; bottomRevealed?: boolean; last?: number[];
    lastPlay?: {seat: number; cards: number[]; combo?: {kind: string; rank: number; size: number; chain: number}} | null;
    tableActions?: ({kind: string; cards?: number[]; label?: string; eventId?: string; value?: number | boolean} | null)[];
    landlord?: number; bid?: number | string; multiplier?: number; doubles?: (boolean | null)[];
    spring?: boolean; deltas?: (number | string)[]; champion?: number;
    coins?: string[]; victoryPoints?: string[]; stake?: string; equipment?: V3Equipment[][]; shops?: V3Shop[];
    wallRemaining?: number; pot?: string; street?: string; wildcard?: number;
    dealer?: number; winner?: number; lastDiscard?: {seat: number; tile: number};
    button?: number; smallSeat?: number; bigSeat?: number; capacity?: number;
    currentBet?: string; result?: unknown;
    mahjong?: {
      round: string; roundNumber: number; remaining: number; drawn: number | null;
      pending: {kind: string; from: number; tile: number} | null;
      winType: string | null; deltas: (number | string)[];
      rulesId?: string; rulesName?: string; schemaVersion?: number;
    };
  };
};

export type ReplayEvent = {id: number; at: number; seat: number; kind: 'text' | 'emote'; text?: string; emoteId?: string};

export type ReplayState = {
  roundId: string; game: ReplayGame; nextSeq: number; pending: ReplayFrame[];
  tableScores?: number[];
  window?: {actor: number; openedAt: number; deadline: number; phase: string};
  complete?: boolean;
};
