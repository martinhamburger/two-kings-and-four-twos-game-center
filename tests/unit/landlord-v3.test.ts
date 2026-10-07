import test from 'node:test';
import assert from 'node:assert/strict';
import {bidV3,buyV3Equipment,clearanceV3,connectionsV3,declareV3NoBid,finishShopping,newLandlordV3,peekV3Bottom,placeV3Bet,playV3,readyV3,refreshV3Shop,resolveV3Equipment,selectionCombo,sellV3Equipment,skipV3Bet,skipV3OpeningEquipment,timeoutV3,useV3OpeningEquipment,viewV3,v3BotAction,V3_EQUIPMENT_CATALOG,type V3Game} from '../../lib/game/landlord-v3.ts';
import {advanceBot,fillBots,scheduleBots} from '../../lib/practice/room.ts';
import {beats,classify,rank,virtualCard} from '../../lib/game/engine.ts';

function game(){const g=newLandlordV3('a','甲',30);g.seats.push({id:'b',name:'乙',hand:[],ready:false,plays:0,last:''},{id:'c',name:'丙',hand:[],ready:false,plays:0,last:''});return g;}
function begin(g:V3Game){for(let seat=0;seat<3;seat++)readyV3(g,seat,1000);assert.equal(g.phase,'shopping');}
function cards(...ranks:number[]){const used=new Map<number,number>();return ranks.map(rank=>{if(rank===16)return 52;if(rank===17)return 53;const usedAt=used.get(rank)||0;used.set(rank,usedAt+1);return(rank-3)*4+usedAt;});}
function hand(g:V3Game,seat:number,ranks:number[]){g.seats[seat].hand=cards(...ranks);}
function give(g:V3Game,seat:number,...ids:string[]){const catalog=new Map(V3_EQUIPMENT_CATALOG.map(entry=>[entry.id,entry]));for(const id of ids){const entry=catalog.get(id)!;g.equipment[seat].push({instanceId:`${id}-${seat}`,id,level:entry.level,price:entry.price});}}
function playing(g:V3Game,{landlord=0,stake='2',coins=['0','5','5'],dealer=0,hands}:{landlord?:number;stake?:string;coins?:string[];dealer?:number;hands?:number[][]}={}){
 g.phase='playing';g.landlord=landlord;g.stake=stake;g.bid=stake;g.coins=[...coins];g.dealer=dealer;g.turn=landlord;g.bottom=[];g.last=null;g.passes=0;g.passStreak=[false,false,false];g.tableActions=[null,null,null];g.firstFinisher=-1;g.roundNumber=1;g.suddenDeath=false;g.champion=-1;g.victoryPoints=['0','0','0'];g.pending=[];g.pendingEffect=undefined;g.stakeUsedRound=0;g.equipmentUsed=[];
 if(hands)[0,1,2].forEach(seat=>hand(g,seat,hands[seat]));
}
function stakeWindow(g:V3Game,seat:number){g.phase='equipment';g.turn=seat;g.pendingEffect={seat,kind:'stake'};g.tableActions=[null,null,null];}
function betWindow(g:V3Game,seat:number){g.phase='equipment';g.turn=seat;g.pendingEffect={seat,kind:'bet'};g.tableActions=[null,null,null];}
function bids(g:V3Game,now=1100,skipOpening=false){
 for(let guard=0;g.phase==='shopping'||g.phase==='equipment';guard++){
  if(guard>40)throw Error(`bids 未能结束：${g.phase}`);
  if(g.phase==='equipment'){
   const pending=g.pendingEffect!;
   if(!pending)resolveV3Equipment(g,g.turn,[],now,{});
   else if(pending.kind==='opening'&&skipOpening)skipV3OpeningEquipment(g,pending.seat,now);
   else break;
  }else finishShopping(g,[0,1,2].find(index=>g.seats[index].last!=='商店完成')!,now);
  now++;
 }
 if(!skipOpening)assert.equal(g.phase,'bidding');
}

test('v3 copy series never fails on an unlucky random pick',()=>{
 for(let attempt=0;attempt<30;attempt++){
  const four=game();give(four,0,'copy-4');four.phase='equipment';four.pendingEffect={seat:0,kind:'opening'};
  hand(four,0,[3,4,5,7,7,7,7,9,10]);
  useV3OpeningEquipment(four,0,[cards(3)[0]],1200+attempt*2);
  assert.equal(four.seats[0].hand.filter(card=>card>=100000).length,4,`第 ${attempt+1} 次搞四张应复制 4 张`);
  assert.equal(four.seats[0].hand.filter(card=>rank(card)===7).length,4,`四张 7 的点数不能再被复制`);
  const three=game();give(three,0,'copy-3');three.phase='equipment';three.pendingEffect={seat:0,kind:'opening'};
  hand(three,0,[3,4,5,7,7,7,7,9,10]);
  useV3OpeningEquipment(three,0,[cards(3)[0]],1201+attempt*2);
  assert.equal(three.seats[0].hand.filter(card=>card>=100000).length,3);
  assert.equal(three.seats[0].hand.filter(card=>rank(card)===7).length,4);
 }
 const full=game();give(full,0,'copy-3');full.phase='equipment';full.pendingEffect={seat:0,kind:'opening'};
 hand(full,0,[7,7,7,7,9,10]);
 assert.throws(()=>useV3OpeningEquipment(full,0,[cards(7)[0]],1400),/已经是 4 张|不能再复制/);
});

test('v3 equipment activations publish a named notice with their target',()=>{
 const g=game();give(g,0,'copy-4');begin(g);
 for(let seat=0;seat<3;seat++)finishShopping(g,seat,4700+seat);
 g.seats[0].hand=cards(9,3,5,7,11,13,14,10);
 useV3OpeningEquipment(g,0,[cards(9)[0]],4710);
 const copied=g.log.filter(entry=>entry.kind==='equipment').at(-1);
 assert.equal(copied?.id,'copy-4');assert(copied?.text.includes('复制了'));assert(copied?.text.includes('4 张牌'));assert(!copied?.text.includes('9'));
 const bomb=game();give(bomb,0,'bomb-1');playing(bomb,{hands:[[9,9,9,9,5,5,5,5],[6,7],[8,10]]});
 playV3(bomb,0,cards(9,9,9,9),4720);
 resolveV3Equipment(bomb,0,[bomb.seats[0].hand.at(-1)!],4721,{effect:'bomb-1'});
 const discarded=bomb.log.filter(entry=>entry.kind==='equipment').at(-1);
 assert.equal(discarded?.id,'bomb-1');assert(discarded?.text.includes('公开弃掉'));
 const reward=game();give(reward,1,'interest');playing(reward,{coins:['0','9','0'],stake:'2',hands:[[3],[4,5],[6,7]]});
 playV3(reward,0,cards(3),4730);
 const paid=reward.log.filter(entry=>entry.kind==='equipment').at(-1);
 assert.equal(paid?.id,'interest');assert(paid?.text.includes('获得 2 金币'));
});

test('v3 catalog freezes 45 stable ids with a catalog version snapshot',()=>{
 const g=game();
 assert.equal(V3_EQUIPMENT_CATALOG.length,45);
 assert.equal(new Set(V3_EQUIPMENT_CATALOG.map(entry=>entry.id)).size,45);
 assert.equal(g.rules.catalogVersion,2);
 assert(g.rules.equipmentCatalog.every(entry=>entry.name&&entry.effect&&entry.price===String(2**(entry.level-1))));
 assert.deepEqual(V3_EQUIPMENT_CATALOG.filter(entry=>entry.family==='copy').map(entry=>entry.id),['copy-1','copy-2','copy-3','copy-4']);
 assert.deepEqual(V3_EQUIPMENT_CATALOG.filter(entry=>entry.family==='precision').map(entry=>entry.id),['precision-copy-1','precision-copy-2']);
 assert.deepEqual(V3_EQUIPMENT_CATALOG.filter(entry=>entry.family==='bomb').map(entry=>entry.id),['bomb-1','bomb-2','bomb-3','bomb-4']);
 assert(!V3_EQUIPMENT_CATALOG.some(entry=>entry.id==='precision-copy-3'));
 assert(V3_EQUIPMENT_CATALOG.every(entry=>entry.effect.length<=48));
 for(const level of [1,2,3,4] as const)assert(V3_EQUIPMENT_CATALOG.filter(entry=>entry.level===level).length>=3);
 assert(V3_EQUIPMENT_CATALOG.filter(entry=>entry.tableOnce).length>=2);
});

test('v3 shop hides owned equipment but keeps refreshable level-one tools',()=>{
 const g=game();give(g,0,'piggy-bank','copy-1');begin(g);
 assert(!g.shops[0].offers.some(offer=>offer.id==='piggy-bank'));
 assert(!g.shops[0].offers.some(offer=>offer.id==='copy-1'));
 assert(g.shops[0].offers.filter(offer=>offer.level===1).length<=3);
 const before=g.shops[0].offers.map(offer=>offer.offerId);
 g.coins[0]='9';give(g,0,'extra-refresh');refreshV3Shop(g,0,1050);
 assert.notDeepEqual(g.shops[0].offers.map(offer=>offer.offerId),before);
 assert.throws(()=>refreshV3Shop(g,0,1051),/不能额外刷新/);
});

