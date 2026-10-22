"use client";

import {Backpack,Check,Coins,RefreshCw,ShoppingBag} from 'lucide-react';
import {EquipmentIcon,EquipmentInfo} from './equipment-ui';
import {equipmentLevel} from '@/lib/game/equipment-presentation';
import {V3_EQUIPMENT_CATALOG,type V3CatalogEntry} from '@/lib/game/landlord-v3';
import type {ReplayFrame} from '@/lib/replay/types';
import {Button} from './ui/button';

export function ReplaySkillShop({scene,seat}:{scene:ReplayFrame['scene'];seat:number}){
 const savedCatalog=scene.rules?.equipmentCatalog as V3CatalogEntry[]|undefined;
 const catalog=savedCatalog??V3_EQUIPMENT_CATALOG;
 const offers=scene.shops?.[seat]?.offers??[];
 const held=scene.equipment?.[seat]??[];
 const entry=(id:string)=>catalog.find(item=>item.id===id);
 return <section className="skill-shop-workspace replay-skill-shop" aria-label="技能模式商店回放">
  <header className="shop-workspace-header"><strong><ShoppingBag size={19}/>装备小铺</strong><span><Coins size={17}/><b>{scene.coins?.[seat]??0}</b></span><span><Backpack size={16}/>{held.length} / 8</span><span>{scene.seats.filter(player=>player.last==='商店完成').length} / {scene.seats.length} 完成</span><Button variant="outline" size="sm" disabled><RefreshCw size={14}/>刷新</Button><Button size="sm" disabled><Check size={16}/>完成购买</Button></header>
  <div className="shop-workspace-body"><div className="shop-offer-columns">{scene.shops?[1,2,3,4].map(level=><section className={`shop-tier tier-${level}`} key={level}><h4>{equipmentLevel(level)} 级</h4>{offers.filter(offer=>offer.level===level).map(offer=>{const item=entry(offer.id);return <article key={offer.offerId} className={`compact-offer${offer.bought?' is-bought':''}`}>{item?<EquipmentInfo entry={item}><EquipmentIcon id={item.id} size={23}/><strong>{item.name}</strong></EquipmentInfo>:<strong>{offer.id}</strong>}<div className="compact-offer-price"><Coins size={13}/><b>{offer.price}</b></div><Button size="sm" disabled>{offer.bought?'已购买':'待购买'}</Button></article>})}</section>):<div className="replay-shop-legacy"><ShoppingBag size={26}/><strong>这局的商店商品无法回看</strong><span>买过的装备仍会按当时的进度出现。</span></div>}</div>
   <aside className="shop-backpack"><h4><Backpack size={17}/>我的装备 <small>{held.length} / 8</small></h4><div className="shop-backpack-grid">{Array.from({length:8},(_,index)=>{const item=held[index],details=item&&entry(item.id);return <article key={item?.instanceId??index} className={!item?'empty-equipment':''}>{item&&details?<EquipmentInfo entry={details} level={item.level}><EquipmentIcon id={item.id}/><strong>{details.name}</strong><i>{equipmentLevel(item.level)}</i></EquipmentInfo>:item?<span>{item.id}</span>:<span aria-label={`空装备位 ${index+1}`}>{index+1}</span>}</article>})}</div></aside></div>
 </section>;
}
