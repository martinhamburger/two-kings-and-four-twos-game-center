import {drawScoreChart} from '../reports/score-image';
import {mahjongScores} from '../reports/score';
import {chips,resultName,type Report} from './report';
import {typeName} from './solver';
import {tileFaceSrc} from './art';

/** The PNG and the page consume the same sanitized result, with exact integer formatting. */
export async function createReportImage(report:Report,shareUrl=''){
 await document.fonts.ready;
 const round=report.scope==='round'?report.rounds[0]:null;
 const types=new Set(round?[...round.groups.flatMap(g=>g.types),...round.awards.map(a=>a.tile/4|0)]:[]);
 const faces=new Map<number,HTMLImageElement>();
 await Promise.all([...types].map(async type=>{const image=new Image();image.src=tileFaceSrc(type);try{await image.decode();}catch{throw new Error('牌面载入失败，请稍后重新下载');}faces.set(type,image);}));
 const canvas=document.createElement('canvas'),width=1080;canvas.width=width;canvas.height=9000;
 const c=canvas.getContext('2d')!;c.fillStyle='#f8f7f0';c.fillRect(0,0,width,canvas.height);let y=76;
 const ink='#23443a',muted='#64776e',green='#267456',gold='#a2772e';
 function text(value:string,x:number,yy:number,size=30,color=ink,weight=400){c.font=`${weight} ${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`;c.fillStyle=color;c.fillText(value,x,yy);}
 function wrap(value:string,x:number,yy:number,maxWidth:number,size=28,color=ink,weight=400){c.font=`${weight} ${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;let line='',row=yy;for(const ch of value){if(c.measureText(line+ch).width>maxWidth&&line){text(line,x,row,size,color,weight);row+=size*1.55;line='';}line+=ch;}if(line)text(line,x,row,size,color,weight);return row+size*1.55;}
 function rule(){c.strokeStyle='#d8e1d7';c.lineWidth=2;c.beginPath();c.moveTo(64,y);c.lineTo(1016,y);c.stroke();y+=35;}
 function pill(value:string,x:number,yy:number,w:number){c.fillStyle='#e6eee4';c.beginPath();c.roundRect(x,yy-29,w,46,23);c.fill();text(value,x+18,yy,24,green,600);}
 function tile(type:number,x:number,yy:number,w=48,h=66,marked=false){
  c.fillStyle='#8db3a2';c.beginPath();c.roundRect(x,yy+4,w,h,7);c.fill();
  const glaze=c.createLinearGradient(x,yy,x+w,yy+h);glaze.addColorStop(0,'#ffffff');glaze.addColorStop(1,'#f5f2e8');c.fillStyle=glaze;c.strokeStyle=marked?gold:'#cbd7c9';c.lineWidth=marked?3:1;c.beginPath();c.roundRect(x,yy,w,h,7);c.fill();c.stroke();c.drawImage(faces.get(type)!,x+3,yy+3,w-6,h-6);
 }
 text('娱 乐 中 心'+(report.practice?' · 人机对局':''),64,y,26,green,700);text(report.scope==='table'?'整 桌 战 报':'本 局 战 报',804,y,24,muted,500);y+=80;
 y=wrap(report.title,64,y,952,58,ink,650)+15;
 pill(report.ruleName,64,y,report.ruleName==='ham 规'?150:170);text(`基础 ${chips(report.baseChips)} 筹码`,250,y,27,muted);y+=65;
 text(new Date(report.ended).toLocaleString('zh-CN',{hour12:false}),64,y,25,muted);y+=45;rule();
 const rows=report.players;const top=[...rows].sort((a,b)=>BigInt(a.delta)>BigInt(b.delta)?-1:BigInt(a.delta)<BigInt(b.delta)?1:0)[0];
 if(top&&BigInt(top.delta)>0n){text(report.scope==='table'?'本桌领先':'本局领先',64,y,26,muted);y+=55;y=wrap(`${top.name}  ${chips(top.delta,true)}`,64,y,952,50,green,700)+20;}
 text('玩家',64,y,25,muted);text(report.scope==='table'?'初始筹码':'局前筹码',350,y,25,muted);text('净输赢',583,y,25,muted);text('结余筹码',812,y,25,muted);y+=50;
 for(const player of rows){const start=y;const ends=[wrap(player.name+(player.bot?' · 机器人':''),64,start,250,32,ink,600),wrap(chips(player.initial),350,start,200,28,muted),wrap(chips(player.delta,true),583,start,200,30,BigInt(player.delta)>=0n?green:'#ad6648',650),wrap(chips(player.balance),812,start,204,28,ink,600)];y=Math.max(...ends)+24;}
 y+=10;rule();text(`完成 ${report.stats.completed} 局　·　流局 ${report.stats.draws} 局　·　中止 ${report.stats.aborted} 局`,64,y,28,muted);y+=65;
 const scores=report.scores??mahjongScores(report.players,report.rounds,report.title);
 if(scores.points.length>1)y=drawScoreChart(c,scores,y,width);
 if(round){
  text(`第 ${round.number} 局 · ${resultName(round)}`,64,y,38,ink,650);y+=62;
  if(round.family==='fourWild'){y=wrap('四赖直胡 · 下方为已选牌张身份，不要求成型',64,y,952,27,muted)+15;}
  if(round.groups.length){
   let x=64;for(const g of round.groups){const required=g.types.length*48+20;if(x+required>1016&&x>64){x=64;y+=90;}
    for(let i=0;i<g.types.length;i++){if(x+44>1016){x=64;y+=90;}tile(g.types[i],x,y-25,43,66,g.incoming===i);if(g.wild[i]){c.fillStyle='#f9e6b0';c.beginPath();c.roundRect(x+26,y-31,20,20,5);c.fill();text('赖',x+29,y-16,13,gold,600);}x+=48;}x+=20;
   }y+=90;
  }
  if(round.fans.length){y=wrap(round.fans.map(f=>`${f.name} ×${f.multiplier}`).join('　·　'),64,y,952,27,muted)+15;text(`合计 ${chips(round.multiplier)} 倍`,64,y,36,green,650);y+=60;}
  if(round.awards.length){text('翻奖牌',64,y,26,muted);y+=25;for(const [i,a] of round.awards.entries()){const x=64+i*470;tile(a.tile/4|0,x,y,60,82,a.hit);text(a.hit?'命中 +1':'未命中',x+82,y+32,30,a.hit?gold:muted,600);text(typeName(a.tile/4|0)+((a.tile/4|0)!==a.type?'（代 '+typeName(a.type)+'）':''),x+82,y+68,26,muted);}y+=128;const n=round.awards.filter(a=>a.hit).length;const amount=(BigInt(round.base)*BigInt(1+n)*BigInt(round.multiplier)).toString();y=wrap(`每位付款者：${chips(round.base)} × ${1+n} × ${chips(round.multiplier)} = ${chips(amount)} 筹码`,64,y,952,30,ink,600)+20;}
  for(const e of round.entries)y=wrap(e.description,64,y,952,26,muted)+13;
 }else if(report.rounds.length){text(report.page?'本页对局':'最近对局',64,y,34,ink,650);y+=52;for(const r of report.rounds.slice(0,6)){y=wrap(`第 ${r.number} 局　${resultName(r)}${r.winner?'　×'+chips(r.multiplier):''}`,64,y,952,28,ink)+12;}if(report.totalRounds>6){text('逐局明细可在战报页面中查看',64,y,25,muted);y+=48;}}
 y+=28;rule();text('娱乐筹码 · 牌桌好时光',64,y,25,muted);y+=45;if(shareUrl)y=wrap(shareUrl.replace(/^https?:\/\//,''),64,y,952,22,green)+15;else {text('娱乐中心',64,y,26,green,600);y+=45;}
 const output=document.createElement('canvas');output.width=width;output.height=Math.ceil(y+30);output.getContext('2d')!.drawImage(canvas,0,0);
 const blob=await new Promise<Blob>((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(new Error('图片生成失败，请重试')),'image/png'));
 return {blob,filename:`娱乐中心-${report.scope==='table'?'整桌战报':'第'+report.rounds[0].number+'局'}-${new Date(report.ended).toISOString().slice(0,10)}.png`};
}
