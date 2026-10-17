# 娱乐中心

给朋友一起玩的在线游戏室：斗地主、136 张麻将（基础玩法 / ham 规）、4–10 人德州扑克。支持朋友与人机混合、独立账号、房间聊天、动态表情、筹码战报和管理后台。

建房还可选择自由对局或 **1 / 4 / 8 / 12 局友谊赛**：首局发牌后固定同桌玩家，按累计净成绩排名，同分共享冠军。打满后自动结算并释放座位；提前结束保留成绩、不颁冠军。技能斗地主沿用自己的专属赛制。详见 [友谊赛说明与验收](docs/friendly-match.md)。

- 线上站点：[娱乐中心](https://yule-center.hhhamburgerrr.chatgpt.site)
- 代码仓库：[two-kings-and-four-twos-game-center](https://github.com/martinhamburger/two-kings-and-four-twos-game-center)
- **修改从分支开始，PR 由 Martin 决定合并。合并不会自动上线。**

## 在自己电脑上运行

推荐 **Node.js 24 LTS + npm**。仓库已有 `package-lock.json`，统一使用 npm；不需要 pnpm，也不要混用两份锁文件。

```bash
git clone git@github.com:martinhamburger/two-kings-and-four-twos-game-center.git
cd two-kings-and-four-twos-game-center
npm run install:ci
npm run setup:local
npm run dev
```

打开 **[http://localhost:5173/](http://localhost:5173/)**，注册一个本地测试账号即可。选择游戏 → 建人机房，或在空座添加机器人 → 准备开局。本地账号与线上账号相互独立。

| 想看什么 | 本地地址 |
|---|---|
| 斗地主 | `http://localhost:5173/` |
| 麻将 | `http://localhost:5173/mahjong` |
| 德州扑克 | `http://localhost:5173/holdem` |
| 对局记录 | `http://localhost:5173/history` |
| 全部表情和牌型动画，可逐个重播 | `http://localhost:5173/emotes` |
| 早期动作样片对照，仅开发时使用 | `http://localhost:5173/dev/motion` |

如果端口被占用，先停止原来的预览服务。不要在 `5173` 启动失败后继续检查另一个旧页面。旧电脑上手工建过数据库、Windows 环境或需要管理员测试时，见 [本地开发](docs/local-development.md)。

## 测试与构建

```bash
npm run check       # 素材清单、类型、规则/框架测试、文档链接
npm run build       # 生成正式产物 dist/，同时写入版本标识
npm run test:smoke  # 启动正式产物，用独立本地数据库检查三游戏和聊天
npm start           # 手动检查正式产物，打开 http://localhost:8787/
```

开发预览顺畅不代表正式产物一定正常。发布前也要在 `8787` 实际点击三游戏切换、选牌、表情和对局记录。具体步骤见 [验收说明](docs/testing.md)。

## 从哪里开始改

| 要修改的内容 | 先看 |
|---|---|
| 页面、房间操作、规则分别在哪 | [代码地图](docs/architecture.md) |
| 新增表情、动画加载慢、缓存容量 | [素材与缓存框架](docs/motion-cache.md) |
| 游戏默认规则、老房间为什么不跟着变 | [规则与兼容](docs/rules-and-compatibility.md) |
| 登录、管理员、数据库迁移 | [运维说明](docs/operations.md) |
| PR、合并后手动发布、失败怎么处理 | [发布流程](docs/releasing.md) |
| 所有文档入口 | [文档目录](docs/README.md) |

## 发布

PR 检查通过，由你决定合并。之后在已连接 Sites 的 Codex 中说：

> 发布 main，按仓库 docs/releasing.md 执行。

Codex 会核对 GitHub 的 `main`、运行测试与正式构建、打包、发布到现有站点，并核验线上版本和素材。账号、密码、数据库和网址继续沿用。

`npm run release:prepare` 是本地验收和打包命令，**本身不会上线**；`npm run release:verify` 检查已经发布的结果。GitHub Actions 负责自动验收和保存构建产物，不保存 Sites 凭据，也不冒充部署成功。

## 项目边界

这是朋友之间的娱乐游戏室，没有现金充值或提现。服务端使用 Vinext / React、Cloudflare Workers 和 D1；三个游戏共享登录、导航、聊天、动画与数据提交框架，规则引擎各自独立。

当前采用轮询同步。只要还有成员在线，请求会推进超时和机器人；全部离线后，恢复访问时继续。没有宣称支持大规模并发，表情绘制质量、第三方素材来源和未完成项目见 [素材记录](docs/emotes/README.md)。