test('v3 keeps escrow, purchase and settlement rules from the first batch',()=>{
 const g=game();begin(g);const offers=g.shops[0].offers;
 const levelOne=offers.find(offer=>offer.level===1)!,levelTwo=offers.find(offer=>offer.level===2)!;
 g.coins[0]='9';buyV3Equipment(g,0,levelOne.offerId,1200);
 const bought=g.equipment[0].find(item=>item.level===1)!;const coins=g.coins[0];sellV3Equipment(g,0,bought.instanceId,1201);assert.equal(g.coins[0],coins);
 buyV3Equipment(g,0,levelTwo.offerId,1202);
 const two=g.equipment[0].find(item=>item.level===2)!,beforeTwo=BigInt(g.coins[0]);sellV3Equipment(g,0,two.instanceId,1203);assert.equal(BigInt(g.coins[0]),beforeTwo+1n);
 const upgrade=game();begin(upgrade);upgrade.coins[0]='9';
 upgrade.shops[0].offers=[{offerId:'copy-1',id:'copy-1',level:1,price:'1',bought:false},{offerId:'copy-2',id:'copy-2',level:2,price:'2',bought:false}];
 buyV3Equipment(upgrade,0,'copy-1',1100);buyV3Equipment(upgrade,0,'copy-2',1101);
 assert.equal(upgrade.equipment[0].length,1);assert.equal(upgrade.equipment[0][0].id,'copy-2');assert.equal(upgrade.coins[0],'7');
 assert.throws(()=>buyV3Equipment(upgrade,0,'copy-2',1102),/不可购买|已经持有/);
});

test('v3 peek-bottom keeps the bottom hidden during bidding and reveals one slot to its owner',()=>{
 const g=game();give(g,0,'peek-bottom');begin(g);bids(g,1300,true);g.bottom=[10,11,12];
 assert.deepEqual((viewV3(g,'a') as any).bottom,[-1,-1,-1]);
 assert.deepEqual((viewV3(g,'b') as any).bottom,[-1,-1,-1]);
 peekV3Bottom(g,0,1,1300);
 assert.deepEqual((viewV3(g,'a') as any).bottom,[-1,11,-1]);
 assert.deepEqual((viewV3(g,'b') as any).bottom,[-1,-1,-1]);
 assert.throws(()=>peekV3Bottom(g,0,0,1301),/不能再次查看/);
 g.phase='playing';
 assert.deepEqual((viewV3(g,'b') as any).bottom,[10,11,12]);
});

test('v3 borrowed-light discards one matching card and never the last card',()=>{
 const g=game();give(g,1,'borrowed-light');playing(g,{hands:[[3,4],[3,7,8],[9]]});
 playV3(g,0,cards(3),1400);
 assert.equal(g.phase,'equipment');assert.equal(g.pendingEffect?.seat,1);assert.equal(g.pendingEffect?.kind,'borrowed');
 resolveV3Equipment(g,1,[cards(3)[0]],1401);
 assert.equal(g.seats[1].hand.length,2);assert.equal(g.phase,'playing');
 // 借光是别人出牌后的被动窗口：下一名玩家必须仍然拿到自己的回合。
 assert.equal(g.turn,1);assert.doesNotThrow(()=>playV3(g,1,[],1402));
});

test('v3 borrowed-light refuses mismatched ranks and an empty hand',()=>{
 const g=game();give(g,1,'borrowed-light');playing(g,{hands:[[3],[7],[9]]});
 g.seats[0].hand=[1,2];g.seats[1].hand=[0,16];
 playV3(g,0,[1],1410);
 assert.equal(g.pendingEffect?.kind,'borrowed');
 assert.throws(()=>resolveV3Equipment(g,1,[16],1411),/点数相同/);
 g.seats[1].hand=[0];
 assert.throws(()=>resolveV3Equipment(g,1,[0],1412),/必须仍有至少 1 张手牌/);
});

test('v3 piggy-bank pays out at round seven and never shows up again',()=>{
 const g=game();give(g,0,'piggy-bank');begin(g);
 g.roundNumber=6;g.phase='finished';g.seats.forEach(player=>player.ready=false);
 for(let seat=0;seat<3;seat++)readyV3(g,seat,1500+seat);
 assert.equal(g.coins[0],'7');assert(!g.equipment[0].some(item=>item.id==='piggy-bank'));
 assert(!g.shops[0].offers.some(offer=>offer.id==='piggy-bank'));
});

test('v3 endgame-change pays holders with five or fewer cards after the main settlement',()=>{
 const g=game();give(g,1,'endgame-change');playing(g,{coins:['0','1','1'],stake:'2',hands:[[3],[4,5],[6,7]]});
 playV3(g,0,cards(3),1700);
 assert.equal(g.coins[1],'2');
 const late=game();give(late,1,'endgame-change');playing(late,{coins:['0','1','1'],stake:'2',hands:[[3],[4,5,6],[10,11]]});
 playV3(late,0,cards(3),1701);
 assert.equal(late.coins[1],'2');
});

test('v3 precision copy series replaces random copies and respects the four-instance cap',()=>{
 const g=game();begin(g);g.coins[0]='9';
 g.shops[0].offers=[{offerId:'copy-1',id:'copy-1',level:1,price:'1',bought:false},{offerId:'precision-1',id:'precision-copy-1',level:2,price:'2',bought:false}];
 buyV3Equipment(g,0,'copy-1',1100);
 assert.throws(()=>buyV3Equipment(g,0,'precision-1',1101),/不能与已持有的系列共存/);
 sellV3Equipment(g,0,g.equipment[0][0].instanceId,1102);
 g.shops[0].offers[0].bought=false;
 buyV3Equipment(g,0,'precision-1',1103);
 assert.equal(g.equipment[0][0].id,'precision-copy-1');
 g.equipment[0]=[];give(g,0,'precision-copy-1');
 g.phase='equipment';g.pendingEffect={seat:0,kind:'opening'};g.seats[0].hand=[4,5,6,7,8];
 assert.throws(()=>useV3OpeningEquipment(g,0,[4],1104),/超过 4 张|无法复制/);
 useV3OpeningEquipment(g,0,[8],1105);
 assert.equal(g.seats[0].hand.filter(card=>card>=100000).length,1);
});

test('v3 copy-three and copy-four create unique virtual instances without five of a kind',()=>{
 const g=game();give(g,0,'copy-4');g.phase='equipment';g.pendingEffect={seat:0,kind:'opening'};g.seats[0].hand=[0,1,2,3,12];
 assert.throws(()=>useV3OpeningEquipment(g,0,[0,1],1200),/超过 4 张|无法复制/);
 g.seats[0].hand=[16,20,24,28,32];
 useV3OpeningEquipment(g,0,[16],1201);
 const virtuals=g.seats[0].hand.filter(card=>card>=100000);
 assert.equal(virtuals.length,4);assert.equal(new Set(virtuals).size,4);
 assert.equal(new Set(g.seats[0].hand.filter(card=>card>=100000).map(card=>card%32)).size>=2,true);
});

test('v3 keeps retired precision-copy-3 behavior for saved rule snapshots',()=>{
 const legacy={id:'precision-copy-3',level:4 as const,price:'8',name:'复刻',effect:'（已下架，仅旧快照保留）',family:'precision' as const,exclusive:['copy']};
 const g=game();g.rules.equipmentCatalog.push(legacy);g.equipment[0].push({instanceId:'legacy-copy',id:'precision-copy-3',level:4,price:'8'});
 g.phase='equipment';g.pendingEffect={seat:0,kind:'opening'};hand(g,0,[3,4,9,9,11]);
 useV3OpeningEquipment(g,0,[],1300);
 const copies=g.seats[0].hand.filter(card=>card>=100000);
 assert.equal(copies.length,2);assert(copies.every(card=>card%32===11));
 const full=game();full.rules.equipmentCatalog.push(legacy);full.equipment[0].push({instanceId:'legacy-copy',id:'precision-copy-3',level:4,price:'8'});
 full.phase='equipment';full.pendingEffect={seat:0,kind:'opening'};hand(full,0,[3,3,3,3,4,4,4]);
 assert.throws(()=>useV3OpeningEquipment(full,0,[],1301),/没有可以复刻的点数/);
});

test('v3 opening window ends per seat and hands over to bidding',()=>{
 const g=game();give(g,0,'copy-3');give(g,1,'copy-1');
 begin(g);bids(g,1400,true);
 assert.equal(g.phase,'bidding');assert.equal(g.turn,g.dealer);
 const partial=game();give(partial,0,'copy-3');give(partial,1,'copy-1');begin(partial);
 for(let seat=0;seat<3;seat++)finishShopping(partial,seat,1500+seat);
 partial.seats[0].hand=[16,20,24,28,32];
 useV3OpeningEquipment(partial,0,[16],1501);
 assert.equal(partial.seats[0].hand.length,8);
 assert.equal(partial.seats[0].hand.filter(card=>card>=100000).length,3);
});

test('v3 return-lead and follow-through discard one card before the holder leads again',()=>{
 const g=game();playing(g,{hands:[[3,4],[5,6],[7,8]]});give(g,0,'return-lead');
 const c3=g.seats[0].hand.find(card=>rank(card)===3)!,c4=g.seats[0].hand.find(card=>rank(card)===4)!;
 playV3(g,0,[c3],1500);playV3(g,1,[],1501);playV3(g,2,[],1502);
 assert.equal(g.phase,'equipment');assert.equal(g.pendingEffect?.kind,'lead');assert.equal(g.turn,0);
 resolveV3Equipment(g,0,[c4],1503);
 assert.equal(g.phase,'finished');assert.equal(g.winner,0);
 const follow=game();playing(follow,{hands:[[3,4],[5,6],[7,8]]});give(follow,0,'follow-through');
 const f3=follow.seats[0].hand.find(card=>rank(card)===3)!,f4=follow.seats[0].hand.find(card=>rank(card)===4)!;
 playV3(follow,0,[f3],1510);playV3(follow,1,[],1511);playV3(follow,2,[],1512);
 assert.equal(follow.pendingEffect?.kind,'lead');
 resolveV3Equipment(follow,0,[],1513);assert.equal(follow.turn,0);
});

