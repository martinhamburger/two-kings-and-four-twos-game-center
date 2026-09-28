"use client";
import {useRef,useState} from 'react';
import {Button} from './ui/button';
import {MahjongTile} from './mahjong-tile';
import {TableNotice,TurnClock} from './table-ui';
import type {MahjongView} from '@/lib/mahjong/game';

type Choice={key:string;kind:string;tiles:number[]};
const names:Record<string,string>={chi:'吃',pong:'碰',kong:'杠',hu:'胡',concealed:'暗杠',added:'补杠'};
export function MahjongActions({game:g,selected,forbidden,busy,connected,seconds,onAction,hideClock=false}:{hideClock?:boolean;game:MahjongView;selected:number|null;forbidden:boolean;busy:boolean;connected:boolean;seconds:number;onAction:(action:string,data?:Record<string,unknown>)=>unknown}){
 const disabled=busy||!connected;
 const o=g.options,responding=o.canPass,active=responding||o.canDiscard||o.canHu||o.kongs.length>0;
 const choices:Choice[]=responding?o.claims:o.kongs;
 const scope=JSON.stringify([g.round,g.phase,g.turn,g.pending,g.drawn,choices.map(c=>c.key)]);
 const [selection,setSelection]=useState({scope:'',kind:'',key:''});
 const current=selection.scope===scope?selection:{scope,kind:'',key:''};
 const group=choices.filter(c=>c.kind===current.kind),picked=group.find(c=>c.key===current.key);
 const locked=useRef(false);
 function submit(action:string,data?:Record<string,unknown>){if(disabled||locked.current||seconds<=0)return;locked.current=true;Promise.resolve(onAction(action,data)).finally(()=>{locked.current=false;});}
 function choose(kind:string){const items=choices.filter(c=>c.kind===kind);if(items.length===1){submit(responding?'claim':'kong',{key:items[0].key});return;}setSelection({scope,kind,key:''});}
 return <div className={`table-action-area mj-light-actions${active?'':' is-idle'}`}>
  <div className="table-action-row">
   {active&&!hideClock&&<TurnClock seconds={seconds} label={responding?'请选择吃碰杠胡':'轮到你出牌'}/>}
   {responding&&g.pending&&<span className="mj-response-tile" aria-label="可响应的牌"><MahjongTile tile={g.pending.tile} small wildcard={g.wildcard}/></span>}
   {[...new Set(choices.map(c=>c.kind))].map(kind=><Button key={kind} variant={kind==='hu'?'default':'outline'} disabled={disabled||seconds<=0} aria-expanded={choices.filter(c=>c.kind===kind).length>1?current.kind===kind:undefined} onClick={()=>choose(kind)}>{names[kind]??kind}</Button>)}
   {responding?<Button variant="ghost" disabled={disabled||seconds<=0} onClick={()=>submit('pass')}>跳过</Button>:<>
    {o.canHu&&<Button disabled={disabled||seconds<=0} onClick={()=>submit('hu')}>{'fourWildHu' in o&&o.fourWildHu?'四赖胡':'自摸'}</Button>}
    {o.canDiscard&&<Button disabled={disabled||seconds<=0||selected===null||forbidden} onClick={()=>submit('discard',{tile:selected})}>出牌</Button>}
   </>}
  </div>
  {group.length>1&&<div className="table-choice-panel mj-choice-panel" role="group" aria-label={`选择${names[current.kind]}的组合`}>
   <div className="mj-choice-options">{group.map(c=><button type="button" className="mj-choice-option" key={c.key} aria-label={`${names[c.kind]}组合 ${group.indexOf(c)+1}`} aria-pressed={picked?.key===c.key} disabled={disabled||seconds<=0} onClick={()=>setSelection({scope,kind:c.kind,key:c.key})}>{[...c.tiles,...(responding&&g.pending?[g.pending.tile]:[])].sort((a,b)=>a-b).map((t,i)=><MahjongTile key={i} tile={t} small wildcard={g.wildcard}/>)}</button>)}</div>
   <Button disabled={disabled||seconds<=0||!picked} onClick={()=>picked&&submit(responding?'claim':'kong',{key:picked.key})}>确认{names[current.kind]}</Button>
   <Button variant="ghost" disabled={disabled} onClick={()=>setSelection({scope,kind:'',key:''})}>取消</Button>
  </div>}
  <TableNotice>{!connected?'连接恢复后可操作':busy?'正在提交…':forbidden&&selected!==null?'赖子不能打出，请换一张':active&&seconds<=0?'操作时间已到':null}</TableNotice>
 </div>;
}
