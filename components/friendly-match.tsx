"use client";
import {useEffect,useId,useState} from 'react';
import {ChevronRight,Crown,Flag,Medal,Trophy,X} from 'lucide-react';
import {friendlyStandings,type FriendlyMatch} from '@/lib/friendly-match';
import {formatScore} from '@/lib/reports/score';
import {royalMotion} from '@/lib/motion/royal';
import Link from './site-navigation';
import {PlayerAvatar} from './player-avatar';
import {MotionPlayback,useReducedMotion} from './motion-playback';
import {useEmotePreferences} from './emote-preferences';
import {Button} from './ui/button';
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from './ui/dialog';
import '@/app/friendly-match.css';

const choices=[0,1,4,8,12] as const;
const revealed=new Set<string>();
const winMotion=royalMotion('king','win');
const princessMotion=royalMotion('princess','win');

export function FriendlyMatchPicker({value,onChange,disabled=false}:{value:number;onChange:(n:number)=>void;disabled?:boolean}){
 const help=useId();
 return <fieldset className="friendly-picker" disabled={disabled} aria-describedby={help}>
  <legend><Flag size={17} aria-hidden="true"/>赛制</legend>
  <div className="friendly-options">{choices.map(n=><button type="button" key={n} aria-pressed={value===n} onClick={()=>onChange(n)}>{n?`${n} 局`:'自由对局'}</button>)}</div>
  <p id={help}>{value?`打满 ${value} 局比总成绩，同分共享冠军。首局开始后固定同桌玩家。`:'不设局数，随时约朋友再来一局。'}</p>
 </fieldset>;
}

type PanelProps={match:FriendlyMatch|undefined;game:'landlord'|'mahjong'|'holdem';code:string;onReturn:()=>void;userId?:string};
export function FriendlyMatchPanel(props:PanelProps){
 return props.match?<MatchPanel key={`${props.userId??'guest'}:${props.match.id}`} {...props} match={props.match}/>:null;
}