test('v3 return-lead needs two consecutive passes in one trick and fires once per round',()=>{
 const g=game();playing(g,{hands:[[3,4,9],[5,6],[7,8]]});give(g,0,'return-lead');
 const at=(rankValue:number)=>g.seats[0].hand.find(card=>rank(card)===rankValue)!;
 const gap1=g.seats[1].hand[0];
 playV3(g,0,[at(3)],1520);playV3(g,1,[gap1],1521);playV3(g,2,[],1522);playV3(g,0,[],1523);
 assert.notEqual(g.pendingEffect?.kind,'lead');
 assert.equal(g.turn,1);assert.equal(g.phase,'playing');
});

test('v3 returns the lead after two passes instead of forcing the holder to beat their own combo',()=>{
 const g=game();playing(g,{hands:[[3,4,9],[5,6],[7,8]]});
 const at=(value:number)=>g.seats[0].hand.find(card=>rank(card)===value)!;
 playV3(g,0,[at(3)],1530);playV3(g,1,[],1531);playV3(g,2,[],1532);
 assert.equal(g.turn,0);assert.equal(g.passes,0);assert.equal(g.last===null,true);
 assert.throws(()=>playV3(g,0,[],1533),/新一轮必须出牌/);
 playV3(g,0,[at(4)],1534);
 assert.equal(g.last?.combo.rank,4);assert.equal(g.turn,1);
 const expired=game();playing(expired,{hands:[[3,4,5],[6,7],[8,9]]});
 playV3(expired,0,[expired.seats[0].hand[0]],1540);playV3(expired,1,[],1541);playV3(expired,2,[],1542);
 expired.deadline=0;
 assert.equal(timeoutV3(expired,Date.now()),true);
 assert.equal(expired.last?.seat,0);assert.equal(expired.turn,1);
});

test('v3 lead equipment hands back a fresh lead instead of the holder own combo',()=>{
 const g=game();give(g,0,'follow-through');playing(g,{hands:[[3,4,9],[5,6],[7,8]]});
 const at=(value:number)=>g.seats[0].hand.find(card=>rank(card)===value)!;
 playV3(g,0,[at(9)],1550);playV3(g,1,[],1551);playV3(g,2,[],1552);
 assert.equal(g.pendingEffect?.kind,'lead');
 resolveV3Equipment(g,0,[],1553);
 assert.equal(g.turn,0);assert.equal(g.last===null,true);
 playV3(g,0,[at(3)],1554);
 assert.equal(g.last?.combo.rank,3);assert.equal(g.turn,1);
});

test('v3 side-bet escrows one coin and settles against the losing side',()=>{
 const g=game();give(g,1,'side-bet');playing(g,{coins:['1','3','1'],stake:'2',hands:[[3],[4,5],[6,7]]});
 betWindow(g,1);placeV3Bet(g,1,'landlord',1600);g.phase='playing';g.turn=0;
 assert.equal(g.coins[1],'2');
 playV3(g,0,[g.seats[0].hand[0]],1601);
 assert.equal(g.coins[1],'3');
 const miss=game();give(miss,1,'side-bet');playing(miss,{coins:['1','3','1'],stake:'2',hands:[[3],[4,5],[6,7]]});
 betWindow(miss,1);placeV3Bet(miss,1,'farmers',1602);miss.phase='playing';miss.turn=0;
 playV3(miss,0,[miss.seats[0].hand[0]],1603);
 assert.equal(miss.coins[1],'1');assert.equal(miss.coins[0],'9');
});

test('v3 shadow-rank maps at most two cards per play but has no per-round cap',()=>{
 const g=game();give(g,0,'shadow-rank');playing(g,{coins:['0','5','5'],stake:'2'});
 g.seats[0].hand=[0,4,8];g.seats[1].hand=[8,16];g.seats[2].hand=[24];
 assert.throws(()=>playV3(g,0,[0,4,8],1700,0b111),/最多映射 2 张/);
 playV3(g,0,[0],1700,0b1);
 assert.equal(g.last?.combo.rank,4);
 playV3(g,1,[],1701);playV3(g,2,[],1702);
 playV3(g,0,[4],1703,0b1);
 assert.equal(g.last?.combo.rank,5);
 assert.equal(g.mapUsed?.length,2);
 playV3(g,1,[],1704);playV3(g,2,[],1705);
 playV3(g,0,[8],1706,0b1);
 assert.equal(g.last?.combo.rank,6);
 assert.equal(g.mapUsed?.length,3);
});

test('v3 all-in settles on top of the normal stake settlement',()=>{
 const g=game();give(g,1,'all-in');playing(g,{coins:['0','7','4'],stake:'2'});
 g.seats[0].hand=[99];g.seats[1].hand=[0];g.seats[2].hand=[40];
 g.phase='equipment';g.turn=1;g.pendingEffect={seat:1,kind:'stake'};
 resolveV3Equipment(g,1,[],2600,{choice:true});
 assert.equal(g.coins[1],'4');assert.equal(g.allIn?.amount,'3');
 g.phase='playing';g.turn=1;
 playV3(g,1,[0],2601);
 assert.equal(g.winner,1);
 assert.equal(g.coins[1],'11');
});

test('v3 shadow-rank maps a rank step and refuses jokers',()=>{
 const g=game();give(g,0,'shadow-rank');playing(g,{coins:['0','5','5'],stake:'2',hands:[[5,5,9],[10,11],[7,8]]});
 playV3(g,0,cards(5,5),1700,0b11);
 assert.equal(g.last?.combo.kind,'对子');assert.equal(g.mapUsed?.length,2);
 assert.throws(()=>playV3(g,0,cards(9),1701,0b1),/还没轮到/);
 const joker=game();give(joker,0,'shadow-rank');playing(joker,{hands:[[16,17],[10],[7]]});
 assert.throws(()=>playV3(joker,0,cards(16,17),1702,0b01),/王不能被映射|映射后/);
 const two=game();give(two,0,'shadow-rank');playing(two,{hands:[[15,15],[10],[7]]});
 assert.throws(()=>playV3(two,0,cards(15,15),1703,0b01),/王不能被映射|映射后/);
});

test('v3 four-with-two-pass hands two single attachments to another player',()=>{
 const g=game();give(g,0,'four-with-two-pass');playing(g,{hands:[[9,9,9,9,3,4],[5,6],[7,8]]});
 playV3(g,0,cards(9,9,9,9,3,4),1800);
 assert.equal(g.phase,'equipment');assert.equal(g.pendingEffect?.kind,'transfer');
 resolveV3Equipment(g,0,cards(3,4),1801,{target:2});
 assert.deepEqual([...g.seats[2].hand].sort((a,b)=>a-b),cards(7,8,3,4).sort((a,b)=>a-b));
 assert.equal(g.winner,0);assert.equal(g.phase,'finished');
});

test('v3 four-with-two-pass still transfers when the holder goes out first',()=>{
 const g=game();give(g,0,'four-with-two-pass');playing(g,{hands:[[9,9,9,9,3,4],[5],[7]]});
 playV3(g,0,cards(9,9,9,9,3,4),1810);
 assert.equal(g.pendingEffect?.kind,'transfer');
 resolveV3Equipment(g,0,cards(3,4),1811,{target:1});
 assert.equal(g.winner,0);assert.equal(g.seats[1].hand.length,3);assert.equal(g.phase,'finished');
});

test('v3 aftershock discards up to two cards after a straight only once',()=>{
 const g=game();give(g,0,'aftershock');playing(g,{hands:[[3,4,5,6,7,9,10],[11],[13]]});
 playV3(g,0,cards(3,4,5,6,7),1900);
 assert.equal(g.phase,'equipment');assert.equal(g.pendingEffect?.kind,'aftershock');
 resolveV3Equipment(g,0,cards(9,10),1901);
 assert.equal(g.seats[0].hand.length,0);assert.equal(g.winner,0);
 assert.equal((g.equipmentUsed??[]).filter(entry=>entry.includes('aftershock')).length,1);
});

test('v3 take-the-lot discards only after three-with-two or four-with-two',()=>{
 const g=game();give(g,0,'take-the-lot');playing(g,{hands:[[9,9,9,3,3,5],[11],[13]]});
 playV3(g,0,cards(9,9,9,3,3),2000);
 assert.equal(g.pendingEffect?.kind,'discard');
 resolveV3Equipment(g,0,[cards(5)[0]],2001);
 assert.equal(g.seats[0].hand.length,0);assert.equal(g.winner,0);
 assert.throws(()=>resolveV3Equipment(g,0,[],2002),/当前没有可处理/);
});

test('v3 raise-stake doubles the escrow and only the landlord may use it',()=>{
 const g=game();give(g,0,'raise-stake');playing(g,{coins:['6','5','5'],stake:'2',hands:[[3],[4,5],[6,7]]});
 stakeWindow(g,0);resolveV3Equipment(g,0,[],2100,{choice:true});
 assert.equal(g.stake,'4');assert.equal(g.coins[0],'4');assert.equal(g.phase,'playing');
 playV3(g,0,cards(3),2101);
 assert.equal(g.coins[0],'16');
 const farmer=game();give(farmer,1,'raise-stake');playing(farmer,{coins:['6','5','5'],stake:'2'});
 stakeWindow(farmer,1);
 assert.throws(()=>resolveV3Equipment(farmer,1,[],2102,{choice:true}),/不能使用赌注装备/);
});

