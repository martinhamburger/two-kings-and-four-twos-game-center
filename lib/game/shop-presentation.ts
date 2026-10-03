import {equipmentAvailable,type V3Game,type V3Offer} from './landlord-v3.ts';
/** Presentation uses the saved catalog and public own-seat shop, without changing server rules. */
export function shopOfferState(g:V3Game,seat:number,offer:V3Offer){
 const entry=g.rules.equipmentCatalog.find(e=>e.id===offer.id),own=g.equipment[seat]??[],catalog=(id:string)=>g.rules.equipmentCatalog.find(e=>e.id===id);
 const family=entry?.family?own.find(e=>catalog(e.id)?.family===entry.family):undefined,upgrade=!!family&&family.level===offer.level-1;
 const price=(BigInt(offer.price)/(upgrade?2n:1n)).toString();
 let reason:string|null=null;
 if(g.phase!=='shopping'||g.seats[seat]?.last==='商店完成')reason='已完成购买';
 else if(offer.bought)reason='已购买';
 else if(!entry||!equipmentAvailable(offer.id))reason='未开放';
 else if(entry.id==='piggy-bank'&&g.roundNumber>6)reason='限前 6 局';
 else if(entry.tableOnce&&(g.tableUsed??[]).includes(`buy:${entry.id}`))reason='本桌已售出';
 else if(own.some(e=>e.id===entry.id))reason='已持有';
 else if(family&&family.level>=entry.level)reason='仅可向上升级';
 else if(own.some(e=>(catalog(e.id)?.exclusive??[]).includes(entry.family??''))||(entry.exclusive??[]).some(group=>own.some(e=>(catalog(e.id)?.exclusive??[]).includes(group)||catalog(e.id)?.family===group)))reason='装备冲突';
 else if(!family&&own.length>=8)reason='装备位已满';
 else if(BigInt(g.coins[seat])<BigInt(price))reason='金币不足';
 return {price,upgrade,reason};
}
