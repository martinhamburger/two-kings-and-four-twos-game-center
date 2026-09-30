"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {Trophy,TrendingUp,Flame,ChevronLeft,ChevronRight} from 'lucide-react';
import {Button} from './ui/button';
import {formatScore as chips,scoreValue,scoreInsights,scoreScale,SCORE_COLORS,type ScoreReport} from '@/lib/reports/score';
import '@/app/reports.css';

export function ScoreChart({report:r}:{report:ScoreReport}){
 const id=useId(),[metric,setMetric]=useState<'values'|'coins'>('values'),[hidden,setHidden]=useState<string[]>([]),[selected,setSelected]=useState(r.points.length-1),[page,setPage]=useState(0);
 const chartRef=useRef<HTMLDivElement>(null),[chartWidth,setChartWidth]=useState(740);
 useEffect(()=>{const el=chartRef.current;if(!el)return;const observer=new ResizeObserver(entries=>setChartWidth(Math.max(200,entries[0].contentRect.width)));observer.observe(el);return()=>observer.disconnect();},[]);
 const unit=metric==='coins'?'金币':r.unit,point=r.points[Math.min(selected,r.points.length-1)],scale=scoreScale(r.points.flatMap(p=>p[metric]??[]));
 const x=(i:number)=>60+i/Math.max(1,r.points.length-1)*(chartWidth-80),y=(v:string)=>240-scale.ratio(v)*204;
 const toggle=(key:string)=>setHidden(old=>old.includes(key)?old.filter(k=>k!==key):[...old,key]);
 const detailRows=r.points.slice(1),pageCount=Math.max(1,Math.ceil(detailRows.length/20));
 return <section className="score-section" aria-labelledby={id}>
  <div className="score-section-heading"><div><span className="score-eyebrow">每一局，都算数</span><h3 id={id}>分数曲线 <small>／{unit}</small></h3></div>{r.game==='landlord-v3'&&<div className="score-metrics" role="group" aria-label="分数类型"><Button size="sm" variant={metric==='values'?'default':'outline'} onClick={()=>setMetric('values')}>胜利点</Button><Button size="sm" variant={metric==='coins'?'default':'outline'} onClick={()=>setMetric('coins')}>金币</Button></div>}</div>
  <p className="score-note">{r.note}</p>{r.warnings.map(w=><p className="score-warning" key={w}>{w}</p>)}
  {r.points.length<2?<p className="score-note">还没有可绘制的结算节点。</p>:<>
   <div className="score-legend" role="group" aria-label="显示玩家曲线">{r.players.map((p,i)=><button key={p.key} type="button" aria-pressed={!hidden.includes(p.key)} onClick={()=>toggle(p.key)}><i style={{background:SCORE_COLORS[i%SCORE_COLORS.length]}}/>{p.name}{p.bot?' · 人机':''}</button>)}</div>
   <div className="score-chart-wrap" ref={chartRef}><svg viewBox={`0 0 ${chartWidth} 280`} role="img" aria-label={`${r.title}，${unit}折线图。下方滑块和数据表提供逐局精确分数。`}>
    <title>{r.title} · {unit}</title>
    {[0,1,2,3,4].map(i=>{const value=scale.min+(scale.max-scale.min)*BigInt(i)/4n;return <g key={i}><line x1="60" x2={chartWidth-20} y1={y(scoreValue(value))} y2={y(scoreValue(value))} stroke="#d9e4df" strokeDasharray="3 5"/><text x="50" y={y(scoreValue(value))+4} textAnchor="end" className="score-axis">{scoreValue(value).length>6?`${(Number(value*10n/(10n**BigInt(Math.max(0,scoreValue(value).replace('-','').split('.')[0].length-1))))/100).toFixed(1)}e${scoreValue(value).replace('-','').split('.')[0].length-1}`:chips(scoreValue(value))}</text></g>})}
    <line x1="60" x2={chartWidth-20} y1={y('0')} y2={y('0')} stroke="#9baea6"/>
    <line x1={x(selected)} x2={x(selected)} y1="28" y2="240" stroke="#a6b8b0" strokeDasharray="4 4"/>
    {r.players.map((p,i)=>{if(hidden.includes(p.key))return null;let started=false;const d=r.points.map((p,n)=>{const value=p[metric]?.[i];if(value==null){started=false;return '';}const command=started?'L':'M';started=true;return `${command}${x(n)},${y(value)}`;}).join(' ');return <g key={p.key}><path d={d} fill="none" stroke={SCORE_COLORS[i%SCORE_COLORS.length]} strokeWidth="2.8" strokeLinejoin="round"/>{point?.[metric]?.[i]!=null&&<circle cx={x(selected)} cy={y(point[metric]![i]!)} r="5" stroke="white" strokeWidth="2" fill={SCORE_COLORS[i%SCORE_COLORS.length]}/>}</g>})}
    <text x="60" y="266" className="score-axis">起点</text><text x={chartWidth-20} y="266" textAnchor="end" className="score-axis">{r.points.at(-1)?.label}</text>
   </svg></div>
   <label className="score-scrubber">查看结算节点 <b>{point?.label}</b><input aria-label="查看某局分数" type="range" min="0" max={r.points.length-1} value={selected} onChange={e=>setSelected(Number(e.target.value))}/></label>
   <div className="score-selected" aria-live="polite"><p>{point?.label} · {point?.outcome}</p><div>{r.players.map((p,i)=><span key={p.key}><i style={{background:SCORE_COLORS[i%SCORE_COLORS.length]}}/>{p.name}<b>{point?.[metric]?.[i]==null?'未入桌':chips(point[metric]![i]!,metric==='values'&&r.game!=='landlord-v3')}</b></span>)}</div>{point?.detail&&<small>{point.detail}</small>}</div>
   <details className="score-data"><summary>逐局分数明细 · {detailRows.length} 个结算节点</summary><p className="score-note">每格显示累计{unit}{metric==='values'?'（括号内为本局变化）':''}。横向滚动可查看全部玩家。</p><div className="score-table-scroll" tabIndex={0} role="region" aria-label="逐局分数明细"><table><thead><tr><th>对局</th>{r.players.map(p=><th key={p.key}>{p.name}</th>)}</tr></thead><tbody>{detailRows.slice(page*20,(page+1)*20).map((p,i)=><tr key={page*20+i}><th scope="row">{p.label}<small>{p.outcome}</small></th>{r.players.map((player,index)=><td key={player.key}>{p[metric]?.[index]==null?'—':chips(p[metric]![index]!)}{metric==='values'&&p.deltas[index]!=null&&<small>{chips(p.deltas[index]!,true)}</small>}</td>)}</tr>)}</tbody></table></div>{pageCount>1&&<div className="score-pages"><Button variant="outline" size="sm" disabled={!page} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={14}/>上一页</Button><span>{page+1} / {pageCount}</span><Button variant="outline" size="sm" disabled={page+1>=pageCount} onClick={()=>setPage(p=>p+1)}>下一页<ChevronRight size={14}/></Button></div>}</details>
  </>}
 </section>;
}