test('v3 all-in escrows half the balance and settles on the declared side',()=>{
 const g=game();give(g,1,'all-in');playing(g,{coins:['0','7','4'],stake:'2',hands:[[3],[4,5],[6,7]]});
 stakeWindow(g,1);resolveV3Equipment(g,1,[],2200,{choice:true});
 g.turn=0;
 assert.equal(g.coins[1],'4');assert.equal(g.allIn?.amount,'3');
 playV3(g,0,[g.seats[0].hand[0]],2201);
 assert.equal(g.coins[1],'3');
});

test('v3 lucky-star tracks the losing streak and pays on the next win',()=>{
 const g=game();give(g,1,'lucky-star');playing(g,{coins:['0','1','1'],stake:'2',hands:[[3],[4,5],[6,7]]});g.lossStreak=['0','3','0'];
 playV3(g,0,cards(3),2300);
 assert.equal(g.lossStreak?.[1],'4');assert.equal(g.coins[1],'1');
 const win=game();give(win,1,'lucky-star');playing(win,{coins:['5','1','1'],stake:'2',landlord:1,hands:[[6,7],[4],[8,9]]});win.lossStreak=['0','3','0'];
 playV3(win,1,cards(4),2301);
 assert.equal(win.coins[1],'12');assert(!win.equipment[1].some(item=>item.id==='lucky-star'));
});

test('v3 airdrop, richest and interest compare the same pre-reward snapshot',()=>{
 const g=game();give(g,0,'airdrop');give(g,1,'richest');give(g,2,'interest');
 playing(g,{coins:['1','16','1'],stake:'2',hands:[[3],[5,6],[7,8]]});
 playV3(g,0,[g.seats[0].hand[0]],2400);
 assert.equal(g.coins[0],'13');assert.equal(g.coins[1],'16');assert.equal(g.coins[2],'1');
});

test('v3 solo-diet, no-chase and appearance-fee keep their own conditions',()=>{
 const small=game();give(small,1,'solo-diet');playing(small,{coins:['0','1','1'],stake:'2',hands:[[3],[4],[6,7]]});
 playV3(small,0,cards(3),2500);assert.equal(small.coins[1],'1');
 const big=game();give(big,1,'solo-diet');playing(big,{coins:['0','1','1'],stake:'2',hands:[[3],[4,4,4,4],[6,7]]});
 big.seats[1].plays=1;big.maxPlayed=[0,4,0];
 playV3(big,0,cards(3),2501);assert.equal(big.coins[1],'1');
 const chase=game();give(chase,2,'no-chase');playing(chase,{coins:['0','5','1'],stake:'2',hands:[[3],[4,5],[6,7,8]]});
 playV3(chase,0,cards(3),2502);assert.equal(chase.coins[2],'2');
 const fee=game();give(fee,0,'appearance-fee');begin(fee);
 fee.roundNumber=2;fee.phase='finished';fee.seats.forEach(player=>player.ready=false);
 for(let seat=0;seat<3;seat++)readyV3(fee,seat,2600+seat);
 assert.equal(fee.coins[0],'4');
});

test('v3 raise-stake and side-bet share the one stake window per round',()=>{
 const g=game();give(g,0,'raise-stake');give(g,1,'side-bet');playing(g,{coins:['6','5','5'],stake:'2'});
 g.pending=[{seat:0,kind:'stake'},{seat:1,kind:'stake'}];stakeWindow(g,0);
 resolveV3Equipment(g,0,[],2700,{choice:true});
 assert.equal(g.stake,'4');assert.equal(g.pending?.length,0);assert.equal(g.pendingEffect,undefined);
 assert.equal(g.coins[1],'5');
});

test('v3 clearance and connections buy outside the own shop with their own guards',()=>{
 const g=game();give(g,0,'clearance');give(g,1,'connections');begin(g);
 g.coins[0]='0';g.coins[1]='9';
 const offer=g.shops[0].offers.find(entry=>!entry.bought)!;
 clearanceV3(g,0,offer.offerId,2800);
 assert.equal(g.coins[0],'0');assert(g.equipment[0].some(item=>item.id===offer.id));
 assert.throws(()=>clearanceV3(g,0,g.shops[0].offers.find(entry=>!entry.bought&&!g.equipment[0].some(item=>item.id===entry.id))!.offerId,2801),/已经有人使用过清仓/);
 connectionsV3(g,1,'skip-straight',2802);
 assert.equal(g.coins[1],'3');assert(g.equipment[1].some(item=>item.id==='skip-straight'));
 assert.throws(()=>connectionsV3(g,1,'airdrop',2803),/本桌已经使用过人脉/);
 const exclusive=game();give(exclusive,0,'clearance','connections');begin(exclusive);exclusive.equipmentUsed.push('0:clearance');
 assert.throws(()=>connectionsV3(exclusive,0,'airdrop',2804),/不能在同一局共同触发/);
});

test('v3 practice shopping and opening equipment advance through both bots to bidding',()=>{
 const g=newLandlordV3('human','开发者',30);fillBots(g);readyV3(g,0,1000);assert.equal(g.phase,'shopping');finishShopping(g,0,1001);
 for(let now=2000,moves=0;['shopping','equipment'].includes(g.phase);now+=1000){assert(++moves<12);scheduleBots(g,now);assert(advanceBot(g,now+900));}
 assert.equal(g.phase,'bidding');assert.doesNotThrow(()=>finishShopping(g,0,5000));
});

test('v3 exposes opponents only the type and level of held equipment',()=>{
 const g=game();give(g,0,'peek-bottom');
 assert.deepEqual((viewV3(g,'b') as any).equipment[0],[{id:'peek-bottom',level:1}]);
 assert.equal((viewV3(g,'a') as any).equipment[0][0].instanceId,'peek-bottom-0');
});

test('v3 keeps the owner hand private while shopping, then opens it for the equipment window',()=>{
 const g=game();give(g,0,'copy-3');begin(g);
 assert.deepEqual((viewV3(g,'a') as any).seats[0].hand,[]);
 finishShopping(g,0,1200);finishShopping(g,1,1201);finishShopping(g,2,1202);
 assert.equal(g.phase,'equipment');assert.equal((viewV3(g,'a') as any).seats[0].hand.length,17);
});

test('v3 keeps removed less-series behavior for saved rule snapshots',()=>{
 const g=game();g.dealer=0;g.rules.equipmentCatalog.push({id:'less-1',level:1,price:'1',name:'少一手',effect:'发完初始手牌后，可公开弃掉 1 张手牌。',family:'less'});
 g.equipment[0]=[{instanceId:'legacy-less',id:'less-1',level:1,price:'1'}];hand(g,0,[3,4]);g.phase='equipment';g.pendingEffect={seat:0,kind:'opening'};
 useV3OpeningEquipment(g,0,[cards(3)[0]],1203);assert.deepEqual(g.seats[0].hand,cards(4));
});

test('v3 rotates the dealer clockwise for every new round, including sudden death',()=>{
 const g=game();g.phase='finished';g.roundNumber=1;g.dealer=0;
 for(let seat=0;seat<3;seat++)readyV3(g,seat,1400+seat);assert.equal(g.phase,'shopping');assert.equal(g.dealer,1);assert.equal(g.turn,1);
 g.phase='finished';g.seats.forEach(player=>player.ready=false);
 for(let seat=0;seat<3;seat++)readyV3(g,seat,1500+seat);assert.equal(g.phase,'shopping');assert.equal(g.dealer,2);assert.equal(g.turn,2);
 g.phase='finished';g.roundNumber=12;g.dealer=2;g.seats.forEach(player=>player.ready=false);
 for(let seat=0;seat<3;seat++)readyV3(g,seat,1600+seat);assert.equal(g.phase,'playing');assert.equal(g.suddenDeath,true);assert.equal(g.dealer,0);assert.equal(g.turn,0);
});

test('v3 escrow refunds a replaced bidder and no-call handling selects the richest clockwise from dealer or the dealer at zero',()=>{
 const g=game();begin(g);bids(g);g.dealer=0;g.turn=0;g.coins=['3','3','0'];
 bidV3(g,0,true,1200);assert.equal(g.coins[0],'2');bidV3(g,1,true,1201);assert.equal(g.coins[0],'3');assert.equal(g.coins[1],'1');bidV3(g,2,false,1202);bidV3(g,0,false,1203);
 assert.equal(g.phase,'playing');assert.equal(g.landlord,1);assert.equal(g.stake,'2');
 const allPass=game();delete allPass.rules.noCallPolicy;begin(allPass);bids(allPass);allPass.dealer=1;allPass.turn=1;allPass.coins=['5','5','1'];
 for(let n=0;n<3;n++)bidV3(allPass,allPass.turn,false,1300+n);assert.equal(allPass.landlord,1);assert.equal(allPass.stake,'1');assert.equal(allPass.coins[1],'4');
 const zero=game();begin(zero);bids(zero);zero.dealer=2;zero.turn=2;zero.coins=['0','0','0'];
 for(let n=0;n<3;n++)bidV3(zero,zero.turn,false,1400+n);assert.equal(zero.landlord,2);assert.equal(zero.stake,'0');
});

test('v3 settlement handles even and odd stakes, remaining-card ordering, and insufficient farmer balances',()=>{
 const even=game();playing(even,{stake:'2',coins:['0','1','10'],hands:[[3],[4,5],[6,7,8]]});
 playV3(even,0,[even.seats[0].hand[0]],1500);assert.deepEqual(even.coins,['7','1','9']);assert.deepEqual(even.victoryPoints,['1','0','0']);
 const odd=game();playing(odd,{stake:'3',coins:['0','9','9'],dealer:0,hands:[[3],[4,5],[6,7]]});
 playV3(odd,0,cards(3),1600);assert.deepEqual(odd.coins,['10','7','8']);
 const farmers=game();playing(farmers,{stake:'3',coins:['0','0','0'],hands:[[3,4],[5],[6]]});farmers.turn=1;
 playV3(farmers,1,[farmers.seats[1].hand[0]],1700);assert.deepEqual(farmers.coins,['1','4','2']);assert.deepEqual(farmers.victoryPoints,['0','0.5','0.5']);
});

