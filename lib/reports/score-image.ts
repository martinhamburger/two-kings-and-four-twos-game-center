import {scoreScale,SCORE_COLORS,type ScoreReport} from './score';
/** Export the same complete trajectory as the screen, independent of detail pagination. */
export function drawScoreChart(c:CanvasRenderingContext2D,r:ScoreReport,top:number,width:number){
 const left=64,right=width-64,chartTop=top+70,height=310,scale=scoreScale(r.points.flatMap(p=>p.values));
 c.fillStyle='#23443a';c.font='600 32px sans-serif';c.fillText(`分数曲线 / ${r.unit}`,left,top);
 c.strokeStyle='#d9e4dc';c.lineWidth=1;
 for(let i=0;i<=4;i++){const yy=chartTop+i*height/4;c.beginPath();c.moveTo(left,yy);c.lineTo(right,yy);c.stroke();}
 const x=(i:number)=>left+i/Math.max(1,r.points.length-1)*(right-left),y=(v:string)=>chartTop+height*(1-scale.ratio(v));
 c.strokeStyle='#9aafa2';c.beginPath();c.moveTo(left,y('0'));c.lineTo(right,y('0'));c.stroke();
 for(let i=0;i<r.players.length;i++){c.strokeStyle=SCORE_COLORS[i%SCORE_COLORS.length];c.lineWidth=4;c.beginPath();let started=false;for(const [index,p] of r.points.entries()){const value=p.values[i];if(value===null){started=false;continue;}if(started)c.lineTo(x(index),y(value));else c.moveTo(x(index),y(value));started=true;}c.stroke();}
 c.font='23px sans-serif';c.fillStyle='#667b70';c.fillText('起点',left,chartTop+height+36);c.textAlign='right';c.fillText(r.points.at(-1)?.label??'',right,chartTop+height+36);c.textAlign='left';
 let yy=chartTop+height+82;
 for(const [i,p] of r.players.entries()){c.fillStyle=SCORE_COLORS[i%SCORE_COLORS.length];c.fillRect(left,yy-18,18,18);c.font='25px sans-serif';c.fillText(p.name,left+32,yy);c.textAlign='right';const value=r.points.at(-1)?.values[i]??'0';c.fillText((BigInt(value)>0n?'+':'')+BigInt(value).toLocaleString('zh-CN'),right,yy);c.textAlign='left';yy+=42;}
 c.fillStyle='#667b70';c.font='22px sans-serif';c.fillText('逐局累计已保存结算；精确数值与完整明细见战报页面。',left,yy+8);return yy+58;
}
