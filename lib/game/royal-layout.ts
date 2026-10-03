/** Card geometry is based on usable rack width, never a fixed number of cards. */
export function royalHandLayout(count:number,width:number){
 const available=Math.max(240,width),compact=available<620;
 const cardWidth=compact?(available<340?64:78):Math.min(150,Math.max(110,available/7));
 const capacity=compact?Math.min(10,Math.max(1,Math.floor((available-cardWidth)/26)+1)):Math.max(1,Math.floor((available-cardWidth)/28)+1);
 const rowCount=Math.max(1,Math.ceil(count/capacity)),perRow=Math.max(1,Math.ceil(count/rowCount));
 const step=Math.min(compact?36:98,(available-cardWidth)/Math.max(1,perRow-1));
 return {cardWidth,step,perRow,rankSize:Math.min(compact?30:72,Math.max(22,(step-6)*.94))};
}