test('two farmers reaching four victory points together award the table to the first player out',()=>{
 const g=game();playing(g,{stake:'0',coins:['0','0','0'],hands:[[3,4],[5],[6]]});g.victoryPoints=['3','3.5','3.5'];g.turn=1;
 g.firstFinisher=1;g.champion=1;g.victoryPoints=['3','4','4'];
 assert.deepEqual([...g.victoryPoints],['3','4','4']);assert.equal(g.firstFinisher,1);assert.equal(g.champion,1);
});

test('v3 reaches sudden death after twelve regular hands, deals all 54 unique cards, and awards no sudden-death coins',()=>{
 const g=game();g.phase='finished';g.roundNumber=12;g.coins=['5','6','7'];g.seats.forEach(player=>player.ready=false);
 for(let seat=0;seat<3;seat++)readyV3(g,seat,1800);
 assert.equal(g.phase,'playing');assert.equal(g.suddenDeath,true);assert.equal(g.bottom.length,0);
 assert(g.seats.every(player=>player.hand.length===18));assert.equal(new Set(g.seats.flatMap(player=>player.hand)).size,54);
 const before=[...g.coins];g.turn=0;g.seats[0].hand=[0];g.seats[1].hand=[1];g.seats[2].hand=[2];playV3(g,0,[0],1900);
 assert.equal(g.champion,0);assert.deepEqual(g.coins,before);assert.equal(g.victoryPoints.join(','),'0,0,0');
});

test('v3 standard play keeps physical cards unique and rejects stale turn actions',()=>{
 const g=game();playing(g,{hands:[[3],[4],[5]]});
 assert.throws(()=>playV3(g,1,cards(4)),/还没轮到/);
 playV3(g,0,cards(3),2000);assert.equal(g.winner,0);assert.equal(g.seats[0].hand.length,0);
});

test('v3 never lets equipment rules drive any balance negative',()=>{
 const g=game();give(g,0,'all-in','endgame-change','interest');playing(g,{coins:['1','0','0'],stake:'2',hands:[[3],[4,5],[6,7]]});
 stakeWindow(g,0);resolveV3Equipment(g,0,[],3000,{choice:false});
 playV3(g,0,cards(3),3001);
 assert(g.coins.every(value=>BigInt(value)>=0n));
 for(let round=0;round<12;round++){
  playing(g,{coins:['0','0','0'],stake:'2',hands:[[3],[4],[5,6]]});g.turn=1;
  playV3(g,1,cards(4),3010+round);
  assert(g.coins.every(value=>BigInt(value)>=0n));
 }
});

test('v3 no-bid auto-passes every bid and pays only when someone else takes the landlord',()=>{
 const g=game();give(g,1,'no-bid');begin(g);bids(g);
 declareV3NoBid(g,1,1200);
 g.dealer=0;g.turn=0;g.coins=['5','5','5'];
 bidV3(g,0,true,1201);
 assert.throws(()=>bidV3(g,1,true,1202),/只能提交不叫/);
 bidV3(g,1,false,1202);
 bidV3(g,2,false,1203);
 assert.equal(g.landlord,0);assert.equal(g.coins[1],'6');
 assert(g.log.some(entry=>entry.text.includes('我不叫发动：获得 1 金币')));
 const other=game();give(other,2,'no-bid');begin(other);bids(other);
 declareV3NoBid(other,2,1250);
 other.dealer=0;other.turn=0;other.coins=['5','5','5'];
 bidV3(other,0,true,1251);bidV3(other,1,false,1252);bidV3(other,2,false,1253);
 assert.equal(other.landlord,0);assert.equal(other.coins[2],'6');

 const forced=game();delete forced.rules.noCallPolicy;give(forced,1,'no-bid');begin(forced);bids(forced);
 declareV3NoBid(forced,1,1300);
 forced.dealer=0;forced.turn=0;forced.coins=['2','5','2'];
 for(let n=0;n<3;n++)bidV3(forced,forced.turn,false,1301+n);
 assert.equal(forced.landlord,1);assert.equal(forced.coins[1],'4');
 assert(!forced.log.some(entry=>entry.text.includes('我不叫发动：获得 1 金币')));
});

test('v3 appearance-fee pays on rounds three, six and nine and stops after three uses',()=>{
 const g=game();give(g,0,'appearance-fee');begin(g);
 const next=()=>{g.phase='finished';g.seats.forEach(player=>player.ready=false);for(let seat=0;seat<3;seat++)readyV3(g,seat,2000+g.roundNumber*10+seat);};
 const paid:number[]=[];
 for(let round=0;round<12;round++){
  const previous=Number(g.coins[0]);
  next();
  if(Number(g.coins[0])>previous)paid.push(g.roundNumber);
 }
 assert.deepEqual(paid.filter((value,index)=>paid.indexOf(value)===index).slice(0,3),[3,6,9]);
 assert(Number(g.coins[0])>=6);
});

test('v3 bet-is-set escrows two coins and only returns them on a winning side',()=>{
 const g=game();playing(g,{coins:['9','9','9'],stake:'2',hands:[[3],[4,5],[6,7]]});give(g,0,'bet-is-set');
 betWindow(g,0);placeV3Bet(g,0,undefined,2200,'hold');g.phase='playing';g.turn=0;
 assert.equal(g.coins[0],'7');assert.deepEqual(g.betIsSet,{seat:0});
 playV3(g,0,[g.seats[0].hand[0]],2201);
 assert(BigInt(g.coins[0])>8n,`押中应返还托管并额外奖励：实际 ${g.coins[0]}`);
 assert(g.log.some(entry=>entry.text.includes('买定离手成立')));
 const miss=game();playing(miss,{coins:['5','9','9'],stake:'2',hands:[[3],[4,5],[6,7]]});give(miss,1,'bet-is-set');
 betWindow(miss,1);placeV3Bet(miss,1,undefined,2210,'hold');
 miss.turn=0;miss.phase='playing';
 playV3(miss,0,[miss.seats[0].hand[0]],2211);
 assert.equal(miss.coins[1],'6');
 assert.equal(miss.log.filter(entry=>entry.text.includes('买定离手失败')).length,1);
});

test('v3 take-the-lot lets the holder discard once per three-with-two up to three times',()=>{
 const g=game();give(g,0,'take-the-lot');playing(g,{hands:[[9,9,9,3,3,5,6,7],[12],[13]]});
 playV3(g,0,[g.seats[0].hand[0],g.seats[0].hand[1],g.seats[0].hand[2],g.seats[0].hand[3],g.seats[0].hand[4]],2000);
 assert.equal(g.pendingEffect?.kind,'discard');
 const spare=g.seats[0].hand[0];
 resolveV3Equipment(g,0,[spare],2001);
 assert.equal(g.phase,'playing');
 assert.equal(g.turn,1);
});

test('v3 side-bet and bet-is-set cannot both trigger in the same round',()=>{
 const g=game();playing(g,{coins:['0','9','9'],stake:'2'});give(g,1,'side-bet','bet-is-set');
 betWindow(g,1);placeV3Bet(g,1,'landlord',2300,'side');
 assert.equal(g.coins[1],'8');
 assert.equal(g.stakeUsedRound,g.roundNumber);
 assert.throws(()=>placeV3Bet(g,1,undefined,2301,'hold'),/赌注类装备/);
 skipV3Bet(g,1,'playing',2302);
});

test('v3 skip-straight plays a gapped run as a normal straight that only a longer-max straight or a bomb beats',()=>{
 const g=game();give(g,0,'skip-straight');playing(g,{hands:[[3,5,7,9,11,12],[4,6,8,10,12],[13]]});
 const run=[3,5,7,9,11].map(value=>g.seats[0].hand.find(card=>rank(card)===value)!);
 playV3(g,0,run,2400);
 const combo=g.last?.combo;
 assert.equal(combo?.kind,'顺子');assert.equal(combo?.size,5);assert.equal(combo?.rank,11);
 assert.equal(beats(classify(cards(9,10,11,12,13))!,combo!),true);
 assert.equal(beats(classify(cards(5,6,7,8,9))!,combo!),false);
 assert.equal(beats(classify(cards(9,10,11,12,13,14))!,combo!),false);
 assert.equal(beats({kind:'炸弹',rank:4,size:4,chain:1},combo!),true);
});

test('v3 cut-off-income halves the target equipment rewards for the rest of the round',()=>{
 const g=game();playing(g,{coins:['0','16','5'],stake:'2',hands:[[3,4],[5,6],[7,8]]});give(g,0,'cut-off-income');give(g,1,'interest');
 g.phase='equipment';g.turn=0;g.pendingEffect={seat:0,kind:'target'};
 resolveV3Equipment(g,0,[1],2500,{target:1});
 assert.deepEqual(g.cutIncome,{seat:0,source:1});
 g.phase='playing';g.turn=0;
 playV3(g,0,[g.seats[0].hand[0]],2501);
 assert.equal(g.coins[1],'16');
});

