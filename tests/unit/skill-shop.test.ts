import test from 'node:test';
import assert from 'node:assert/strict';
import {newLandlordV3,buyV3Equipment,type V3Game,type V3Offer} from '../../lib/game/landlord-v3.ts';
import {shopOfferState} from '../../lib/game/shop-presentation.ts';
const fresh=()=>{const g=newLandlordV3('a','甲');g.phase='shopping';g.coins[0]='100000000000000000000000';g.roundNumber=1;return g;};
function state(g:V3Game,id:string){const item=g.rules.equipmentCatalog.find(e=>e.id===id)!;const offer:V3Offer={offerId:'test',id,price:item.price,level:item.level,bought:false};g.shops[0].offers=[offer];return {offer,presentation:shopOfferState(g,0,offer)};}
test('shop affordability and upgrade price remain exact decimal strings',()=>{
 const g=fresh();g.coins[0]='1';assert.equal(state(g,'bomb-2').presentation.reason,'金币不足');
 g.coins[0]='100000000000000000000000';g.equipment[0]=[{instanceId:'a',id:'bomb-1',level:1,price:'1'}];const upgrade=state(g,'bomb-2');assert.equal(upgrade.presentation.price,'1');assert(upgrade.presentation.upgrade);assert.equal(upgrade.presentation.reason,null);
 const before=BigInt(g.coins[0]);buyV3Equipment(g,0,'test');assert.equal(g.coins[0],String(before-1n));
});
test('shop displayed eligibility agrees with existing server rules across held/late/full states',()=>{
 const scenarios=[fresh(),fresh(),fresh(),fresh(),fresh(),fresh(),fresh()];
 scenarios[1].equipment[0]=[{instanceId:'a',id:'bomb-2',level:2,price:'2'}];scenarios[2].equipment[0]=[{instanceId:'a',id:'less-1',level:1,price:'1'}];scenarios[3].roundNumber=7;
 scenarios[4].equipment[0]=scenarios[4].rules.equipmentCatalog.filter(e=>!e.family).slice(0,8).map(e=>({...e,instanceId:e.id}));
 scenarios[5].seats[0].last='商店完成';scenarios[6].tableUsed=scenarios[6].rules.equipmentCatalog.filter(e=>e.tableOnce).map(e=>`buy:${e.id}`);
 for(const initial of scenarios)for(const item of initial.rules.equipmentCatalog){const g=structuredClone(initial),{presentation}=state(g,item.id);let succeeds=true;try{buyV3Equipment(g,0,'test')}catch{succeeds=false}assert.equal(!presentation.reason,succeeds,item.id+' '+presentation.reason);}
});
test('bought and closed shopping state cannot be offered for purchase',()=>{
 const g=fresh(),{offer}=state(g,'bomb-1');offer.bought=true;assert.equal(shopOfferState(g,0,offer).reason,'已购买');offer.bought=false;g.phase='bidding';assert.equal(shopOfferState(g,0,offer).reason,'已完成购买');
});
