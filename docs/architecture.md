# 代码地图：想改哪里，就从哪里进

这是一套应用，不是三个各自部署的网站。顶层布局共享账号和导航；不同游戏保留各自的规则引擎，避免一款游戏的调整影响另一款。

## 一次操作怎样走完

`页面点击 → 游戏接口检查身份 → 引擎计算是否合法 → 房间版本校验并原子提交 → 返回本人可见状态 → 页面显示`

筹码和胜负由服务端决定。客户端提交“出哪张牌”“选哪个方案”，不能提交可信的倍数或付款金额。两个设备同时操作时，只有符合当前房间版本的提交能成功。

## 常改文件

| 内容 | 入口与职责 |
|---|---|
| 页面入口 | `app/page.tsx`、`app/mahjong/page.tsx`、`app/holdem/page.tsx` |
| 统一大厅与导航 | `components/game-lobby.tsx`、`app/lobby.css`、`components/club-provider.tsx`、`components/game-nav.tsx`、`lib/club/` |
| 好友、在线状态与邀请 | `components/friends-provider.tsx`、`friends-panel.tsx`、`app/api/friends/`、`lib/social-server.ts` |
| 斗地主牌桌 | `components/poker-table.tsx`；规则在 `lib/game/engine.ts` |
| 麻将离桌 | `lib/mahjong/departure.ts`；在 `lib/rooms.ts` 原子提交中结算离桌，`app/api/lobby/` 推进大厅托管 |
| 麻将牌桌 | `components/mahjong-board.tsx`、`mahjong-tile.tsx`、`app/mahjong/table.css`；规则在 `lib/mahjong/` |
| 德州规则 | `lib/holdem/engine.ts`、`evaluate.ts`、`bot.ts` |
| 房间接口 | `app/api/game/`、`app/api/mahjong/`、`app/api/holdem/` |
| 共用提交和结算 | `lib/rooms.ts`；认证、参数和响应工具在 `lib/server.ts` |
| 聊天与气泡 | `app/api/chat/`、`components/use-room-messages.ts`、`room-chat.tsx`、`lib/chat-bubbles.ts` |
| 动画播放与缓存 | `lib/motion/`、`components/frame-motion.tsx`、`motion-playback.tsx` |
| 音乐与出牌播报 | `lib/audio/`、`components/table-sound.tsx` |
| 战报和分享 | `lib/mahjong/report*.ts`、`components/mahjong-report*.tsx`、`app/share/` |
| 数据结构与迁移 | `db/schema.ts`、`drizzle/` |
| 样式 | `app/globals.css` 与 `tables.css`、`holdem.css`、`effects.css`、`emotes.css` 等专题样式 |
| 本地工具和发布 | `scripts/`、`config/`、`.github/workflows/` |

## 公共功能怎样复用

- **导航和账号**：`ClubProvider` 管理当前登录状态与页面恢复。退出或换账号时清掉相关页面内存，防止串号。
- **好友**：只能向同桌真人发申请，由接收者同意。前台每 30 秒更新好友状态，90 秒内有有效会话心跳视为在线；退出会话即失效。邀请 10 分钟有效，接受时通过原游戏加入接口做原子占座，不能绕过房满、开局或固定成员限制。只返回本人关系、在线布尔值和邀请房间摘要。
- **聊天**：每房间一个订阅；表情与文字走同一消息接口；聊天框和未读计数只包含文字，表情仍在牌桌播放。聊天不修改房间版本、计时和筹码。发送只传编号，本机即时预览，服务器回执直接合并；见 [编号同步](chat-signals.md)。
- **动画**：所有游戏读同一素材登记表、缓存和播放器。加一款表情不应修改三个游戏页面。见 [缓存框架](motion-cache.md)。
- **人机**：斗地主和麻将的陪练在 `lib/practice/`，德州在自己的 `bot.ts`。只使用该玩家可以看到的信息。
- **公开信息**：渲染牌桌只能使用服务端过滤后的状态。不得为了播放特效把牌墙、别人的响应资格或提前的奖牌发给浏览器。

## 加功能时保持的边界

界面改动优先改组件；规则改动进入引擎并新增规则版本；账本改动集中在结算事务；数据库变更追加迁移。不要用昵称、聊天内容或日志文字来猜测牌局动作，也不要在组件里重算服务端筹码。

账号头像由 `components/avatar-provider.tsx` 按用户订阅，`components/avatar-editor.tsx` 本地裁剪；`lib/avatar/` 负责输入结构、版本合并和资料查询。`/api/profile/avatar` 只写本人独立头像表，`/api/avatars/[userId]/[version]` 读取版本图片。元数据搭载现有好友心跳，牌局同步不读取图片；追加迁移保持旧账号、房间和筹码不变。
