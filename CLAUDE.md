# mev15-content-studio

## 待办与项目记忆（GitHub Issues）

本仓库的 open issue 是遗留 bug、未开发 feature、技术债的**单一事实源**，多机器多 harness 共享。纪律：

- **开工先读**：动手前 `gh issue list --state open` 了解当前待办；排查"这症状修过吗"用 `gh issue list --state all --search "<关键词>"` 检索 closed 修复档案。
- **发现即写**：工作中发现新 bug / 想到新 feature / 留下技术债，先 `gh issue create`（打 `bug|feature|chore|idea` + `P0|P1|P2` 标签）再继续手头工作；信息不足就先裸记标题，细化时再补正文。
- **完成即闭环**：修复/开发一律走 PR，conventional 标题，正文带 `Fixes #N`，squash merge 自动关 issue；不手动关。
- **授权开关**：只有用户打了 `agent/ready` 标签的 issue，agent 才允许主动认领执行；认领时打 `agent/wip` + 留认领评论，见到别人的 `agent/wip` 就跳过；卡住打 `agent/blocked` + 评论卡点后停下。
- 敏感内容（凭据、token、cookie 值）不进 issue 正文，写"见本地配置"。