function MatchPanel({match,game,code,onReturn,userId}:PanelProps&{match:FriendlyMatch}){
 const [open,setOpen]=useState(false),[celebration,setCelebration]=useState<number|null>(null),reduced=useReducedMotion();
 const {prefs}=useEmotePreferences(userId??'');
 const finished=match.status==='finished',ended=finished||match.status==='interrupted',played=match.rounds.length;
 const title=finished?'友谊赛结算':match.status==='interrupted'?'本场提前结束':'本场成绩';
 const gameName=game==='landlord'?'斗地主':game==='mahjong'?'麻将':'德州扑克';
 const description=finished?`${played} 局打完，来看看大家的成绩。`:ended?`已打完 ${played} / ${match.target} 局，已结算成绩保留。`:match.status==='waiting'?'首局开始后固定同桌玩家，打满局数比总成绩。':`已打完 ${played} / ${match.target} 局，按累计${match.unit}排名。`;
 const rows=friendlyStandings(match);
 const champions=finished?rows.filter(player=>player.rank===1):[];
 useEffect(()=>{
  if(!ended||!userId)return;
  const key=`sly-friendly-revealed:${userId}:${match.id}:${match.status}`;
  const timer=setTimeout(()=>{
   if(revealed.has(key))return;
   try{if(sessionStorage.getItem(key)){revealed.add(key);return;}sessionStorage.setItem(key,'1');}catch{/* In-memory fallback still prevents repeated reveals during polling. */}
   revealed.add(key);setOpen(true);if(finished)setCelebration(Date.now());
  },0);
  return()=>clearTimeout(timer);
 },[ended,finished,match.id,match.status,userId]);
 useEffect(()=>{
  if(celebration===null)return;
  const timer=setTimeout(()=>setCelebration(null),Math.max(0,celebration+2000-Date.now()));return()=>clearTimeout(timer);
 },[celebration]);
 function changeOpen(next:boolean){setOpen(next);if(!next)setCelebration(null);}
 return <section className="friendly-panel" aria-label="友谊赛进度">
  <div className="friendly-progress"><span className="friendly-tag"><Flag size={15} aria-hidden="true"/>友谊赛</span><strong>{match.status==='waiting'?`${match.target} 局赛 · 等待开赛`:finished?'全场结束':ended?'提前结束':`已完成 ${played} / ${match.target} 局`}</strong></div>
  <Dialog open={open} onOpenChange={changeOpen}>
   <DialogTrigger asChild><Button type="button" className="friendly-open" variant="outline" aria-label={`友谊赛${ended?'本场结算':'本场成绩'}，已完成 ${played} / ${match.target} 局`}><Trophy size={16} aria-hidden="true"/><span className="friendly-open-label">{ended?'本场结算':'本场成绩'}</span><span className="friendly-open-compact">{match.status==='waiting'?`${match.target} 局赛`:finished?'本场结算':ended?'提前结束':`${played}/${match.target} 局`}<small>友谊赛</small></span><ChevronRight className="friendly-open-arrow" size={14} aria-hidden="true"/></Button></DialogTrigger>
   <DialogContent className="friendly-results" showCloseButton={false}>
    <DialogHeader><span className="friendly-eyebrow"><Flag size={14} aria-hidden="true"/>{gameName} · {match.target} 局友谊赛</span><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
    <DialogClose asChild><button type="button" className="friendly-close" aria-label="关闭友谊赛成绩"><X size={20} aria-hidden="true"/></button></DialogClose>
    <div className="friendly-result-body" tabIndex={0} role="region" aria-label="本场成绩与逐局明细">
    {finished&&champions.length>0?<section className="friendly-coronation" aria-label={champions.length>1?'并列冠军':'本场冠军'}>
     <div className="friendly-crown-title"><Crown size={34} aria-hidden="true"/><div><h3>{champions.length>1?'并列冠军':'本场冠军'}</h3><p>{champions.length>1?`${champions.length} 位牌友共享王冠`:'本场累计成绩第一'}</p></div></div>
     {celebration!==null&&!reduced&&prefs.effects&&<div className="friendly-celebration" aria-hidden="true"><MotionPlayback motion={winMotion} animate startAt={celebration} expiresAt={celebration+2000}/><MotionPlayback motion={princessMotion} animate startAt={celebration} expiresAt={celebration+2000}/></div>}
    </section>:ended?<div className="friendly-interrupted"><Flag size={24} aria-hidden="true"/><div><p>成绩保留，下次再争王冠</p><small>{match.reason||'未打满约定局数，本场不颁发冠军。'}</small></div></div>:null}
    <section className="friendly-standing" aria-label="全员累计成绩"><h3><Medal size={20} aria-hidden="true"/>全场成绩单 <small>累计{match.unit}</small></h3>
     {rows.length?<ol>{rows.map(player=><li key={player.id} className={finished&&player.rank===1?'is-champion':undefined}><span className="friendly-rank" aria-label={`第 ${player.rank} 名`}>{finished&&player.rank===1?<Crown size={20} aria-hidden="true"/>:player.rank}</span><PlayerAvatar name={player.name} userId={player.id} bot={player.bot}/><div className="friendly-player"><b>{player.name}</b><small>{player.bot?'人机':player.id===userId?'你':'牌友'}{finished&&player.rank===1?champions.length>1?' · 并列冠军':' · 本场冠军':''}</small></div><strong className={BigInt(player.total)<0n?'is-negative':''}>{formatScore(player.total,true)}<small>{match.unit}</small></strong></li>)}</ol>:<p className="friendly-note">等大家入座，准备开赛！</p>}
    </section>
    {played>0&&<details className="friendly-rounds"><summary>逐局成绩 · {played} 局</summary><p className="friendly-note">显示每一局的净变化；{game==='holdem'?'一手计一局，补筹码不算赢分。':'只统计已完成的结算。'}</p>{match.rounds.map((round,index)=><details key={round.id}><summary>第 {index+1} 局</summary><ul>{match.roster.map((player,seat)=><li key={player.id}><span>{player.name}</span><b>{formatScore(round.deltas[seat]??'0',true)} {match.unit}</b></li>)}</ul></details>)}</details>}
    {!ended&&<p className="friendly-note">累计成绩最高者获胜，同分并列。{game==='holdem'?'补充带入不计盈利。':''}</p>}
    </div>
    <footer className="friendly-result-actions"><Button type="button" variant="outline" onClick={()=>changeOpen(false)}>继续看牌桌</Button>{ended&&<><Button asChild variant="outline"><Link href={`/history?room=${encodeURIComponent(code)}`}>查看战报</Link></Button><Button type="button" onClick={onReturn}>返回大厅</Button></>}</footer>
   </DialogContent>
  </Dialog>
 </section>;
}
