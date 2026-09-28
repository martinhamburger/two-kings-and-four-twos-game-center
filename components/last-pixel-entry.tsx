import {Bot,Crosshair,ExternalLink,Monitor} from 'lucide-react';
import {LAST_PIXEL_URL} from '@/lib/indie-games';

export function LastPixelEntry(){
 return <section className="last-pixel-entry" aria-labelledby="last-pixel-title">
  <div className="last-pixel-copy">
   <span className="last-pixel-kicker">独立作品 · 稳定单机版</span>
   <h2 id="last-pixel-title">Last Pixel</h2>
   <p>原创 2.5D 生存射击。1 名玩家与 12 名 Bot，在缩圈中生存到最后。</p>
   <div className="last-pixel-facts" aria-label="游戏信息"><span><Monitor size={15}/>电脑端键鼠</span><span><Bot size={15}/>12 名 Bot</span><span><Crosshair size={15}/>无需登录</span></div>
  </div>
  <div className="last-pixel-action">
   <a href={LAST_PIXEL_URL} target="_blank" rel="noreferrer">打开单机版<ExternalLink size={17}/></a>
   <small>将在新标签页打开 · 联机版仍在开发中</small>
  </div>
  <div className="last-pixel-signal" aria-hidden="true"><span/><i/><b/></div>
 </section>;
}