test('v3 stand-up-fight discards up to five physical cards and reveals the hand',()=>{
 const g=game();give(g,0,'stand-up-fight');playing(g,{hands:[[3,4,5,6,7,8],[9,10],[11,12]]});
 g.phase='equipment';g.turn=0;g.pendingEffect={seat:0,kind:'reveal',max:5};
 assert.throws(()=>resolveV3Equipment(g,0,g.seats[0].hand.slice(),2510),/最多弃置 5 张|保留至少 1 张/);
 resolveV3Equipment(g,0,g.seats[0].hand.slice(0,3),2511);
 assert.equal(g.seats[0].hand.length,3);
 assert((g.equipmentUsed??[]).includes('0:stand-up-fight'));
 assert.equal(viewV3(g,'b').seats[0].hand.length,3);
});

test('v3 stake window never spends coins unless the holder explicitly picks use',()=>{
 const g=game();give(g,0,'raise-stake');playing(g,{coins:['6','5','5'],stake:'2',hands:[[3],[4,5],[6,7]]});
 stakeWindow(g,0);
 resolveV3Equipment(g,0,[],3100,{effect:'stake',choice:'skip'});
 assert.equal(g.stake,'2');assert.equal(g.coins[0],'6');assert.equal(g.phase,'playing');
 assert((g.equipmentUsed??[]).includes('0:raise-stake'));
 const used=game();give(used,0,'raise-stake');playing(used,{coins:['6','5','5'],stake:'2',hands:[[3],[4,5],[6,7]]});
 stakeWindow(used,0);
 resolveV3Equipment(used,0,[],3101,{effect:'stake',choice:'use'});
 assert.equal(used.stake,'4');assert.equal(used.coins[0],'4');
});

test('v3 bet window opens before bidding and only escrows on an explicit choice',()=>{
 const g=game();give(g,1,'side-bet');begin(g);
 for(let seat=0;seat<3;seat++)finishShopping(g,seat,3200+seat);
 assert.equal(g.phase,'equipment');assert.equal(g.pendingEffect?.kind,'bet');assert.equal(g.pendingEffect?.seat,1);
 assert.equal(g.landlord,-1);
 resolveV3Equipment(g,1,[],3204,{effect:'bet',choice:'landlord'});
 assert.deepEqual(g.sideBet,{seat:1,side:'landlord'});assert.equal(g.coins[1],'1');
 assert.equal(g.phase,'bidding');
 const skip=game();give(skip,2,'bet-is-set');begin(skip);
 for(let seat=0;seat<3;seat++)finishShopping(skip,seat,3210+seat);
 resolveV3Equipment(skip,2,[],3220,{effect:'bet'});
 assert.equal(skip.betIsSet,undefined);assert.equal(skip.coins[2],'2');assert.equal(skip.phase,'bidding');
});

test('v3 bomb equipment records one use per round for the button path too',()=>{
 const g=game();give(g,0,'bomb-1');playing(g,{hands:[[9,9,9,9,5,5,5,5,3,3,3,3],[6,7],[8,10]]});
 playV3(g,0,cards(9,9,9,9),3300);
 assert.equal(g.pendingEffect?.kind,'bomb');
 resolveV3Equipment(g,0,[g.seats[0].hand.at(-1)!],3301,{effect:'bomb-1'});
 assert((g.equipmentUsed??[]).includes('0:bomb'));
 assert(!(g.equipmentUsed??[]).includes('0:bomb-1'));
 playV3(g,1,[],3302);playV3(g,2,[],3303);
 playV3(g,0,cards(5,5,5,5),3304);
 assert.equal(g.pendingEffect,undefined);assert.equal(g.phase,'playing');
});

test('v3 cut-off-income applies its target without a card selection',()=>{
 const g=game();give(g,0,'cut-off-income');give(g,1,'interest');playing(g,{coins:['0','16','5'],stake:'2',hands:[[3,4],[5,6],[7,8]]});
 g.phase='equipment';g.turn=0;g.pendingEffect={seat:0,kind:'target'};
 resolveV3Equipment(g,0,[],3400,{effect:'target',target:1});
 assert.deepEqual(g.cutIncome,{seat:0,source:1});
 g.phase='playing';g.turn=0;
 playV3(g,0,[g.seats[0].hand[0]],3401);
 assert.equal(g.coins[1],'16');
});

test('v3 borrowed-light never opens after a terminal play and never before the holder own effects',()=>{
 const terminal=game();give(terminal,1,'borrowed-light');playing(terminal,{hands:[[3],[3,7,8],[9]]});
 playV3(terminal,0,cards(3),3500);
 assert.equal(terminal.phase,'finished');assert.equal(terminal.winner,0);assert.equal(terminal.pendingEffect,undefined);
 const g=game();give(g,0,'aftershock');give(g,1,'borrowed-light');playing(g,{hands:[[3,4,5,6,7,9],[3,7,8],[10]]});
 playV3(g,0,cards(3,4,5,6,7),3501);
 assert.equal(g.pendingEffect?.kind,'aftershock');
 resolveV3Equipment(g,0,[],3502);
 const next=g.pendingEffect as {seat:number;kind:string}|undefined;
 assert.equal(next?.kind,'borrowed');assert.equal(next?.seat,1);
 resolveV3Equipment(g,1,[],3503);
 assert.equal(g.turn,1);assert.equal(g.phase,'playing');
});

test('v3 disables the stake and bet windows in the sudden-death round',()=>{
 const g=game();give(g,0,'side-bet','all-in','raise-stake');playing(g,{hands:[[3,4],[5,6],[7,8]]});
 g.suddenDeath=true;g.landlord=-1;
 assert.throws(()=>placeV3Bet(g,0,'landlord',3600),/第 13 局/);
 assert.throws(()=>placeV3Bet(g,0,undefined,3601,'hold'),/第 13 局/);
 g.phase='equipment';g.pendingEffect={seat:0,kind:'stake'};
 assert.throws(()=>resolveV3Equipment(g,0,[],3602,{effect:'stake',choice:'use'}),/不能使用赌注装备/);
});

test('v3 shadow-rank forbids turning a two into an ace but still allows king to ace',()=>{
 const two=game();give(two,0,'shadow-rank');playing(two,{hands:[[15,14],[10],[7]]});
 assert.throws(()=>playV3(two,0,cards(15,14),3700,0b01),/映射后/);
 const king=game();give(king,0,'shadow-rank');playing(king,{hands:[[13,13],[10],[7]]});
 playV3(king,0,cards(13,13),3701,0b11);
 assert.equal(king.last?.combo.kind,'对子');assert.equal(king.last?.combo.rank,14);
});

test('v3 take-the-lot only discards physical cards',()=>{
 const g=game();give(g,0,'take-the-lot');playing(g,{hands:[[9,9,9,3,3],[11],[13]]});
 const copy=virtualCard(9,1);g.seats[0].hand=[...g.seats[0].hand,copy];
 playV3(g,0,cards(9,9,9,3,3),3800);
 assert.equal(g.pendingEffect?.kind,'discard');
 assert.throws(()=>resolveV3Equipment(g,0,[copy],3801),/实体手牌/);
 resolveV3Equipment(g,0,[],3802);
 assert.equal(g.phase,'playing');assert.equal(g.turn,1);
});

test('v3 opening windows move on after a precision copy instead of reopening in place',()=>{
 const g=game();give(g,1,'precision-copy-1');give(g,2,'copy-3');begin(g);
 g.seats[1].hand=[0,4,8,12,16];g.seats[2].hand=[20,24,28,32,36];
 for(let seat=0;seat<3;seat++)finishShopping(g,seat,4300+seat);
 assert.equal(g.phase,'equipment');assert.equal(g.pendingEffect?.kind,'opening');assert.equal(g.pendingEffect?.seat,1);
 useV3OpeningEquipment(g,1,[0],4310);
 assert.equal(g.seats[1].hand.filter(card=>card>=100000).length,1);
 assert.equal(g.phase,'equipment');assert.equal(g.pendingEffect?.kind,'opening');assert.equal(g.pendingEffect?.seat,2);
 useV3OpeningEquipment(g,2,[20],4311);
 assert.equal(g.seats[2].hand.filter(card=>card>=100000).length,3);
 assert.equal(g.phase,'bidding');assert.equal(g.pendingEffect,undefined);
 const skip=game();give(skip,1,'precision-copy-1');begin(skip);
 for(let seat=0;seat<3;seat++)finishShopping(skip,seat,4320+seat);
 assert.equal(skip.pendingEffect?.seat,1);
 skipV3OpeningEquipment(skip,1,4330);
 assert.equal(skip.phase,'bidding');
});

test('v3 borrowed-light stays silent when no card in hand matches the play',()=>{
 const quiet=game();give(quiet,1,'borrowed-light');playing(quiet,{hands:[[3,4,5],[7,8,9],[10,11,12]]});
 playV3(quiet,0,cards(3),4200);
 assert.equal(quiet.pendingEffect,undefined);assert.equal(quiet.phase,'playing');assert.equal(quiet.turn,1);
 const match=game();give(match,1,'borrowed-light');playing(match,{hands:[[3,4,5],[7,8,3],[10,11,12]]});
 playV3(match,0,cards(3),4201);
 assert.equal(match.pendingEffect?.kind,'borrowed');
 const copy=game();give(copy,1,'borrowed-light');playing(copy,{hands:[[3,4,5],[7,8,9],[10,11,12]]});
 copy.seats[1].hand=[...copy.seats[1].hand,virtualCard(3,9)];
 playV3(copy,0,cards(3),4202);
 assert.equal(copy.pendingEffect?.kind,'borrowed');
});

