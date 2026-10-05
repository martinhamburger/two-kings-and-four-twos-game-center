import {face,isVirtualCard,rank,physicalCard} from './engine.ts';

export type CardAppearance='classic'|'royal';
export const CARD_RARITIES=['普通 · 蓝','稀有 · 橙','史诗 · 紫','传奇 · 五彩'] as const;
export const GALLERY_CARD_IDS=[...Array.from({length:13},(_,i)=>i*4),52,53];
export const rarityByRank=(value:number)=>value<=6?0:value<=10?1:value<=13?2:3;
const characters:Record<string,string>={A:'骷髅兵','2':'狂战士','3':'弓箭手','4':'野猪骑士','5':'气球兵','6':'电磁炮','7':'超级骑士','8':'戈仑石人','9':'三个火枪手','10':'哥布林电磁炮',J:'断网法术',Q:'弓箭女皇',K:'国王','小王':'哥布林小丑鼻子','大王':'哥布林大笑'};
export function royalCardArt(card:number){
 if(!Number.isInteger(card)||card<0||card>107||isVirtualCard(card))return null;
 card=physicalCard(card);
 const point=face(card),rarity=rarityByRank(rank(card));
 const file=card===52?'small-joker':card===53?'big-joker':`${point}-${rarity}`;
 return {src:`/cards/royal/${file}.webp`,point,rarity,character:characters[point],label:`${point} · ${characters[point]} · ${card>=52?'大小王':CARD_RARITIES[rarity]}`};
}
