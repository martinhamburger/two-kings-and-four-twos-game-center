import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scoreReport,mahjongScores,scoreScale,scoreInsights,formatScore,scoreUnits} from '../../lib/reports/score.ts';
const seats=(a:string|number,b:string|number)=>[{id:'a',name:'同名',delta:a},{id:'b',name:'同名',delta:b}];
const row=(id:string,created:number,a:string|number,b:string|number,extra:Record<string,unknown>={})=>({id,created,result:{seats:seats(a,b),winner:0,landlord:0,...extra}});
test('classic history is reconstructed in stable settlement order, by ID rather than nickname',()=>{
 const report=scoreReport([row('b',2,-2,2),row('a',1,5,-5)],'旧桌');
 assert.deepEqual(report.points.map(p=>p.values),[['0','0'],['5','-5'],['3','-3']]);
 assert.equal(report.players.length,2);assert.equal(report.points[1].outcome,'地主获胜');
 assert.equal(scoreInsights(report).ranking[0].total,'3');
});
test('scores beyond Number precision remain exact, geometry remains finite',()=>{
 const amount='999999999999999999999999999999';
 const report=scoreReport([row('a',1,amount,'-'+amount),row('b',2,1,-1)],'大数');
 assert.equal(report.points.at(-1)!.values[0],'1000000000000000000000000000000');
 const scale=scoreScale(report.points.flatMap(p=>p.values));assert.equal(scale.ratio(report.points.at(-1)!.values[0]!),1);
 assert.equal(scale.ratio(report.points.at(-1)!.values[1]!),0);
 assert(Number.isFinite(scoreScale(['0','0']).ratio('0')));
});
test('seat order changes and later arrivals do not inherit other players scores',()=>{
 const later={id:'c',created:3,result:{seats:[{id:'c',name:'新玩家',delta:4},{id:'a',name:'改过昵称',delta:-4}]}};
 const r=scoreReport([row('a',1,8,-8),{...row('b',2,2,-2),result:{seats:seats(2,-2).reverse()}},later],'换座');
 assert.deepEqual(r.points[0].values,['0','0',null]);assert.deepEqual(r.points.at(-1)!.values,['6','-10','4']);
});
test('holdem rebuys are excluded from net-winnings curves',()=>{
 const r=scoreReport([row('a',1,-100,100,{kind:'holdem'}),{id:'b',created:2,result:{kind:'holdem',seats:[{id:'a',name:'同名',delta:10,stack:'1910',brought:'2000'},{id:'b',name:'同名',delta:-10,stack:'1090',brought:'1000'}]}}],'德州');
 assert.deepEqual(r.points.at(-1)!.values,['-90','90']);assert.equal(r.unit,'筹码');
});
test('v3 uses persisted victory points and coins as separate series, no hidden fields',()=>{
 const r=scoreReport([{id:'v3',created:5,result:{kind:'landlord-v3',seats:seats(0,0),privatePeeks:[1,2],rounds:[{round:1,winner:0,landlord:0,victoryPoints:['2','0'],coins:['5','1']},{round:2,winner:1,landlord:0,victoryPoints:['2','1'],coins:['1','6']}]}}],'扩展');
 assert.deepEqual(r.points.at(-1)!.values,['2','1']);assert.deepEqual(r.points.at(-1)!.coins,['1','6']);assert.equal(r.unit,'胜利点');assert(!JSON.stringify(r).includes('privatePeeks'));assert(!JSON.stringify(r).includes('"id"'));
});
test('Mahjong public scores use all rounds, including draws and aborted refunds',()=>{
 const r=mahjongScores([{name:'甲'},{name:'乙'}],[{number:2,ended:2,type:'aborted',winner:null,players:[{delta:'0'},{delta:'0'}]},{number:1,ended:1,type:'draw',winner:null,players:[{delta:'10'},{delta:'-10'}]}],'分享');
 assert.deepEqual(r.points.at(-1)!.values,['10','-10']);assert.equal(r.points[2].outcome,'本局中止');
});
test('ties remain ties and a zero result invents no winning highlight',()=>{
 const r=scoreReport([row('a',1,0,0)],'平局'),insights=scoreInsights(r);assert.equal(insights.leaders.length,2);assert.equal(insights.best,null);
});
test('half victory points remain exact and sudden-death champion is distinct from points leader',()=>{
 const r=scoreReport([{id:'v3',created:1,result:{kind:'landlord-v3',winner:1,seats:seats(0,0),rounds:[{round:1,winner:1,landlord:0,victoryPoints:['3','0.5'],coins:['2','2']},{round:2,suddenDeath:true,winner:1,landlord:0,victoryPoints:['3','0.5'],coins:['2','2']}]}}],'加赛');
 assert.equal(r.champion,r.players[1].key);assert.equal(scoreInsights(r).ranking[0].key,r.players[0].key);assert.equal(r.points[1].deltas[1],'0.5');
 assert.equal(formatScore('0.5',true),'+0.5');assert.equal(formatScore('-0.5'),'-0.5');assert.equal(scoreUnits('9999999999999999999999999.5'),99999999999999999999999995n);
 assert(Number.isFinite(scoreScale(r.points.flatMap(p=>p.values)).ratio('0.5')));
});