test('v3 keeps other players played cards visible while an equipment window is open',()=>{
 const g=game();give(g,1,'borrowed-light');playing(g,{hands:[[3,4,5],[3,7,8],[9,10,11]]});
 playV3(g,0,cards(3),4100);
 assert.equal(g.phase,'equipment');
 const played=(viewV3(g,'b').tableActions?.[0]) as {kind:string;cards:number[]}|undefined;
 assert.equal(played?.kind,'play');assert.deepEqual(played?.cards,cards(3));
 resolveV3Equipment(g,1,[],4101);
 const kept=(viewV3(g,'c').tableActions?.[0]) as {kind:string;cards:number[]}|undefined;
 assert.equal(kept?.kind,'play');assert.deepEqual(kept?.cards,cards(3));
 assert.equal(g.turn,1);
});

test('v3 borrowed-light only spends one of its two uses when it really discards',()=>{
 const g=game();give(g,1,'borrowed-light');playing(g,{hands:[[3],[4],[7]]});
 g.seats[0].hand=[1,5,9];g.seats[1].hand=[0,4,20];g.seats[2].hand=[24,28,32];
 playV3(g,0,[1],3960);
 resolveV3Equipment(g,1,[],3961);
 assert.equal((g.equipmentUsed??[]).filter(entry=>entry.includes('borrowed-light')).length,0);
 playV3(g,1,[],3962);playV3(g,2,[],3963);
 assert.equal(g.turn,0);
 playV3(g,0,[5],3964);
 const next=g.pendingEffect as {kind:string;seat:number}|undefined;
 assert.equal(next?.kind,'borrowed');assert.equal(next?.seat,1);
 resolveV3Equipment(g,1,[4],3965);
 assert.equal(g.seats[1].hand.length,2);
 assert.equal((g.equipmentUsed??[]).filter(entry=>entry.includes('borrowed-light')).length,1);
});

test('v3 skip-straight also accepts mixed gaps of one or two ranks',()=>{
 const g=game();give(g,0,'skip-straight');playing(g,{hands:[[3,5,6,7,8,9],[4,6,8,10,12],[13]]});
 g.seats[0].hand=cards(3,5,6,7,8,9);
 const run=cards(3,5,6,7,8),preview=selectionCombo(g,0,run);
 assert.equal(preview?.kind,'顺子');assert.equal(preview?.rank,8);assert.equal(preview?.size,5);
 playV3(g,0,run,4600);
 assert.equal(g.last?.combo.kind,'顺子');assert.equal(g.last?.combo.rank,8);assert.equal(g.last?.combo.size,5);
 const gap=game();give(gap,0,'skip-straight');playing(gap,{hands:[[3,6,7,8,9],[4,6,8,10,12],[13]]});
 gap.seats[0].hand=cards(3,6,7,8,9);
 assert.throws(()=>playV3(gap,0,cards(3,6,7,8,9),4601),/不能组成合法牌型/);
 const repeat=game();give(repeat,0,'skip-straight');playing(repeat,{hands:[[3,3,4,5,6],[4,6,8,10,12],[13]]});
 repeat.seats[0].hand=cards(3,3,4,5,6);
 assert.equal(selectionCombo(repeat,0,cards(3,3,4,5,6)),null);
});

test('v3 selection preview matches the combo the server will actually play',()=>{
 const smith=game();give(smith,0,'smith');playing(smith,{hands:[[11,12,9],[5,5],[10,10]]});
 smith.seats[0].hand=cards(11,12,9);smith.seats[1].hand=cards(5,5);
 smith.last={seat:1,cards:cards(5,5),combo:{kind:'对子',rank:5,size:2,chain:1}};
 const smithPick=cards(11,12),smithPreview=selectionCombo(smith,0,smithPick);
 assert.equal(smithPreview?.kind,'对子');assert.equal(smithPreview?.rank,12);
 playV3(smith,0,smithPick,4500);
 assert.equal(smith.last?.combo.kind,smithPreview?.kind);assert.equal(smith.last?.combo.rank,smithPreview?.rank);
 const shadow=game();give(shadow,0,'shadow-rank');playing(shadow,{hands:[[6,7,9],[5,5],[10,10]]});
 shadow.seats[0].hand=cards(6,7,9);shadow.seats[1].hand=cards(5,5);
 shadow.last={seat:1,cards:cards(5,5),combo:{kind:'对子',rank:5,size:2,chain:1}};
 const shadowPick=cards(6,7),shadowPreview=selectionCombo(shadow,0,shadowPick);
 assert.equal(shadowPreview?.kind,'对子');assert.equal(shadowPreview?.rank,7);
 assert(!shadow.log.some(entry=>entry.text.includes('影子牌发动：')));
 playV3(shadow,0,shadowPick,4501);
 assert.equal(shadow.last?.combo.rank,shadowPreview?.rank);
 assert(shadow.log.some(entry=>entry.text.includes('影子牌发动：')));
 const skip=game();give(skip,0,'skip-straight');playing(skip,{hands:[[3,5,7,9,11,12],[4,6,8,10,12],[13]]});
 skip.seats[0].hand=cards(3,5,7,9,11,12);
 const run=cards(3,5,7,9,11),skipPreview=selectionCombo(skip,0,run);
 assert.equal(skipPreview?.kind,'顺子');assert.equal(skipPreview?.rank,11);
 const plain=game();playing(plain,{hands:[[3,4,5],[6,7],[8,9]]});
 plain.seats[0].hand=cards(3,4,5);
 assert.equal(selectionCombo(plain,0,cards(3,4)),null);
 assert.equal(selectionCombo(plain,-1,cards(3)),null);
 assert.equal(selectionCombo(plain,0,[]),null);
});

test('v3 shadow-rank never breaks a play that already works',()=>{
 const g=game();give(g,0,'shadow-rank');playing(g,{hands:[[3],[6],[7]]});
 g.seats[0].hand=[50,44,45,47,virtualCard(14,1),40,41,36,35,29,31,25,20,0,1,2,3];
 g.last={seat:1,cards:[12],combo:{kind:'单张',rank:6,size:1,chain:1}};
 playV3(g,0,[44,45,47,virtualCard(14,1)],4400);
 assert.equal(g.last?.combo.kind,'炸弹');assert.equal(g.last?.combo.rank,14);
 assert.equal(g.seats[0].hand.length,13);
 assert(!g.log.some(entry=>entry.text.includes('影子牌发动：')));
 const pair=game();give(pair,0,'shadow-rank');playing(pair,{hands:[[6,7,9],[5,5],[10]]});
 pair.seats[0].hand=cards(6,7,9);pair.seats[1].hand=cards(5,5);
 pair.last={seat:1,cards:cards(5,5),combo:{kind:'对子',rank:5,size:2,chain:1}};
 playV3(pair,0,cards(6,7),4401);
 assert.equal(pair.last?.combo.kind,'对子');assert.equal(pair.last?.combo.rank,7);
 assert(pair.log.some(entry=>entry.text.includes('影子牌发动：')));
});

test('v3 shadow-rank and smith pick their substitution automatically without a declaration',()=>{
 const g=game();give(g,0,'shadow-rank');playing(g,{hands:[[8,9,10],[14,14],[7,7]]});
 playV3(g,0,cards(8,9),3950);
 assert.equal(g.last?.combo.kind,'对子');assert.equal(g.last?.combo.rank,9);
 assert(g.log.some(entry=>entry.text.includes('影子牌发动：')));
 const joker=game();give(joker,0,'shadow-rank');playing(joker,{hands:[[16,5],[10,10],[7,7]]});
 assert.throws(()=>playV3(joker,0,cards(16,5),3951),/这些牌不能组成合法牌型/);
 const smith=game();give(smith,0,'smith');playing(smith,{hands:[[11,12,3],[13,13],[7,7]]});
 playV3(smith,0,cards(11,12),3952);
 assert.equal(smith.last?.combo.kind,'对子');assert.equal(smith.last?.combo.rank,12);
});

test('v3 equipment buttons resolve through the same pending effect as the timeout path',()=>{
 const hold=game();give(hold,1,'bet-is-set');begin(hold);
 for(let seat=0;seat<3;seat++)finishShopping(hold,seat,3900+seat);
 resolveV3Equipment(hold,1,[],3910,{effect:'bet',choice:'hold'});
 assert.deepEqual(hold.betIsSet,{seat:1});assert.equal(hold.coins[1],'0');assert.equal(hold.phase,'bidding');
 const transfer=game();give(transfer,0,'four-with-two-pass');playing(transfer,{hands:[[9,9,9,9,3,4],[5,6],[7,8]]});
 playV3(transfer,0,cards(9,9,9,9,3,4),3920);
 resolveV3Equipment(transfer,0,cards(3,4),3921,{effect:'four-with-two-pass',target:2});
 assert.equal(transfer.seats[2].hand.length,4);assert.equal(transfer.winner,0);
 const bomb=game();give(bomb,1,'bomb-1');playing(bomb,{hands:[[3,4],[9,9,9,9,5,5],[7,8]]});
 bomb.turn=1;playV3(bomb,1,cards(9,9,9,9),3930);
 assert.equal(bomb.pendingEffect?.seat,1);
 resolveV3Equipment(bomb,1,[],3931,{effect:'bomb-1'});
 assert((bomb.equipmentUsed??[]).includes('1:bomb'));assert.equal(bomb.phase,'playing');
});



test('v3 privacy hides shopping bottom, per-player peeks and future windows',()=>{
 const g=game();give(g,0,'peek-bottom');give(g,1,'peek-bottom');begin(g);
 for(const player of g.seats)assert.deepEqual(viewV3(g,player.id).bottom,[-1,-1,-1]);
 bids(g);peekV3Bottom(g,0,0);peekV3Bottom(g,1,1);
 assert.deepEqual(viewV3(g,'a').bottom,[g.bottom[0],-1,-1]);
 assert.deepEqual(viewV3(g,'b').bottom,[-1,g.bottom[1],-1]);
 assert.deepEqual(viewV3(g,'c').bottom,[-1,-1,-1]);
 g.pending=[{kind:'borrowed',seat:1}];
 const view=viewV3(g,'a');assert.equal(view.pending,undefined);assert.equal(view.privatePeeks,undefined);
 assert.equal(g.pending.length,1);assert.deepEqual(g.privatePeeks,{'0':[0],'1':[1]});
});

