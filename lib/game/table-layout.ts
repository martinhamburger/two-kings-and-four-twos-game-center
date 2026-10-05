export type LandlordLayoutMode='ordinary'|'four'|'skill';
/** Stable slots are based on viewport and mode, never on the number of remaining cards. */
export function landlordHandLayout(count:number,width:number,mode:LandlordLayoutMode,handHeight=164){
 const available=Math.max(240,width),desktop=available>=900,skill=mode==='skill';
 const cardWidth=desktop?(skill?Math.min(64,Math.floor((handHeight-28)/2.8)):Math.min(116,Math.floor((handHeight-20)/1.5))):skill?48:56;
 const cardHeight=Math.floor(cardWidth*(skill?1.4:1.5));
 const capacity=skill?54:mode==='four'?33:21;
 const minimumStep=desktop?(skill?24:26):22;
 const maxPerRow=Math.max(1,Math.floor((available-cardWidth)/minimumStep)+1);
 const perRow=Math.min(maxPerRow,desktop?Math.ceil(capacity/(skill?2:1)):maxPerRow);
 const step=Math.min(desktop?(skill?44:52):28,(available-cardWidth)/Math.max(1,perRow-1));
 return {cardWidth,cardHeight,step,perRow,rows:Math.max(1,Math.ceil(count/perRow)),capacity,rankSize:skill?Math.min(28,step-4):Math.max(20,Math.min(42,step))};
}
/** Every submitted card remains visible, including a 33-card airplane. */
export function playedCardsLayout(count:number,width:number,maxHeight=112){
 const available=Math.max(40,width),rows=count>12&&(maxHeight>=100||available/count<12)?2:1,perRow=Math.max(1,Math.ceil(count/rows));
 const cardWidth=Math.max(18,Math.min(rows===2?62:90,(maxHeight-8-(rows-1)*4)/(1.5*rows)));
 const step=Math.min(44,(available-cardWidth)/Math.max(1,perRow-1));
 return {cardWidth,step,perRow,rows};
}
export function landlordFrame(height:number){
 const growth=Math.max(0,Math.min(1,(height-610)/153));
 const toolbar=48,hud=Math.round(36+4*growth),controls=Math.round(56+8*growth),hand=Math.round(164+44*growth),gaps=8;
 return {toolbar,hud,controls,hand,gaps,arena:Math.max(0,height-toolbar-hud-controls-hand-gaps)};
}