export function FullScoreReport({report:r}:{report:ScoreReport}){
 const {ranking,leaders,best}=scoreInsights(r),extended=r.game==='landlord-v3',champion=ranking.find(p=>p.key===r.champion),top=champion?.name??leaders.map(p=>p.name).join('、'),streak=Math.max(0,...ranking.map(p=>p.bestStreak));
 return <article className="table-recap"><header className="recap-hero"><span className="score-eyebrow">娱乐中心 · 整桌战报</span><h2>好牌局，值得回味。</h2><p>{r.title}{r.code?` · 房间 ${r.code}`:''}</p><div className="recap-leader"><Trophy size={32}/><div><small>{champion?'整桌冠军':leaders.length>1?'并列领先':extended?'胜利点领先':'本桌领先'}</small><strong>{top||'暂无结算'}</strong><span>{ranking[0]?chips(champion?.total??ranking[0].total,!extended):'—'} {r.unit}</span></div></div></header>
  <div className="recap-highlights"><div><b>{r.points.length-1}</b><span>结算局数</span></div><div><TrendingUp size={19}/><b>{best?chips(best.value,true):'—'}</b><span>单局高光</span><small>{best?`${best.name} · ${best.label}`:'暂无正向变化'}</small></div><div><Flame size={19}/><b>{streak}</b><span>{extended?'连续得分':'最长连红'}</span><small>{extended?'按胜利点增加计算':'按单局净收益为正计算'}</small></div></div>
  <ScoreChart report={r}/>
  {r.balances&&<section className="recap-ranking"><h3>筹码结算</h3><div className="score-table-scroll" tabIndex={0} role="region" aria-label="整桌筹码结算"><table><thead><tr><th>玩家</th><th>{r.game==='holdem'?'累计带入':'初始筹码'}</th><th>结余</th><th>净输赢</th></tr></thead><tbody>{r.balances.map((p,i)=><tr key={i}><th scope="row">{p.name}</th><td>{chips(p.initial)}</td><td>{chips(p.balance)}</td><td>{chips(p.delta,true)}</td></tr>)}</tbody></table></div></section>}
  <section className="recap-ranking"><span className="score-eyebrow">这一桌，各有精彩</span><h3>全桌成绩单</h3>{ranking.map((p,i)=><div className="recap-player" key={p.key}><span className="recap-rank">{ranking.findIndex(v=>v.total===p.total)+1}</span><div><b>{p.name}{p.bot&&<small> · 人机</small>}</b><p>参与 {p.played} 局 · {extended?'得分':'盈利'} {p.positive} 局 · 最长连{extended?'续得分':'红'} {p.bestStreak} 局</p></div><strong style={{color:SCORE_COLORS[p.index%SCORE_COLORS.length]}}>{chips(p.total,!extended)}<small>{r.unit}</small></strong></div>)}</section>
  <footer>分数来自已保存的结算记录 · 仅同桌玩家可见</footer>
 </article>;
}
