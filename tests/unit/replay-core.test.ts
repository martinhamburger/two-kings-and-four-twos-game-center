import assert from 'node:assert/strict';
import test from 'node:test';
import {captureReplay,finishReplay,refreshReplayScene} from '../../lib/replay/capture.ts';
import type {ReplayState} from '../../lib/replay/types.ts';

test('capture stores private cards in a detached scene and advances sequence',()=>{
 const g:{round:string;phase:string;turn:number;seats:{name:string;bot?:boolean;hand:number[]}[];bottom:number[];last:{seat:number;cards:number[]}|null;replay?:ReplayState}={round:'round-1',phase:'playing',turn:0,seats:[{name:'甲',hand:[1,2]},{name:'乙',bot:true,hand:[3,4]}],bottom:[50,51],last:null};
 captureReplay(g,'发牌',undefined,100);
 assert.equal(g.replay?.pending[0].timing,'automatic');
 assert.deepEqual(g.replay?.pending[0].scene.seats.map(seat=>seat.hand),[[1,2],[3,4]]);
 assert.deepEqual(g.replay?.pending[0].scene.bottom,[50,51]);
 g.seats[0].hand.pop();g.last={seat:0,cards:[2]};captureReplay(g,'甲：单张 2',0,110);
 assert.deepEqual(g.replay?.pending[0].scene.seats[0].hand,[1,2]);
 assert.deepEqual(g.replay?.pending[1].scene.last,[2]);
 assert.deepEqual(g.replay?.pending[1].scene.lastPlay,{seat:0,cards:[2]});
 assert.equal(g.replay?.nextSeq,2);
});

test('capture attributes time to the previous turn once, even when the action changes phase',()=>{
 const g:{round:string;phase:string;turn:number;seats:{name:string;hand:number[]}[];replay?:ReplayState}={round:'round-2',phase:'bidding',turn:0,seats:[{name:'甲',hand:[1]}]};
 captureReplay(g,'发牌',undefined,100);
 g.replay!.window={actor:0,openedAt:100,deadline:10100,phase:'bidding'};
 g.phase='playing';
 captureReplay(g,'甲 叫地主',0,2100);
 captureReplay(g,'甲 获得底牌',0,2100);
 assert.equal(g.replay?.pending[1].durationMs,2000);
 assert.equal(g.replay?.pending[1].timing,'manual');
 assert.equal(g.replay?.pending[2].durationMs,undefined);
 assert.equal(g.replay?.window,undefined);
});

test('new rounds reset capture and finish marks only current round complete',()=>{
 const g:{kind:string;round:string;phase:string;turn:number;wildcard:number;seats:{name:string;hand:number[];river:number[];melds:[]}[];wall:number[];replay?:ReplayState}={kind:'mahjong',round:'first',phase:'playing',turn:0,wildcard:12,seats:[{name:'甲',hand:[1],river:[],melds:[]}],wall:[2,3]};
 captureReplay(g,'发牌',undefined,100);
 g.phase='finished';finishReplay(g,120);
 assert.equal(g.replay?.pending.length,2);
 assert.equal(g.replay?.complete,true);
 assert.equal(g.replay?.pending[1].scene.wildcard,12);
 assert.equal(g.replay?.pending[1].scene.wallRemaining,2);
 g.round='second';g.phase='playing';captureReplay(g,'发牌',undefined,200);
 assert.equal(g.replay?.roundId,'second');
 assert.equal(g.replay?.nextSeq,1);
 assert.equal(g.replay?.complete,undefined);
});

test('finish does not add a duplicate terminal scene',()=>{
 const g:{kind:string;round:string;phase:string;street:string;seats:{name:string;hand:number[];stack:string;bet:string;total:string;folded:boolean}[];replay?:ReplayState}={kind:'holdem',round:'holdem-1',phase:'finished',street:'river',seats:[{name:'甲',hand:[1,2],stack:'100',bet:'0',total:'20',folded:false}]};
 captureReplay(g,'结算',undefined,100);
 finishReplay(g,100);
 assert.equal(g.replay?.pending.length,1);
 assert.equal(g.replay?.pending[0].scene.pot,'20');
});

test('skill shopping keeps its exact catalog, offers and bought state for the native replay shop',()=>{
 const g:{kind:string;round:string;phase:string;rules:{id:string;catalogVersion:number;equipmentCatalog:{id:string;name:string;level:1;price:string;effect:string}[]};seats:{name:string;hand:number[]}[];shops:{offers:{offerId:string;id:string;level:1;price:string;bought:boolean}[]}[];replay?:ReplayState}={kind:'landlord-v3',round:'shop-1',phase:'shopping',rules:{id:'landlord-v3',catalogVersion:1,equipmentCatalog:[{id:'example',name:'旧版装备',level:1,price:'2',effect:'旧版效果'}]},seats:[{name:'甲',hand:[1]}],shops:[{offers:[{offerId:'offer-1',id:'example',level:1,price:'2',bought:false}]}]};
 captureReplay(g,'进入商店',undefined,100);
 g.shops[0].offers[0].bought=true;g.rules.equipmentCatalog[0].name='改名';
 assert.equal(g.replay?.pending[0].scene.shops?.[0].offers[0].bought,false);
 assert.equal((g.replay?.pending[0].scene.rules?.equipmentCatalog as {name:string}[])[0].name,'旧版装备');
});

test('finalizing operation bookkeeping updates only the latest scene and keeps recorded actions and timing',()=>{
 const g:{round:string;phase:string;turn:number;seats:{name:string;hand:number[]}[];replay?:ReplayState}={round:'round-finalize',phase:'playing',turn:0,seats:[{name:'甲',hand:[1,2]},{name:'乙',hand:[3]}]};
 captureReplay(g,'发牌',undefined,100);
 g.replay!.window={actor:0,openedAt:100,deadline:10100,phase:'playing'};
 g.seats[0].hand=[1];captureReplay(g,'甲 出牌',0,2100);
 g.turn=1;refreshReplayScene(g);
 assert.equal(g.replay!.pending.length,2);
 assert.equal(g.replay!.pending[0].scene.turn,0);
 const played=g.replay!.pending[1];
 assert.equal(played.scene.turn,1);assert.equal(played.durationMs,2000);assert.equal(played.action,'甲 出牌');
 g.phase='finished';finishReplay(g,2200);
 const terminal=g.replay!.pending.at(-1)!;
 g.turn=0;refreshReplayScene(g);
 assert.equal(terminal.scene.turn,1);
 assert.equal(g.replay!.complete,true);
});
