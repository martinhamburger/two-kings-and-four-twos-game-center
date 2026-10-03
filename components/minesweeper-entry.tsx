import {ExternalLink,Grid3X3,Smartphone,Trophy} from 'lucide-react';
import {MINESWEEPER_URL} from '@/lib/indie-games';

export function MinesweeperEntry(){
 return <section className="last-pixel-entry minesweeper-entry" aria-labelledby="minesweeper-title">
  <div className="last-pixel-copy">
   <div className="indie-game-heading"><span className="indie-game-icon" aria-hidden="true"><Grid3X3 size={30}/></span><div><span className="last-pixel-kicker">独立作品 · 在线静态版</span>
   <h2 id="minesweeper-title">静态扫雷</h2></div></div>
   <p>10 × 10 全线索逻辑扫雷。根据整张棋盘的数字推理雷位，逐格确认安全区。</p>
   <div className="last-pixel-facts" aria-label="游戏信息"><span><Grid3X3 size={15}/>45 张题面</span><span><Smartphone size={15}/>电脑与手机</span><span><Trophy size={15}/>在线排行榜</span></div>
  </div>
  <div className="last-pixel-action">
   <a href={MINESWEEPER_URL} target="_blank" rel="noreferrer">打开静态扫雷<ExternalLink size={17}/></a>
   <small>将在新标签页打开 · 远端不可用时保留本机成绩</small>
  </div>
 </section>;
}