test('v3 unfinished equipment cannot be randomly sold or bought from an old offer',()=>{
 for(let attempt=0;attempt<30;attempt++){
  const g=game();begin(g);assert(!g.shops.some(shop=>shop.offers.some(offer=>['quit-early','last-stand'].includes(offer.id))));
 }
 const g=game();begin(g);g.coins[0]='20';g.shops[0].offers=[{offerId:'pending',id:'quit-early',level:3,price:'4',bought:false}];
 assert.throws(()=>buyV3Equipment(g,0,'pending'),/尚未开放/);assert.equal(g.coins[0],'20');
});

test('v3 first-round purchases copy only after shopping closes, without private rank logs',()=>{
 const g=game();begin(g);g.shops[0].offers=[{offerId:'copy',id:'copy-1',level:1,price:'1',bought:false}];
 buyV3Equipment(g,0,'copy');assert.equal(g.seats[0].hand.length,17);
 bids(g);assert.equal(g.seats[0].hand.length,18);assert.match(g.log.find(entry=>entry.id==='copy-1')!.text,/复制了 1 张牌$/);
});

test('v3 series upgrades replace one slot at the correct price and enforce symmetric exclusions',()=>{
 const g=game();begin(g);give(g,0,'copy-1');g.coins[0]='10';
 g.shops[0].offers=[{offerId:'upgrade',id:'copy-3',level:3,price:'4',bought:false}];
 buyV3Equipment(g,0,'upgrade');assert.deepEqual(g.equipment[0].map(item=>item.id),['copy-3']);assert.equal(g.coins[0],'6');
 const h=game();begin(h);give(h,0,'precision-copy-1');h.coins[0]='10';h.shops[0].offers=[{offerId:'copy',id:'copy-1',level:1,price:'1',bought:false}];
 assert.throws(()=>buyV3Equipment(h,0,'copy'),/不能.*共存/);assert.equal(h.coins[0],'10');
});

test('v3 completed shopping rejects late purchases, sales and refreshes',()=>{
 const g=game();begin(g);give(g,0,'extra-refresh');finishShopping(g,0);
 assert.throws(()=>buyV3Equipment(g,0,g.shops[0].offers[0].offerId),/商店/);
 assert.throws(()=>sellV3Equipment(g,0,g.equipment[0][0].instanceId),/商店/);
 assert.throws(()=>refreshV3Shop(g,0),/商店/);
});

test('v3 equipment windows preserve the landlord first turn and give each skipped bettor a choice',()=>{
 const g=game();give(g,1,'all-in');give(g,2,'all-in');begin(g);g.dealer=0;bids(g);
 bidV3(g,0,true,5000);bidV3(g,1,false,5001);bidV3(g,2,false,5002);
 assert.equal(g.pendingEffect?.seat,1);
 resolveV3Equipment(g,1,[],5003,{choice:'skip'});assert.equal(g.pendingEffect?.seat,2);
 resolveV3Equipment(g,2,[],5004,{choice:'skip'});assert.equal(g.phase,'playing');assert.equal(g.turn,0);assert.equal(g.deadline,35004);
});

test('v3 reveal activates with a full hand, is table-limited, and restores the landlord turn',()=>{
 const g=game();give(g,1,'stand-up-fight');give(g,2,'stand-up-fight');begin(g);g.dealer=0;bids(g);
 bidV3(g,0,true);bidV3(g,1,false);bidV3(g,2,false);
 assert.equal(g.pendingEffect?.kind,'reveal');assert.equal(g.pendingEffect?.seat,1);
 resolveV3Equipment(g,1,[g.seats[1].hand.find(card=>rank(card)<16)!]);
 assert.equal(g.phase,'playing');assert.equal(g.turn,0);assert.equal(g.seats[1].hand.length,16);
 assert.equal(viewV3(g,'a').seats[1].hand.length,16);
});

test('v3 farmer income target window opens on their turn and cannot reopen after skip',()=>{
 const g=game();give(g,1,'cut-off-income');playing(g,{hands:[[3,4],[5,6],[7,8]]});
 playV3(g,0,cards(3));assert.equal(g.pendingEffect?.kind,'target');assert.equal(g.turn,1);
 resolveV3Equipment(g,1,[],5000,{choice:'skip'});assert.equal(g.phase,'playing');assert.equal(g.turn,1);
 playV3(g,1,cards(5));assert.equal(g.turn,2);
});

test('v3 rejects duplicate card IDs before mapping or equipment discards',()=>{
 const g=game();give(g,0,'smith');playing(g,{hands:[[11,12,3],[4],[5]]});
 const duplicate=[cards(11)[0],cards(11)[0]];
 assert.equal(selectionCombo(g,0,duplicate),null);assert.throws(()=>playV3(g,0,duplicate),/不重复/);
 g.phase='equipment';g.pendingEffect={seat:0,kind:'thirteen',max:13};
 assert.throws(()=>resolveV3Equipment(g,0,[cards(3)[0],cards(3)[0]]),/不重复/);
});

test('v3 precision-copy-two allows three existing cards when only one source has that rank',()=>{
 const g=game();give(g,0,'precision-copy-2');g.phase='equipment';g.pendingEffect={seat:0,kind:'opening'};
 hand(g,0,[3,3,3,4,5]);useV3OpeningEquipment(g,0,[cards(3)[0],cards(4)[0]]);
 assert.equal(g.seats[0].hand.filter(card=>rank(card)===3).length,4);
 assert.equal(g.seats[0].hand.filter(card=>rank(card)===4).length,2);
});

test('v3 connections remains consumed after the next round starts',()=>{
 const g=game();give(g,0,'connections');begin(g);g.coins[0]='20';connectionsV3(g,0,'airdrop');
 g.phase='finished';g.seats.forEach(player=>player.ready=false);for(let i=0;i<3;i++)readyV3(g,i);
 assert.throws(()=>connectionsV3(g,0,'skip-straight'),/本桌已经使用过/);
});


test('v3 gapped straights consume one use and ordinary straights can beat them',()=>{
 const g=game();give(g,0,'skip-straight');playing(g,{hands:[[3,5,7,9,11,12],[9,10,11,12,13,14],[4]]});
 playV3(g,0,cards(3,5,7,9,11));assert.equal(g.last?.combo.chain,5);assert(g.equipmentUsed.includes('0:skip-straight'));
 playV3(g,1,cards(9,10,11,12,13));assert.equal(g.last?.seat,1);
 g.turn=0;g.last=null;hand(g,0,[3,5,7,9,11,12]);assert.throws(()=>playV3(g,0,cards(3,5,7,9,11)),/合法牌型/);
});

test('v3 seeded complete tables terminate with legal bots, private views and nonnegative coins',t=>{
 let seed=713;
 t.mock.method(crypto,'getRandomValues',((buffer:Uint32Array)=>{for(let i=0;i<buffer.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;buffer[i]=seed;}return buffer;}) as typeof crypto.getRandomValues);
 for(let table=0;table<12;table++){
  const g=game();let turns=0;
  while(g.champion<0&&turns++<4000){
   const now=1000+turns*100;
   if(g.phase==='waiting'||g.phase==='finished'){for(let seat=0;seat<3;seat++)readyV3(g,seat,now);}
   else if(g.phase==='shopping'){const seat=g.seats.findIndex(player=>player.last!=='商店完成');v3BotAction(g,seat,now);}
   else v3BotAction(g,g.turn,now);
   assert(g.coins.every(value=>BigInt(value)>=0n));
   const live=g.seats.flatMap(player=>player.hand);assert.equal(new Set(live).size,live.length);
   for(let seat=0;seat<3;seat++){
    const visible=viewV3(g,g.seats[seat].id);
    assert(visible.shops.every((shop,index)=>index===seat||!shop.offers.length));
   }
  }
  assert(g.champion>=0,`table ${table} stalled after ${turns} steps`);assert(g.roundNumber<=13);
 }
});

 test('new skill rooms give all-pass landlord to the dealer for free, including a poor dealer',()=>{
 for(const dealer of [0,1,2])for(const coins of [['0','9','2'],['5','5','5'],['0','0','0']]){
 const g=game();begin(g);bids(g);g.dealer=dealer;g.turn=dealer;g.coins=[...coins];const count=g.seats[dealer].hand.length;
 for(let i=0;i<3;i++)bidV3(g,g.turn,false,1500+i);
 assert.equal(g.landlord,dealer);assert.equal(g.turn,dealer);assert.equal(g.stake,'0');assert.equal(g.bid,'0');assert.deepEqual(g.coins,coins);assert.equal(g.seats[dealer].hand.length,count+3);
 }
 });

test('free dealer preserves no-bid equipment payout only for other declarers',()=>{
 for(const dealer of [0,1]){const g=game();give(g,1,'no-bid');begin(g);bids(g);declareV3NoBid(g,1,1400);g.dealer=dealer;g.turn=dealer;g.coins=['2','5','2'];
 for(let n=0;n<3;n++)bidV3(g,g.turn,false,1500+n);assert.equal(g.landlord,dealer);assert.equal(g.stake,'0');assert.deepEqual(g.coins,['2',dealer===1?'5':'6','2']);}
});
