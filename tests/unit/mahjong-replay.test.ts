import test from 'node:test';
import assert from 'node:assert/strict';
import {newMahjong,newSeat,dealMahjong,moveMahjong,timeoutMahjong,mahjongView,mahjongOptions} from '../../lib/mahjong/engine.ts';
import {newModern,modernSeat,dealModern,moveModern,timeoutModern,modernView,modernOptions} from '../../lib/mahjong/modern.ts';
import {BASIC_CHIPS,HAM} from '../../lib/mahjong/rules.ts';
import type {ReplayState} from '../../lib/replay/types.ts';

function frames(g: {replay?: ReplayState}) {return g.replay?.pending ?? [];}

test('legacy Mahjong replay freezes all dealt hands and every discard result without leaking live hands', () => {
  const g=newMahjong('p0','P0');
  for(let i=1;i<4;i++)g.seats.push(newSeat(`p${i}`,`P${i}`));
  dealMahjong(g,1000);
  const initial=frames(g)[0];
  assert.equal(initial.action,'发牌');
  assert.deepEqual(initial.scene.seats.map(s=>s.hand.length),[14,13,13,13]);
  assert.equal(initial.scene.wallRemaining,83);
  assert.deepEqual(mahjongView(g,'p1').seats[0].hand,[]);
  assert.equal('replay' in mahjongView(g,'p1'),false);
  const tile=g.seats[0].hand[0];
  moveMahjong(g,0,{action:'discard',tile},2000);
  const discard=frames(g).find(f=>f.action.startsWith('打出 '));
  assert.ok(discard);
  assert.equal(discard.scene.seats[0].hand.length,13);
  assert.ok(discard.scene.seats[0].discards?.includes(tile));
  assert.equal(discard.scene.mahjong?.drawn,null);
  assert.deepEqual(discard.scene.mahjong?.pending,{kind:'discard',from:0,tile});
  assert.equal(initial.scene.seats[0].hand.length,14);
  assert.ok(initial.scene.seats[0].hand.includes(tile));
});

for(const rules of [BASIC_CHIPS,HAM]) test(`modern Mahjong ${rules.id} records full hands and discard`, () => {
  const g=newModern('p0','P0',30,rules);
  for(let i=1;i<4;i++)g.seats.push(modernSeat(`p${i}`,`P${i}`,'1000'));
  dealModern(g,1000);
  assert.equal(frames(g)[0].action,'发牌');
  assert.deepEqual(frames(g)[0].scene.seats.map(s=>s.hand.length),[14,13,13,13]);
  assert.equal('replay' in modernView(g,'p1'),false);
  assert.deepEqual(modernView(g,'p1').seats[0].hand,[]);
  const tile=g.seats[0].hand.find(t=>!rules.forbidWildDiscard||Math.floor(t/4)!==g.wildcard);
  assert.notEqual(tile,undefined);
  moveModern(g,0,{action:'discard',tile},2000);
  const discard=frames(g).find(f=>f.action.startsWith('打出 '));
  assert.ok(discard);
  assert.ok(discard.scene.seats[0].discards?.includes(tile!));
  assert.equal(discard.scene.mahjong?.drawn,null);
  assert.deepEqual(discard.scene.mahjong?.pending,{kind:'discard',from:0,tile});
  assert.equal(frames(g)[0].scene.seats[0].hand.length,14);
});

test('Mahjong rounds mark a complete replay when timeout play empties the wall', () => {
  const legacy=newMahjong('p0','P0');
  for(let i=1;i<4;i++)legacy.seats.push(newSeat(`p${i}`,`P${i}`));
  dealMahjong(legacy,1000);
  for(let i=0;i<300&&legacy.phase==='playing';i++)assert.equal(timeoutMahjong(legacy,legacy.deadline),true);
  assert.equal(legacy.phase,'finished');
  assert.equal(legacy.replay?.complete,true);
  assert.equal(frames(legacy).at(-1)?.scene.phase,'finished');

  const modern=newModern('p0','P0',30,BASIC_CHIPS);
  for(let i=1;i<4;i++)modern.seats.push(modernSeat(`p${i}`,`P${i}`,'1000'));
  dealModern(modern,1000);
  for(let i=0;i<300&&modern.phase==='playing';i++)assert.equal(timeoutModern(modern,modern.deadline),true);
  assert.equal(modern.phase,'finished');
  assert.equal(modern.replay?.complete,true);
  assert.equal(frames(modern).at(-1)?.scene.phase,'finished');
});

test('both Mahjong engines preserve declaration, completed kong and replacement draw as distinct results',()=>{
  const legacy=newMahjong('p0','P0');
  legacy.seats=Array.from({length:4},(_,i)=>newSeat(`p${i}`,`P${i}`));
  const modern=newModern('p0','P0',30,BASIC_CHIPS);
  modern.seats=Array.from({length:4},(_,i)=>modernSeat(`p${i}`,`P${i}`,'1000'));
  for(const {g,kong} of [
    {g:legacy,kong:()=>moveMahjong(legacy,0,{action:'kong',key:mahjongOptions(legacy,0).kongs.find(k=>k.kind==='added')!.key},2000)},
    {g:modern,kong:()=>moveModern(modern,0,{action:'kong',key:modernOptions(modern,0).kongs.find(k=>k.kind==='added')!.key},2000)},
  ]){
    g.round=crypto.randomUUID();g.phase='playing';g.turn=0;g.drawn=135;
    g.seats[0].hand=[...Array.from({length:10},(_,i)=>i),135];
    g.seats[0].melds=[{kind:'pong',tiles:[132,133,134],from:3,concealed:false}];
    for(let seat=1;seat<4;seat++)g.seats[seat].hand=Array.from({length:13},(_,i)=>10+(seat-1)*13+i);
    const used=new Set(g.seats.flatMap(s=>[...s.hand,...s.melds.flatMap(m=>m.tiles)]));
    g.wall=Array.from({length:136},(_,i)=>i).filter(tile=>!used.has(tile));
    const replacement=g.wall.at(-1)!;
    kong();
    const [declaration,completed,drawn]=frames(g);
    assert.equal(frames(g).length,3);
    assert.match(declaration.action,/声明补杠/);
    assert.deepEqual(declaration.scene.mahjong?.pending,{kind:'added',from:0,tile:135});
    assert.equal(declaration.scene.mahjong?.drawn,null);
    assert.equal(declaration.scene.seats[0].melds?.[0].kind,'pong');
    assert(declaration.scene.seats[0].hand.includes(135));
    assert.equal(completed.scene.seats[0].melds?.[0].kind,'kong');
    assert.equal(completed.scene.mahjong?.pending,null);
    assert.equal(completed.scene.seats[0].hand.includes(135),false);
    assert.equal(drawn.action,'杠后补牌');
    assert.equal(drawn.scene.mahjong?.pending,null);
    assert.equal(drawn.scene.mahjong?.drawn,replacement);
    assert(drawn.scene.seats[0].hand.includes(replacement));
  }
});
