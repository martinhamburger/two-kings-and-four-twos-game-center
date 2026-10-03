import {classifyFour} from '../game/four-player.ts';
import {classify,type Combo} from '../game/engine.ts';

export type Effect='select'|'card'|'tile'|'pass'|'claim'|'bomb'|'deal'|'win'|'turn'|'tick';
export type Cue={speech?:string;effect:Effect;group?:string};
export type PublicLog={text:string;at:number};
export type SoundGame={kind?:string;rules?:{id?:string};round:string;phase:string;turn:number;deadline:number;seats:{id:string;name:string}[];log:PublicLog[];pending?:{from:number;tile:number}|null;options?:{canDiscard:boolean;canPass:boolean};canChoose?:boolean};
export type SoundFrame={code:string;serverNow:number;receivedAt:number;game:SoundGame};
const points:Record<number,string>={3:'三',4:'四',5:'五',6:'六',7:'七',8:'八',9:'九',10:'十',11:'勾',12:'圈',13:'凯',14:'尖',15:'二',16:'小王',17:'大王'};
export function pokerSpeech(combo:Combo){const r=points[combo.rank],range=`${points[combo.rank-combo.chain+1]}到${r}`;switch(combo.kind){
 case '单张':return r;case '对子':return '对'+r;case '三张':return '三个'+r;case '炸弹':return ({4:'四',5:'五',6:'六',7:'七',8:'八'} as Record<number,string>)[combo.size]+'个'+r+'，炸弹';case '王炸':return '王炸';
 case '三带一':return '三个'+r+'，带一张';case '三带二':return '三个'+r+'，带一对';case '顺子':return '顺子，'+range;case '连对':return '连对，'+range;
 case '飞机':return '飞机，'+range;case '飞机带单':return '飞机带单，'+range;case '飞机带对':return '飞机带对，'+range;case '四带二':return '四个'+r+'，带两张';case '四带两对':return '四个'+r+'，带两对';default:return combo.kind;
}}
function parsePoker(suffix:string,four=false):Cue|null{
 if(suffix==='加倍 ×2'||suffix==='不加倍')return {speech:suffix==='不加倍'?'不加倍':'加倍',effect:'claim'};
 if(suffix==='不出'||suffix==='不叫')return {speech:suffix,effect:'pass'};
 if(/^[123] 分$/.test(suffix))return {speech:['','一分','两分','三分'][Number(suffix[0])],effect:'claim'};
 const split=suffix.indexOf(' ');if(split<0)return null;const kind=suffix.slice(0,split),tokens=suffix.slice(split+1).split(' '),used=new Map<number,number>(),cards:number[]=[];
 for(const token of tokens){const rank=({J:11,Q:12,K:13,A:14,'2':15,'小王':16,'大王':17} as Record<string,number>)[token]??Number(token);if(!Number.isInteger(rank)||rank<3||rank>17)return null;const n=used.get(rank)||0;used.set(rank,n+1);cards.push(rank<16?(rank-3)*4+(n%4)+(n>=4?54:0):(rank===16?52:53)+(n?54:0));}
 const combo=four?classifyFour(cards):classify(cards);if(!combo||combo.kind!==kind)return null;return {speech:pokerSpeech(combo),effect:['炸弹','王炸'].includes(kind)?'bomb':'card'};
}
export function mahjongSpeech(label:string){
 const match=/^([1-9])(万|筒|条)/.exec(label);let spoken=match?['','一','二','三','四','五','六','七','八','九'][Number(match[1])]+match[2]:({东:'东风',南:'南风',西:'西风',北:'北风',中:'红中',发:'发财',白:'白板'} as Record<string,string>)[label[0]];
 if(!spoken)return null;if(label.includes('（赖）'))spoken+='，赖子';const substitute=/（代 ([1-9][万筒条]|[东南西北中发白])）/.exec(label);if(substitute)spoken+='，代'+mahjongSpeech(substitute[1]);return spoken;
}
/** Reads only public action logs. Drawn tiles and other players' claim options are never consulted. */
export function logCue(log:PublicLog,g:SoundGame):Cue|null{
 const text=log.text;if(text.startsWith('发牌完成')||/^第 \d+ 局开始，/.test(text))return {speech:'开始发牌',effect:'deal'};
 if(text.includes('本局流局')&&text.startsWith('牌墙'))return {speech:'本局流局',effect:'pass'};
 if(g.kind==='holdem'){if(text.startsWith('发出'))return {speech:text.slice(2),effect:'card'};if(text==='摊牌结算完成'||text==='其余玩家弃牌，本局结束')return {speech:'本手结束',effect:'win'};}
 if(text.startsWith('地主获胜')||text.startsWith('农民获胜'))return {speech:text.startsWith('地主')?'地主获胜':'农民获胜',effect:'win'};
 for(const s of [...g.seats].sort((a,b)=>b.name.length-a.name.length)){
  const prefix=g.kind==='mahjong'?s.name+' ':text.startsWith(s.name+'：')?s.name+'：':s.name+' ';if(!text.startsWith(prefix))continue;const tail=text.slice(prefix.length);
  if(g.kind==='holdem'){const move=/^(弃牌|过牌|全下跟注|跟注|全下至|加注至)(?: |$)/.exec(tail);return move?{speech:move[1].startsWith('全下')?'全下':move[1].startsWith('加注')?'加注':move[1],effect:move[1]==='弃牌'?'pass':'claim'}:null;}
  if(g.kind!=='mahjong'){if(tail==='成为地主')return {speech:'地主就位',effect:'deal'};return parsePoker(tail,g.rules?.id==='landlord-four-v1');}
  if(tail.startsWith('打出 ')){const speech=mahjongSpeech(tail.slice(3));return speech?{speech,effect:'tile'}:null;}
  if(/^胡牌，正在选择/.test(tail))return {speech:'胡了',effect:'claim'};
  if(/^(自摸|抢杠胡|胡牌)[ ·，]/.test(tail))return {speech:g.phase==='choosing'?undefined:tail.startsWith('自摸')?'自摸':tail.startsWith('抢杠胡')?'抢杠胡':'胡了',effect:'win'};
  if(tail==='杠后补牌')return {speech:'杠',effect:'claim',group:`${s.id}:${log.at}:kong`};
  const call=/^(暗杠|补杠|明杠|杠|碰|吃)(?: |，|$)/.exec(tail);if(call)return {speech:call[1],effect:'claim',group:`${s.id}:${log.at}:${call[1].includes('杠')?'kong':call[1]}`};
  return null;
 }return null;
}
export function actionWindow(g:SoundGame,userId:string){const seat=g.seats.findIndex(s=>s.id===userId),active=g.kind==='mahjong'?(g.phase==='choosing'&&g.canChoose)||(g.phase==='playing'&&(g.options?.canDiscard||g.options?.canPass)):['playing','bidding'].includes(g.phase)&&g.turn===seat;return seat>=0&&active?`${g.round}:${g.phase}:${g.turn}:${g.pending?.from??''}:${g.pending?.tile??''}:${g.deadline}`:'';}
export function collectSounds(previous:SoundFrame|null,next:SoundFrame,userId:string):Cue[]{
 if(!previous||previous.code!==next.code||next.receivedAt-previous.receivedAt>10000)return [];
 const a=previous.game.log,b=next.game.log;let fresh:PublicLog[]=[];
 if(previous.game.round!==next.game.round)fresh=b;
 else if(!a.length)fresh=b;
 else{let overlap=Math.min(a.length,b.length);for(;overlap>0;overlap--)if(a.slice(-overlap).every((l,i)=>l.at===b[i].at&&l.text===b[i].text))break;if(overlap)fresh=b.slice(overlap);}
 const seen=new Set<string>(),cues:Cue[]=[];for(const l of fresh){if(next.serverNow-l.at>8000||l.at-next.serverNow>1000)continue;const cue=logCue(l,next.game);if(!cue||cue.group&&seen.has(cue.group))continue;if(cue.group)seen.add(cue.group);if(previous.game.phase==='choosing'&&next.game.phase==='finished'&&cue.effect==='win')cue.speech='本局结束';cues.push(cue);}
 const current=actionWindow(next.game,userId);if(current&&current!==actionWindow(previous.game,userId))cues.push({effect:'turn'});return cues;
}
