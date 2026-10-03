import {face,isVirtualCard,suit} from './engine.ts';

export type CardAppearance='classic'|'royal';
// Engine suits are spades, hearts, clubs, diamonds. This is presentation only.
const rarityBySuit=[3,2,0,1] as const;
export const CARD_RARITIES=['普通 · 蓝','稀有 · 橙','史诗 · 紫','传奇 · 五彩'] as const;
const characters:Record<string,string>={A:'骷髅兵','2':'狂战士','3':'弓箭手','4':'野猪骑士','5':'气球兵','6':'电磁炮','7':'超级骑士','8':'戈仑石人','9':'三个火枪手','10':'哥布林电磁炮',J:'断网法术',Q:'弓箭女皇',K:'国王','小王':'哥布林小丑鼻子','大王':'哥布林大笑'};
export function royalCardArt(card:number){
 if(!Number.isInteger(card)||card<0||card>53||isVirtualCard(card))return null;
 const point=face(card),rarity=card>=52?3:rarityBySuit[card%4];
 const file=card===52?'small-joker':card===53?'big-joker':`${point}-${rarity}`;
 return {src:`/cards/royal/${file}.webp`,point,rarity,character:characters[point],label:`${suit(card)}${point} · ${characters[point]} · ${CARD_RARITIES[rarity]}`};
}
