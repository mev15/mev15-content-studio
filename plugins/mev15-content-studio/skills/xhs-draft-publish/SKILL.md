---
name: xhs-draft-publish
description: 用短信验证码登录小红书创作服务平台，把生成好的图文卡片与文案存入草稿箱（只存草稿，不发布）。配合 xhs-carousel 或 xhs-tweet-cards 使用。触发词："存小红书草稿"、"上传小红书"、"发小红书草稿"、"xhs 草稿"、"小红书登录"。
---

# xhs-draft-publish：图文卡片 → 小红书草稿箱

**只存草稿，永不发布。** 脚本里不存在点击"发布"按钮的代码路径；终审与发布由用户在手机 App 或创作后台完成。

## 一、前置条件

- 输入目录里有 `card-NN.png`（≤18 张）和 `caption.txt`（第 1 行标题 ≤20 字，空行后为正文 ≤1000 字）——即 `xhs-carousel` 或 `xhs-tweet-cards` 的输出目录
- 登录态默认存于 `~/.config/xhs-draft-publish/storage-state.json`（目录权限 700、文件权限 600）；存草稿后同一文件还会保存网页端本地草稿所需的 IndexedDB。设置了 `XDG_CONFIG_HOME` 时随其变化，也可用 `XHS_STATE_DIR` 覆盖整个状态目录

## 二、鉴权：短信验证码登录（可能追加 App 扫码验证）

**先检查现有登录态**，有效就直接跳到第三步：

```bash
node <skill目录>/scripts/login.mjs --check
```

输出 JSON，`ok: true` 即有效。失效或从未登录时走短信登录：

```bash
# 后台运行（脚本会阻塞等待验证码，最长 5 分钟）
node <skill目录>/scripts/login.mjs --phone <11位手机号>
```

流程与你（Claude）的配合方式：

1. 脚本填手机号、勾协议、点"发送验证码"，然后轮询等待
2. **向用户要验证码**：告诉用户短信已发出，请把 6 位验证码发到对话里
3. 用户给出后，你把它写入 `<state目录>/code.txt`（默认是 `~/.config/xhs-draft-publish/code.txt`）
4. 脚本读到后自动提交；若账号触发二次验证，脚本输出实时二维码截图并等待最多 2 分钟，立即让用户用已登录该账号的小红书 App 扫码
5. 验证成功后保存登录态并打印 `✅ 登录成功`

失败时脚本会在 `~/.config/xhs-draft-publish/shots/` 留下每步截图，用 Read 查看定位原因（验证码错误/过期、二次验证等）。

## 三、存草稿

```bash
# 先干跑：填完内容但不保存，看截图确认无误
node <skill目录>/scripts/publish.mjs --dir <卡片目录> --dry-run

# 确认后正式存草稿
node <skill目录>/scripts/publish.mjs --dir <卡片目录>
```

脚本会：切到图文标签 → 投喂图片到 file input → 填标题 → 逐行键入正文（正文是 contenteditable，必须模拟键入）→ 点"存草稿"。每步截图落到 `<卡片目录>/publish-shots/`。

**首次运行必须用 `--dry-run`，并用 Read 查看截图确认页面结构匹配。** 小红书前端 class 名是 emotion 生成的随机 hash（如 `css-1age63q`），会随版本变化；脚本用 placeholder 和可见文本定位，比 class 稳定，但仍可能因改版失配。失配时脚本会明确报错并留截图，**不要为了"跑通"改用发布按钮或放宽选择器**——先把截图给用户看。

## 四、执行后

告知用户：草稿已存 + 截图路径。当前小红书创作后台明确提示网页草稿存储于浏览器本地；脚本会把 IndexedDB 持久化到 `storage-state.json`，供同一 skill 下次恢复。**不要承诺草稿会同步到手机 App**，应在同一脚本/配置状态打开的创作后台复查。

## 五、风控与安全须知（须主动向用户提示一次）

- 若从数据中心 IP（非家宽）运行，属账号安全侧的异常信号。用主力账号前建议先用测试号验证流程
- 保持人类量级节奏：一天一两篇，不要批量连发
- 存草稿不进入内容分发，是这条链上暴露最小的动作；**不要**把这套脚本改成自动发布
- 登录 Cookie 与网页端本地草稿状态落在本机配置目录（目录 0700、文件 0600）。若本机存有其他敏感凭据，可考虑把本 skill 挪到无私钥的机器运行
- 严禁把 `~/.config/xhs-draft-publish/` 或自定义 `XHS_STATE_DIR` 纳入任何版本控制或公开分享
