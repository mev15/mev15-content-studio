# xhs-draft-publish

短信验证码登录小红书创作服务平台，把 [xhs-tweet-cards](../xhs-tweet-cards/) 生成的图文卡片与文案存入**草稿箱**。

**只存草稿，永不发布。** 脚本中不存在点击"发布"按钮的代码路径；终审与发布由你在手机 App 或创作后台完成。

## 安装

```bash
cd <此目录> && npm install
npx playwright install chromium          # 若 ~/.cache/ms-playwright 尚无匹配 build
```

## 鉴权：短信登录（无需看到浏览器界面）

```bash
node scripts/login.mjs --check                  # 先查登录态，有效就不用重登
node scripts/login.mjs --phone <11位手机号>      # 失效时走短信登录
```

登录脚本会填手机号、勾协议、点"发送验证码"，然后轮询等待。收到短信后把验证码写入 `.state/code.txt`，脚本自动提交并保存登录态到 `.state/storage-state.json`（权限 600）。每步截图落在 `.state/shots/`。

登录态存活通常数周，失效时 `--check` 会明确报出。

## 存草稿

```bash
node scripts/publish.mjs --dir <卡片目录> --dry-run   # 首次必做：填完内容不保存，看截图确认
node scripts/publish.mjs --dir <卡片目录>             # 确认后正式存草稿
```

目录内需有 `card-NN.png`（≤18 张）与 `caption.txt`（第 1 行标题 ≤20 字，空行后正文 ≤1000 字）。超限会在启动浏览器前就被拦下。每步截图落在 `<卡片目录>/publish-shots/`。

## 页面改版时

小红书前端 class 名是 emotion 生成的随机 hash（如 `css-1age63q`），会随版本变化。脚本用 placeholder 与可见文本定位，比 class 稳定，但仍可能失配。**失配时脚本会明确报错并留截图，不要为了"跑通"改用发布按钮或放宽选择器** —— 先看截图确认页面实际结构。

## 风控与安全

- 数据中心 IP 登录属账号安全侧的异常信号。用主力账号前建议先用测试号验证流程；从家宽环境运行更自然
- 保持人类量级节奏：一天一两篇，不要批量连发
- 存草稿不进入内容分发，是这条链上暴露最小的动作。**不要**把脚本改成自动发布
- 登录态 cookie 落在本机磁盘。若本机存有其他敏感凭据，考虑挪到隔离机器运行
- `.state/` 已在 `.gitignore` 中，严禁纳入版本控制或分享

## 许可

MIT
