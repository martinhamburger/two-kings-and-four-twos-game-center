import test from 'node:test';
import assert from 'node:assert/strict';
import {skillHints,nextHint} from '../../lib/game/skill-hints.ts';
import {newLandlordV3,selectionCombo} from '../../lib/game/landlord-v3.ts';
import {beats,classify,rank,virtualCard} from '../../lib/game/engine.ts';
function game(hand:number[]){const g=newLandlordV3('a','甲');g.phase='playing';g.landlord=0;g.turn=0;g.seats[0].hand=hand;g.seats.push({id:'b',name:'乙',hand:[],count:10,ready:false,plays:0,last:''} as any,{id:'c',name:'丙',hand:[],count:10,ready:false,plays:0,last:''} as any);return g;}
test('hints finish a straight instead of selecting its smallest single',()=>{const g=game([0,4,8,12,16]);assert.equal(skillHints(g,0)[0].length,5)});
test('hints preserve a pair when a standalone response exists',()=>{const g=game([4,5,8,40]);g.last={seat:1,cards:[0],combo:classify([0])!};assert.deepEqual(skillHints(g,0)[0],[8])});
test('hints block a next opponent with one card',()=>{const g=game([0,8,40]);(g.seats[1] as any).count=1;assert.equal(rank(skillHints(g,0)[0][0]),13)});
test('hints cycle and wrap using actual card instances regardless of selection order',()=>{const options=[[4,5],[8,9],[12,13]];assert.deepEqual(nextHint(options,[]),options[0]);assert.deepEqual(nextHint(options,[5,4]),options[1]);assert.deepEqual(nextHint(options,options[2]),options[0]);assert.deepEqual(nextHint([],[]),[])});
test('generated cards remain legal and no response returns an empty list',()=>{const g=game([0,virtualCard(3,1),4,8,12,16,52,53]);for(const move of skillHints(g,0)){assert(move.every(c=>g.seats[0].hand.includes(c)));assert.equal(new Set(move).size,move.length);assert(beats(selectionCombo(g,0,move)!,null))}g.last={seat:1,cards:[52,53],combo:classify([52,53])!};assert.deepEqual(skillHints(g,0),[])});
test('a whole-hand shadow skill finish is offered and leaves state unchanged',()=>{const g=game([0,4]);g.equipment[0]=[{id:'shadow-rank',instanceId:'shadow',level:3,price:'4'}];const before=JSON.stringify(g);assert.equal(skillHints(g,0)[0].length,2);assert.equal(JSON.stringify(g),before)});

test('sudden death treats every other seat as an opponent',()=>{const g=game([0,8,40]);g.landlord=-1;g.suddenDeath=true;(g.seats[1] as any).count=1;assert.equal(rank(skillHints(g,0)[0][0]),13)});
test('rocket-win takes priority over saving a bomb',()=>{const g=game([0,4,8,12,16,52,53]);g.equipment[0]=[{id:'rocket-win',instanceId:'rocket',level:4,price:'8'}];assert.deepEqual(new Set(skillHints(g,0)[0]),new Set([52,53]));});
