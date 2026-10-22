import type {ReplayEvent,ReplayFrame} from './types.ts';

export type ReplayMoment={kind:'action'|'message';frameIndex:number;event?:ReplayEvent};

/** Messages share their preceding result; seeking always addresses a game step. */
export function replayTimeline(frames:ReplayFrame[],events:ReplayEvent[]):ReplayMoment[]{
 const moments:ReplayMoment[]=[];
 const ordered=[...events].sort((a,b)=>a.at-b.at||a.id-b.id);
 let cursor=0;
 for(let i=0;i<frames.length;i++){
  moments.push({kind:'action',frameIndex:i});
  const end=frames[i+1]?.at??Infinity;
  while(cursor<ordered.length&&ordered[cursor].at<end){
   if(ordered[cursor].at>=frames[i].at)moments.push({kind:'message',frameIndex:i,event:ordered[cursor]});
   cursor++;
  }
 }
 return moments;
}

export function replayStepPositions(moments:ReplayMoment[]):number[]{
 return moments.flatMap((moment,index)=>moment.kind==='action'?[index]:[]);
}
