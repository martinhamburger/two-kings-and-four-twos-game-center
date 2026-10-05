export type LandlordLayoutMode='ordinary'|'four'|'skill';
/** Stable slots are based on viewport and mode, never on the number of remaining cards. */
export function landlordHandLayout(count:number,width:number,mode:LandlordLayoutMode){
 const available=Math.max(240,width),desktop=available>=900,skill=mode==='skill';
 const cardWidth=desktop?(skill?44:96):skill?44:56;
 const capacity=skill?54:mode==='four'?33:21;
 const minimumStep=desktop?(skill?24:26):22;
 const maxPerRow=Math.max(1,Math.floor((available-cardWidth)/minimumStep)+1);
 const perRow=Math.min(maxPerRow,desktop?Math.ceil(capacity/(skill?2:1)):maxPerRow);
 const step=Math.min(desktop?(skill?30:42):28,(available-cardWidth)/Math.max(1,perRow-1));
 return {cardWidth,step,perRow,rows:Math.max(1,Math.ceil(count/perRow)),capacity,rankSize:skill?28:Math.max(20,Math.min(42,step))};
}
/** Every submitted card remains visible, including a 33-card airplane. */
export function playedCardsLayout(count:number,width:number,maxHeight=112){
 const available=Math.max(40,width),rows=count>12?2:1,perRow=Math.max(1,Math.ceil(count/rows));
 const cardWidth=Math.max(22,Math.min(rows===2?34:58,(maxHeight-8-(rows-1)*4)/(1.5*rows)));
 const step=Math.min(30,(available-cardWidth)/Math.max(1,perRow-1));
 return {cardWidth,step,perRow,rows};
}
export function landlordFrame(height:number){
 const toolbar=48,hud=36,controls=52,hand=164,gaps=8;
 return {toolbar,hud,controls,hand,gaps,arena:Math.max(0,height-toolbar-hud-controls-hand-gaps)};
}
