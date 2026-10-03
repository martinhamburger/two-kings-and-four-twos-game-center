import { EMOTES, type Emote } from '../emotes.ts';
import { TABLE_EFFECTS, type TableEffect } from './effects.ts';
import { validMotion } from './timeline.ts';
import { MOTION_CACHE_POLICY } from './cache-policy.ts';
import { ROYAL_ASSETS, type RoyalAsset } from './royal.ts';

export type MotionAsset = { src: string; active: boolean; role: 'cover' | 'sheet' };

/** One registration point feeds validation, fingerprints and browser preloading. */
export function collectMotionAssets(emotes: readonly Emote[], effects: readonly TableEffect[], royal:readonly RoyalAsset[]=[]): MotionAsset[] {
  const assets = new Map<string, MotionAsset>();
  const ids = new Set<string>();
  function add(src: string, active: boolean, role: MotionAsset['role']) {
    if (!/^\/(?:emotes|effects)\/[a-zA-Z0-9_/-]+\.webp$/.test(src)) throw new Error(`动画必须使用本站 WebP 路径：${src}`);
    const previous = assets.get(src);
    assets.set(src, { src, active: active || !!previous?.active, role: previous?.role === 'cover' ? 'cover' : role });
  }
  for (const [group, items] of [['emote', emotes], ['effect', effects]] as const) {
    for (const item of items) {
      const id = `${group}:${item.id}`;
      if (ids.has(id)) throw new Error(`重复动画编号：${id}`);
      ids.add(id);
      const emote = item as Emote;
      const active = group === 'effect' || (emote.enabled && emote.sendable !== false);
      const motion = group === 'effect' ? (item as TableEffect).motion : emote.frames;
      add(item.src, active, 'cover');
      if (motion) {
        if (!validMotion(motion)) throw new Error(`动画帧定义无效：${id}`);
        add(motion.poster, active, 'cover');
        for (const sheet of motion.sheets) {
          if (sheet.columns * sheet.rows * sheet.cellWidth * sheet.cellHeight > MOTION_CACHE_POLICY.maxSheetPixels) throw new Error(`动画图集解码尺寸过大，请拆分：${id}`);
          add(sheet.src, active, 'sheet');
        }
      }
    }
  }
  // Room artwork is registered and fingerprinted, but not globally prefetched in other games.
  for(const item of royal){
    const id=`royal:${item.id}`;if(ids.has(id))throw new Error(`重复动画编号：${id}`);ids.add(id);
    add(item.src,false,'cover');
    if(item.motion){
      if(!validMotion(item.motion))throw new Error(`动画帧定义无效：${id}`);
      add(item.motion.poster,false,'cover');
      for(const sheet of item.motion.sheets){
        if(sheet.columns*sheet.rows*sheet.cellWidth*sheet.cellHeight>MOTION_CACHE_POLICY.maxSheetPixels)throw new Error(`动画图集解码尺寸过大，请拆分：${id}`);
        add(sheet.src,false,'sheet');
      }
    }
  }
  return [...assets.values()].sort((a, b) => Number(a.role === 'sheet') - Number(b.role === 'sheet') || a.src.localeCompare(b.src, 'en'));
}

export const MOTION_CATALOG = collectMotionAssets(EMOTES, TABLE_EFFECTS, ROYAL_ASSETS);

/** Lightweight DOM feedback: no downloaded assets or separate cache are needed. */
export const TABLE_FEEDBACK_MOTIONS = {
 chips: {duration:650,frames:[{transform:'translateY(-7px) scale(.94)',opacity:.65},{transform:'translateY(0) scale(1.08)',opacity:1,offset:.5},{transform:'translateY(0) scale(1)',opacity:1}]},
 action: {duration:650,frames:[{transform:'scale(.9)',opacity:.4},{transform:'scale(1.12)',opacity:1,offset:.4},{transform:'scale(1)',opacity:1}]},
};
