/** Timing is independent from the immutable room snapshot and never changes its revision. */
export function createRoomTiming(){
 let offset=0;const listeners=new Set<()=>void>();
 return {
  offset:()=>offset,
  update(serverNow:number,receivedAt=Date.now()){offset=serverNow-receivedAt;for(const listener of listeners)listener();},
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
 };
}
export type RoomTiming=ReturnType<typeof createRoomTiming>;
export const remainingSeconds=(deadline:number,now:number,offset:number)=>Math.max(0,Math.ceil((deadline-now-offset)/1000));
