# SharedNet 上手教程视频

真实 UI 录制 + Remotion 合成。成片：`video/out/sharednet-tutorial-zh.mp4`、`video/out/sharednet-tutorial-en.mp4`（1080p30，无音频，约 2:55）。

## 怎么来的

- **浏览器部分是真录的**：本机 `~/Desktop/SharedNet`（main）跑在 :3001，Playwright 以拟人方式操作（弯曲缓动的鼠标轨迹、不均匀的打字节奏），CDP screencast 逐帧存 JPEG（DPR 2，3072×1728）。
- **Agent 是真 CLI**：`sn.sh` 在 `.state/` 里模拟两台机器（alex-mbp 上的 Claude Code + Codex，sam-laptop 上的 Cursor），用 Dashboard 复制出来的那条命令真实入座、发言、发起审批。`SHAREDNET_WAKE=off`，不会去拉起真的 Claude/Codex 会话。
- **终端画面是重绘的**（`video/src/terminal.tsx`）：Claude Code / Codex 的界面是仿的，但命令、room/seat/message id、CLI 回显都取自本次录制的真实输出。
- **只做了两处外观替换**：页面上的 `127.0.0.1:3001` 显示成 `https://www.sharednet.ai`（剪贴板保留真命令）；隐藏 Next.js dev 角标。另外光标是按录到的坐标在合成层重画的（30fps 平滑）。

## 准备

- 本机跑着 SharedNet（main，:3001，本地 Postgres `sharednet_dev`）。
- 录制依赖：根目录 `npm install`（playwright-core，用 `~/Library/Caches/ms-playwright/chromium-1223` 里的 Chrome for Testing）。
- 合成依赖：`cd video && npm install remotion@4.0.504 @remotion/cli@4.0.504 @remotion/bundler@4.0.504 @remotion/renderer@4.0.504 react react-dom`。
- `.state/` 不进仓库：第一次需要建两个本地测试账号（alex/sam@sharednet.test）、给 Sam 签一个 dev API key，并写好 `.state/agents/<agent>/{env,machine,workspace}`，格式见 `sn.sh` 顶部注释。

## 重录

```bash
./prep.sh                 # 新建一个 "Alex Rivera" 账号 + 清空模拟机器 + Sam 的新 Room
node record.mjs           # 约 3 分钟，产出 rec/frames + rec/log.json
node build-clips.mjs      # -> video/public/clips/*.mp4 + video/src/take.json
cd video && node stills.mjs 20 60 120   # 抽帧检查
npx remotion render TutorialZH out/sharednet-tutorial-zh.mp4 --crf=18
```

剪辑（放大、加速、字幕）全在 `video/src/Root.tsx` 的 `SHOTS` 里，时间用录制时打的 cue（如 `'compose'`、`'c2+0.4'` = 第 3 次点击后 0.4s）表达，重录后不用改数字。

## 坑

- 空账号的 /chat 有内联「Schedule a Room」表单，和 + 弹窗里的表单同名，选择器要限定 `section form`。
- Invite 弹窗打开会自动滚到底；Copy command 在弹窗自己的滚动区里，「是否在屏」要用 elementFromPoint 判断。
- 跨账号 @ 默认被扣住，变成对方的「Allow an agent to respond?」Decision；Sam 那边由 `samAllowAll()` 在镜头外放行。
- 同一 Room 里有两个同名 seat 时 `@builder` 解析为空 → 每次重录都要给 Sam 新建 Room（prep.sh 已做）。
- 本地没配 Decision 优先级分类器，卡片上会显示「Classifying… · Provisional P2」，生产环境会是模型给的级别。
- `.state/` 存本地测试账号的密码、Sam 的 dev API key 和 cookie（只对本机 sharednet_dev 有效），别提交到任何仓库。
