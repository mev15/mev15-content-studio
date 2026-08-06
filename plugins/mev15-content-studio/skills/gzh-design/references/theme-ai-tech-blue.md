# 公众号排版组件库 —— AI 科技蓝

> 主题 ID：`theme-ai-tech-blue`。以清爽、理性、信息密度较高的 AI 科技文章为核心场景；版式使用杂志刊头、标签索引、状态面板与轻卡片，避免深色大底与渐变。
>
> 配色：03「清晰数字蓝」。同系列的 05「清透湖蓝」已独立注册为 `theme-ai-lake-blue`，可直接按主题名选择。

## 设计变量速查表

| 变量 | 默认值 | 用途 |
|---|---:|---|
| 主色 | `#3F73B9` | 标题、编号、关键结论、实色标签 |
| 次主色 | `#5688C5` | 封面底栏、目录激活项、CTA |
| 浅青强调 | `#82B6D3` | 状态点、进度条、装饰短线 |
| 浅蓝线 | `#C2D8EA` | 正文关键词下划线、边框、分隔 |
| 浅蓝底 | `#EAF3F8` | 信息卡、胶囊标签、浅色代码区 |
| 奶油黄 | `#F6D46B` | 金句下划线、暖色提示、少量装饰 |
| 浅奶油黄 | `#FFF0B5` | 小节标题高亮 |
| 标题色 | `#34495A` | 文章标题、章节标题 |
| 正文色 | `#455B6B` | 正文与说明文字 |
| 页面背景 | `#FBFCFD` | 全局近白背景 |

同系列 05「清透湖蓝」变量：主色 `#3E8CB8`、次主色 `#5FA5C5`、浅青强调 `#88C5D4`、浅蓝线 `#C4DEE8`、浅蓝底 `#E8F5F8`；完整组件见 `theme-ai-lake-blue.md`。

正文关键词默认标记：`border-bottom:2px solid #C2D8EA;font-weight:600;`。

## 组件 1 全局容器

```html
<section style="max-width:677px;margin:0 auto;background:#FBFCFD;color:#455B6B;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;line-height:1.8;padding:0 0 24px;">
  <span leaf="">{{文章正文组件}}</span>
</section>
```

## 各组件完整 HTML

### 1. 刊头与标题

#### 杂志快讯封面·无图

```html
<section style="margin:0 0 18px;background:#FFFFFF;border:1.5px solid rgba(63,115,185,0.18);border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(69,91,107,0.07);">
      <section style="padding:20px 28px 28px;">
        <p style="font-size:11px;color:#3F73B9;letter-spacing:3px;font-weight:700;margin:0 0 20px;"><span leaf="">DEEP DIVE · 专题导语</span></p>
        <p style="font-size:15px;color:#C2CCD3;margin:0 0 6px;text-decoration:line-through;"><span leaf="">旧方法占位</span></p>
        <p style="font-size:24px;font-weight:900;color:#34495A;margin:0;line-height:1.08;letter-spacing:-1px;"><span leaf="">从信息堆积到 </span><span style="color:#3F73B9;"><span leaf="">清晰结构</span></span></p>
        <p style="font-size:24px;font-weight:900;color:#3F73B9;margin:0 0 16px;line-height:1.08;letter-spacing:-1px;"><span leaf="">一套方法说明占位</span></p>
        <span style="display:block;width:48px;height:3px;background:#82B6D3;border-radius:2px;margin-bottom:12px;"><span leaf=""><br></span></span>
        <p style="font-size:13px;color:#8493A0;margin:0;line-height:1.7;"><span leaf="">框架拆解 · 案例说明 · 结论提炼</span></p>
      </section>
      <section style="background:#5688C5;padding:12px 28px;">
        <p style="font-size:12px;color:#FFFFFF;margin:0;font-weight:600;"><span leaf="">蓝色科技专题 · 结构预览</span></p>
      </section>
    </section>
```

#### 横向索引目录

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:16px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <section style="display:flex;align-items:stretch;overflow-x:auto;padding-bottom:6px;">
        <section style="min-width:110px;background:#5688C5;border-radius:12px;padding:12px;margin-right:8px;box-sizing:border-box;">
          <p style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.72);letter-spacing:1px;margin:0 0 5px;"><span leaf="">PART 01</span></p>
          <p style="font-size:13px;font-weight:800;color:#FFFFFF;margin:0 0 3px;"><span leaf="">背景说明</span></p>
          <p style="font-size:10px;color:rgba(255,255,255,0.72);margin:0;"><span leaf="">问题从何而来</span></p>
        </section>
        <section style="min-width:110px;background:#FFFFFF;border:1px solid #E4EAED;border-radius:12px;padding:12px;margin-right:8px;box-sizing:border-box;">
          <p style="font-size:9px;font-weight:700;color:#8493A0;letter-spacing:1px;margin:0 0 5px;"><span leaf="">PART 02</span></p>
          <p style="font-size:13px;font-weight:800;color:#34495A;margin:0 0 3px;"><span leaf="">方法拆解</span></p>
          <p style="font-size:10px;color:#8493A0;margin:0;"><span leaf="">结构如何建立</span></p>
        </section>
        <section style="min-width:110px;background:#FFFFFF;border:1px solid #E4EAED;border-radius:12px;padding:12px;box-sizing:border-box;">
          <p style="font-size:9px;font-weight:700;color:#8493A0;letter-spacing:1px;margin:0 0 5px;"><span leaf="">PART ///</span></p>
          <p style="font-size:13px;font-weight:800;color:#34495A;margin:0 0 3px;"><span leaf="">写在最后</span></p>
          <p style="font-size:10px;color:#8493A0;margin:0;"><span leaf="">结论说明占位</span></p>
        </section>
      </section>
    </section>
```

#### 编号章节标题

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:16px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <section style="display:flex;align-items:center;">
        <section style="text-align:center;flex-shrink:0;margin-right:16px;">
          <p style="margin:0;font-size:24px;font-weight:900;color:#3F73B9;line-height:1;letter-spacing:-1px;"><span leaf="">01</span></p>
          <p style="margin:2px 0 0;font-size:8px;font-weight:700;color:#C2CCD3;letter-spacing:2px;"><span leaf="">PART</span></p>
        </section>
        <span style="width:1px;height:36px;background:#E4EAED;margin-right:16px;"><span leaf=""><br></span></span>
        <section>
          <p style="margin:0 0 2px;font-size:17px;font-weight:900;color:#34495A;"><span leaf="">章节标题占位</span></p>
          <p style="margin:0;font-size:11px;font-weight:600;color:#8493A0;letter-spacing:1.5px;"><span leaf="">MODEL · STRUCTURE</span></p>
        </section>
      </section>
    </section>
```

#### 奶油黄小节标题

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:16px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <p style="font-size:15px;font-weight:900;color:#34495A;margin:0;">
        <span style="background:#FFF0B5;border-radius:3px;padding:0 4px;"><span leaf="">小节标题占位</span></span>
      </p>
    </section>
```

#### 步骤标签

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:16px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <section style="display:flex;align-items:center;margin-bottom:10px;">
        <span style="background:#3F73B9;color:#FFFFFF;font-size:10px;font-weight:700;padding:3px 9px;border-radius:12px;margin-right:8px;"><span leaf="">STEP 01</span></span>
        <span style="font-size:15px;font-weight:800;color:#34495A;"><span leaf="">步骤标题占位</span></span>
      </section>
      <p style="font-size:14px;margin:0;color:#617484;line-height:1.9;"><span leaf="">步骤说明文字占位，用于展示操作顺序与重点信息。</span></p>
    </section>
```

### 2. 正文与强调

#### 正文段落

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:16px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <p style="font-size:14px;line-height:1.9;text-align:justify;margin:0;color:#455B6B;"><span leaf="">正文说明文字占位。段落中的 </span><span style="border-bottom:2px solid #C2D8EA;font-weight:600;"><span leaf="">核心观点占位</span></span><span leaf=""> 使用浅蓝下划线标记，</span><strong style="color:#3F73B9;"><span leaf="">关键结论占位</span></strong><span leaf=""> 使用主色加粗。</span></p>
    </section>
```

#### 行内强调样式

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:16px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <p style="font-size:14px;line-height:2.2;margin:0;color:#455B6B;">
        <strong style="color:#3F73B9;"><span leaf="">主色加粗</span></strong>　
        <span style="color:#3F73B9;background:rgba(63,115,185,0.10);padding:2px 5px;border-radius:3px;font-weight:700;"><span leaf="">蓝底标签</span></span>　
        <span style="background:#FFF0B5;padding:0 4px;font-weight:600;color:#34495A;"><span leaf="">奶油黄高亮</span></span>　
        <span style="border-bottom:2px solid #F6D46B;font-weight:600;"><span leaf="">暖黄标记</span></span>
      </p>
    </section>
```

#### 提示词短块

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:16px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <p style="font-size:13px;color:#455B6B;margin:0;line-height:1.8;">
        <span style="display:inline-block;background:#3F73B9;color:#FFFFFF;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin-right:7px;letter-spacing:0.5px;"><span leaf="">PROMPT</span></span>
        <span style="font-size:12px;color:#6F8291;font-weight:700;"><span leaf="">提示词结构说明占位</span></span>
      </p>
    </section>
```

#### 单行命令

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:16px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <p style="font-size:13px;color:#455B6B;margin:0;line-height:1.8;">
        <span style="display:inline-block;background:#6F8291;color:#FFFFFF;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin-right:7px;"><span leaf="">CMD</span></span>
        <code style="background:#F3F6F8;color:#455B6B;padding:3px 7px;border-radius:4px;font-size:13px;font-weight:600;"><span leaf="">command --example value</span></code>
      </p>
    </section>
```

#### 柔灰代码块

```html
<section style="margin:0 0 18px;background:#F7FAFC;border-radius:14px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.07);border:1px solid #D8E2E8;">
      <p style="font-size:12px;color:#3F73B9;margin:0;line-height:1.7;font-family:monospace;"><span leaf="">const structure = {</span></p>
      <p style="font-size:12px;color:#455B6B;margin:0;line-height:1.7;font-family:monospace;"><span leaf="">　title: '示例结构',</span></p>
      <p style="font-size:12px;color:#B88922;margin:0;line-height:1.7;font-family:monospace;"><span leaf="">　status: 'ready'</span></p>
      <p style="font-size:12px;color:#3F73B9;margin:0;line-height:1.7;font-family:monospace;"><span leaf="">};</span></p>
    </section>
```

#### 蓝黄金句卡

```html
<section style="margin:0 0 18px;background:#FFFFFF;border:1px dashed #C2D8EA;border-radius:8px;padding:16px;text-align:center;box-sizing:border-box;">
      <p style="margin:0;line-height:1.7;"><span style="font-size:15px;color:#3F73B9;font-weight:bold;border-bottom:3px solid #F6D46B;padding-bottom:2px;"><span leaf="">核心金句占位</span></span></p>
    </section>
```

### 3. 提示与结构

#### 踩坑提示

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:14px;padding:16px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <p style="font-size:12px;font-weight:700;color:#F97316;letter-spacing:1px;margin:0 0 6px;"><span leaf="">！注意事项</span></p>
      <p style="font-size:13px;color:#6F8291;margin:0;line-height:1.7;font-weight:600;"><span leaf="">容易忽略的条件与限制说明占位。</span></p>
    </section>
```

#### 蓝色实践提示

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:14px;padding:16px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <p style="font-size:12px;font-weight:700;color:#3F73B9;letter-spacing:1px;margin:0 0 6px;"><span leaf="">✦ 实践提示</span></p>
      <p style="font-size:13px;color:#455B6B;margin:0;line-height:1.7;"><span leaf="">可直接行动的建议与方法说明占位。</span></p>
    </section>
```

#### 黄色警告框

```html
<section style="margin:0 0 18px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:16px 18px;box-sizing:border-box;">
      <p style="font-size:13px;color:#92400E;margin:0;font-weight:700;line-height:1.7;"><span leaf="">风险信息或使用边界说明占位。</span></p>
    </section>
```

#### 蓝色信息框

```html
<section style="margin:0 0 18px;background:#EAF3F8;border:1px solid #DCEAF5;border-radius:8px;padding:16px 18px;box-sizing:border-box;">
      <p style="font-size:13px;color:#455B6B;margin:0;line-height:1.7;text-align:justify;"><span leaf="">背景信息、概念说明或补充资料占位。</span></p>
    </section>
```

#### 青色成功卡

```html
<section style="margin:0 0 18px;background:#F2F8F8;border:1px solid #F6D46B;border-radius:12px;padding:16px 18px;box-sizing:border-box;">
      <p style="font-size:13px;color:#567781;margin:0;font-weight:700;line-height:1.7;"><span leaf="">阶段完成、验证通过或正向结果说明占位。</span></p>
    </section>
```

#### 暖黄注意卡

```html
<section style="margin:0 0 18px;background:#FFF8E3;border:1px solid #F6E6A9;border-radius:12px;padding:16px 18px;box-sizing:border-box;">
      <p style="font-size:13px;color:#7E6521;margin:0;font-weight:700;line-height:1.7;"><span leaf="">例外情况或延伸思考说明占位。</span></p>
    </section>
```

#### 胶囊列表

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:14px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <p style="margin:0 0 8px;"><span style="display:inline-block;font-size:13px;font-weight:700;color:#3F73B9;background:rgba(63,115,185,0.09);padding:4px 11px;border-radius:999px;"><span style="display:inline-block;width:6px;height:6px;background:#3F73B9;border-radius:50%;margin-right:6px;vertical-align:middle;"><span leaf=""><br></span></span><span leaf="">要点一占位</span></span></p>
      <p style="margin:0;"><span style="display:inline-block;font-size:13px;font-weight:700;color:#6D9EA7;background:rgba(6,182,212,0.09);padding:4px 11px;border-radius:999px;"><span style="display:inline-block;width:6px;height:6px;background:#82B6D3;border-radius:50%;margin-right:6px;vertical-align:middle;"><span leaf=""><br></span></span><span leaf="">要点二占位</span></span></p>
    </section>
```

#### 三步流程卡

```html
<section style="margin:0 0 18px;background:#FBFCFD;border-radius:12px;border:1px solid #E4EAED;padding:16px;box-sizing:border-box;">
      <section style="display:flex;align-items:stretch;justify-content:center;">
        <section style="flex:1;text-align:center;padding:10px 7px;background:#5688C5;border-radius:8px;">
          <p style="font-size:13px;font-weight:800;color:#FFFFFF;margin:0 0 3px;"><span leaf="">输入</span></p><p style="font-size:10px;color:rgba(255,255,255,0.8);margin:0;"><span leaf="">材料占位</span></p>
        </section>
        <span style="display:flex;align-items:center;color:#C2CCD3;font-size:14px;padding:0 6px;"><span leaf="">→</span></span>
        <section style="flex:1;text-align:center;padding:10px 7px;background:#FFFFFF;border:1px solid #E4EAED;border-radius:8px;">
          <p style="font-size:13px;font-weight:800;color:#34495A;margin:0 0 3px;"><span leaf="">处理</span></p><p style="font-size:10px;color:#8493A0;margin:0;"><span leaf="">步骤占位</span></p>
        </section>
        <span style="display:flex;align-items:center;color:#C2CCD3;font-size:14px;padding:0 6px;"><span leaf="">→</span></span>
        <section style="flex:1;text-align:center;padding:10px 7px;background:#FFFFFF;border:1px solid #C2D8EA;border-radius:8px;">
          <p style="font-size:13px;font-weight:800;color:#3F73B9;margin:0 0 3px;"><span leaf="">输出</span></p><p style="font-size:10px;color:#8493A0;margin:0;"><span leaf="">结果占位</span></p>
        </section>
      </section>
    </section>
```

#### 节点时间线

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:14px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <section style="display:flex;">
        <section style="display:flex;flex-direction:column;align-items:center;margin-right:16px;flex-shrink:0;"><span style="width:14px;height:14px;border-radius:50%;border:3px solid #3F73B9;background:#FFFFFF;margin-top:4px;box-sizing:border-box;"><span leaf=""><br></span></span><span style="width:2px;background:#E4EEF7;min-height:64px;margin-top:4px;"><span leaf=""><br></span></span></section>
        <section style="flex:1;"><p style="font-size:11px;font-weight:700;color:#3F73B9;letter-spacing:1px;margin:0 0 6px;"><span leaf="">NODE 01</span></p><p style="font-size:15px;font-weight:800;color:#34495A;margin:0 0 8px;"><span leaf="">阶段标题占位</span></p><p style="font-size:14px;color:#617484;line-height:1.7;margin:0;"><span leaf="">节点进展与阶段说明占位。</span></p></section>
      </section>
    </section>
```

### 4. 数据与列表

#### 数据表格

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:14px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr><th style="background:#3F73B9;color:#FFFFFF;padding:9px 12px;text-align:left;"><span leaf="">字段占位</span></th><th style="background:#3F73B9;color:#FFFFFF;padding:9px 12px;text-align:left;"><span leaf="">说明占位</span></th><th style="background:#3F73B9;color:#FFFFFF;padding:9px 12px;text-align:left;"><span leaf="">状态占位</span></th></tr></thead>
        <tbody><tr><td style="padding:9px 12px;border-bottom:1px solid #E4EAED;"><span leaf="">参数甲</span></td><td style="padding:9px 12px;border-bottom:1px solid #E4EAED;"><span leaf="">内容说明</span></td><td style="padding:9px 12px;border-bottom:1px solid #E4EAED;color:#3F73B9;font-weight:700;"><span leaf="">示例状态</span></td></tr><tr><td style="padding:9px 12px;background:#FBFCFD;"><span leaf="">参数乙</span></td><td style="padding:9px 12px;background:#FBFCFD;"><span leaf="">内容说明</span></td><td style="padding:9px 12px;background:#FBFCFD;color:#6D9EA7;font-weight:700;"><span leaf="">示例状态</span></td></tr></tbody>
      </table>
    </section>
```

#### 数字编号列表

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:14px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <section style="display:flex;align-items:flex-start;margin-bottom:12px;"><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#3F73B9;color:#FFFFFF;font-size:11px;font-weight:700;border-radius:50%;margin-right:10px;flex-shrink:0;"><span leaf="">1</span></span><p style="font-size:14px;color:#455B6B;margin:0;line-height:1.7;"><span leaf="">第一项内容说明占位</span></p></section>
      <section style="display:flex;align-items:flex-start;"><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#82B6D3;color:#FFFFFF;font-size:11px;font-weight:700;border-radius:50%;margin-right:10px;flex-shrink:0;"><span leaf="">2</span></span><p style="font-size:14px;color:#455B6B;margin:0;line-height:1.7;"><span leaf="">第二项内容说明占位</span></p></section>
    </section>
```

#### 圆点无序列表

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:14px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <p style="font-size:14px;color:#455B6B;margin:0 0 9px;line-height:1.7;"><span style="color:#3F73B9;font-weight:900;margin-right:8px;"><span leaf="">●</span></span><span leaf="">并列要点说明占位</span></p>
      <p style="font-size:14px;color:#455B6B;margin:0;line-height:1.7;"><span style="color:#82B6D3;font-weight:900;margin-right:8px;"><span leaf="">●</span></span><span leaf="">补充要点说明占位</span></p>
    </section>
```

#### 任务检查清单

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:14px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <section style="display:flex;align-items:center;margin-bottom:10px;"><span style="width:18px;height:18px;border-radius:5px;background:#3F73B9;color:#FFFFFF;font-size:12px;text-align:center;line-height:18px;margin-right:9px;"><span leaf="">✓</span></span><span style="font-size:14px;color:#455B6B;"><span leaf="">已完成事项占位</span></span></section>
      <section style="display:flex;align-items:center;"><span style="width:18px;height:18px;border-radius:5px;border:1px solid #C2CCD3;background:#FFFFFF;margin-right:9px;"><span leaf=""><br></span></span><span style="font-size:14px;color:#6F8291;"><span leaf="">待确认事项占位</span></span></section>
    </section>
```

#### 指标摘要卡

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:14px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <section style="display:flex;">
        <section style="flex:1;background:#EAF3F8;border-radius:10px;padding:12px;text-align:center;margin-right:8px;"><p style="font-size:20px;color:#3F73B9;font-weight:900;margin:0 0 3px;"><span leaf="">数字</span></p><p style="font-size:10px;color:#6F8291;margin:0;"><span leaf="">指标甲占位</span></p></section>
        <section style="flex:1;background:#F2F8F8;border-radius:10px;padding:12px;text-align:center;margin-right:8px;"><p style="font-size:20px;color:#6D9EA7;font-weight:900;margin:0 0 3px;"><span leaf="">比例</span></p><p style="font-size:10px;color:#6F8291;margin:0;"><span leaf="">指标乙占位</span></p></section>
        <section style="flex:1;background:#FFF8E3;border-radius:10px;padding:12px;text-align:center;"><p style="font-size:20px;color:#B88922;font-weight:900;margin:0 0 3px;"><span leaf="">趋势</span></p><p style="font-size:10px;color:#6F8291;margin:0;"><span leaf="">指标丙占位</span></p></section>
      </section>
    </section>
```

#### 进度状态条

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:14px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <section style="display:flex;justify-content:space-between;margin-bottom:7px;"><span style="font-size:13px;color:#455B6B;font-weight:700;"><span leaf="">阶段进度占位</span></span><span style="font-size:12px;color:#3F73B9;font-weight:700;"><span leaf="">示例比例</span></span></section>
      <section style="height:8px;background:#E4EAED;border-radius:999px;overflow:hidden;"><span style="display:block;width:72%;height:8px;background:#82B6D3;border-radius:999px;"><span leaf=""><br></span></span></section>
    </section>
```

#### 系统状态面板

```html
<section style="margin:0 0 18px;background:#F7FAFC;border:1px solid #DCEAF5;border-radius:14px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <section style="display:flex;align-items:center;margin-bottom:10px;"><span style="width:8px;height:8px;background:#9BC9CF;border-radius:50%;margin-right:9px;"><span leaf=""><br></span></span><span style="font-size:13px;color:#455B6B;font-weight:700;"><span leaf="">状态信息占位</span></span><span style="font-size:10px;color:#3F73B9;margin-left:auto;"><span leaf="">READY</span></span></section>
      <section style="display:flex;align-items:center;"><span style="width:8px;height:8px;background:#F6D46B;border-radius:50%;margin-right:9px;"><span leaf=""><br></span></span><span style="font-size:13px;color:#455B6B;font-weight:700;"><span leaf="">节点信息占位</span></span><span style="font-size:10px;color:#B88922;margin-left:auto;"><span leaf="">CHECK</span></span></section>
    </section>
```

### 5. 媒体与收束

#### 单图展示

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:14px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);text-align:center;">
      <span leaf=""><img src="https://placehold.orence.net/1200x720/DBEAFE/2563EB?text=IMAGE+PLACEHOLDER" alt="单图占位" width="600" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:12px;"></span>
    </section>
```

#### 带图注图片

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:14px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);text-align:center;">
      <span leaf=""><img src="https://placehold.orence.net/1200x720/E0F2FE/0891B2?text=FIGURE+PLACEHOLDER" alt="图片说明占位" width="600" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:12px;"></span>
      <p style="font-size:11px;color:#8493A0;margin:9px 0 0;line-height:1.6;"><span leaf="">图片说明文字占位</span></p>
    </section>
```

#### 视频静态占位

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:16px;padding:12px;box-sizing:border-box;border:2px solid #3F73B9;box-shadow:0 4px 12px rgba(63,115,185,0.10);">
      <section style="display:flex;align-items:center;margin-bottom:10px;"><span style="width:8px;height:8px;background:#82B6D3;border-radius:50%;margin-right:8px;"><span leaf=""><br></span></span><span style="font-size:11px;color:#3F73B9;font-weight:700;letter-spacing:1px;"><span leaf="">VIDEO PLACEHOLDER</span></span><span style="height:1px;background:#DCEAF5;flex:1;margin-left:10px;"><span leaf=""><br></span></span></section>
      <span leaf=""><img src="https://placehold.orence.net/1200x675/EAF3FA/3F73B9?text=VIDEO+PLACEHOLDER" alt="视频占位" width="600" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:10px;"></span>
    </section>
```

#### 常见问题

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:14px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <p style="font-size:14px;color:#34495A;font-weight:800;margin:0 0 8px;"><span style="color:#3F73B9;margin-right:7px;"><span leaf="">Q</span></span><span leaf="">问题标题占位？</span></p>
      <p style="font-size:13px;color:#617484;line-height:1.8;margin:0;padding-left:22px;"><span leaf="">回答说明文字占位，用于解释边界、条件与建议。</span></p>
    </section>
```

#### 作者信息

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:14px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);border-left:4px solid #3F73B9;">
      <p style="font-size:15px;color:#34495A;font-weight:800;margin:0 0 6px;"><span leaf="">{{作者名}}</span></p>
      <p style="font-size:13px;color:#6F8291;line-height:1.7;margin:0;"><span leaf="">{{一句话简介，如：持续记录 AI 观察与实践}}</span></p>
    </section>
```

#### 延伸阅读

```html
<section style="margin:0 0 18px;background:#FFFFFF;border-radius:14px;padding:18px 20px;box-sizing:border-box;box-shadow:0 3px 14px rgba(69,91,107,0.06);">
      <section style="border-bottom:1px solid #E4EAED;padding-bottom:10px;margin-bottom:10px;"><p style="font-size:13px;color:#3F73B9;font-weight:700;margin:0 0 3px;"><span leaf="">相关阅读标题占位一</span></p><p style="font-size:11px;color:#8493A0;margin:0;"><span leaf="">主题标签 · 内容类型</span></p></section>
      <section><p style="font-size:13px;color:#3F73B9;font-weight:700;margin:0 0 3px;"><span leaf="">相关阅读标题占位二</span></p><p style="font-size:11px;color:#8493A0;margin:0;"><span leaf="">主题标签 · 内容类型</span></p></section>
    </section>
```

#### 行动引导卡

```html
<section style="margin:0 0 18px;background:#5688C5;border-radius:16px;padding:22px 20px;text-align:center;box-sizing:border-box;box-shadow:0 8px 22px rgba(63,115,185,0.20);">
      <p style="font-size:18px;color:#FFFFFF;font-weight:900;margin:0 0 7px;"><span leaf="">下一步行动标题占位</span></p>
      <p style="font-size:13px;color:rgba(255,255,255,0.82);line-height:1.7;margin:0 0 14px;"><span leaf="">行动说明与参与方式占位。</span></p>
      <span style="display:inline-block;background:#FFFFFF;color:#3F73B9;font-size:12px;font-weight:800;padding:8px 15px;border-radius:9px;"><span leaf="">按钮文案占位</span></span>
    </section>
```

#### 结尾总结区

```html
<section style="margin:0;background:#F7FAFC;border:1px solid #DCEAF5;border-radius:16px;padding:24px 22px;text-align:center;box-sizing:border-box;box-shadow:0 4px 16px rgba(69,91,107,0.07);">
      <p style="font-size:18px;color:#34495A;font-weight:900;margin:0 0 8px;"><span leaf="">结尾总结标题占位</span></p>
      <p style="font-size:13px;color:#6F8291;line-height:1.8;margin:0;"><span leaf="">用一段克制、清晰的文字收束全文，并把重点重新交还给读者。</span></p>
      <span style="display:block;width:44px;height:3px;background:#82B6D3;border-radius:2px;margin:16px auto 0;"><span leaf=""><br></span></span>
    </section>
```

## 完整文章模板骨架

默认装配顺序如下，未出现的语义组件直接跳过：

1. 全局容器。
2. 「杂志快讯封面·无图」；文章有真实封面图时可改用预览源中的有图变体。
3. 「横向索引目录」，精选前三个核心章节。
4. 开头金句用「蓝黄金句卡」。
5. 每个 `##` 依次使用「编号章节标题」，编号为 `01 / 02 / 03…`。
6. 每章内部按「正文段落 → 奶油黄小节标题 → 步骤/提示/流程/列表/数据/媒体」装配。
7. 结尾依次使用「作者信息 → 行动引导卡 → 结尾总结区」；作者区只保留一次。

全篇视觉节奏：白底正文为主，蓝色锚点全文不超过 5 处；正文每段用浅蓝线标记 1–3 个关键词；奶油黄仅用于金句、小节标题和少量注意信息。

## 文章类型 → 组件组合配方

| 文章类型 | 核心组件 | 点缀组件 |
|---|---|---|
| AI 教程 / 操作指南 | 封面、目录、编号章节、步骤标签、柔灰代码块、数字编号列表 | 实践提示、检查清单、进度状态条 |
| 工具盘点 / 模型测评 | 封面、目录、胶囊列表、数据表格、蓝色信息框 | 指标摘要卡、成功卡、延伸阅读 |
| 观点 / 深度分析 | 封面、蓝黄金句卡、编号章节、正文段落 | 暖黄注意卡、节点时间线、结尾总结区 |
| 数据复盘 / 报告 | 封面、指标摘要卡、数据表格、进度状态条、系统状态面板 | 黄色警告框、时间线、行动引导卡 |
| 案例实战 / 方法论 | 封面、目录、三步流程卡、步骤标签、编号列表 | 提示词短块、单行命令、检查清单 |
| AI 新闻 / 模型观察 | 封面、目录、蓝色信息框、节点时间线 | 状态面板、延伸阅读、结尾总结区 |

## Markdown → AI 科技蓝排版映射规则

| Markdown / 语义 | 组件或样式 |
|---|---|
| `# 标题` | 杂志快讯封面·无图 |
| 开头 `> 引言` | 蓝黄金句卡 |
| `## 章节` | 编号章节标题，顺序生成 `01 / 02 / 03…` |
| `### 小节` | 奶油黄小节标题；操作步骤用步骤标签 |
| 普通段落 | 正文段落；每段主动标记 1–3 个关键词 |
| `**加粗**` | 主色 `#3F73B9` 加粗 |
| `==高亮==` | 浅奶油黄 `#FFF0B5` 背景 |
| `<u>` / `++文字++` | `border-bottom:2px solid #C2D8EA;font-weight:600;` |
| 行内代码 | 中性浅灰底 + 主色文字；优先参考通用增量库 1c |
| 围栏代码块 | 柔灰代码块；复杂多行代码优先参考通用增量库 1a / 1b |
| `- 列表` | 圆点无序列表或胶囊列表 |
| `1. 列表` | 数字编号列表 |
| Markdown 表格 | 数据表格 |
| 提示 / 注意 / 风险 | 蓝色实践提示 / 暖黄注意卡 / 黄色警告框 |
| `![](图片)` | 单图展示；有 alt 时使用带图注图片 |
| FAQ | 常见问题 |
| 作者与互动 | 作者信息 + 行动引导卡，全文末尾只出现一次 |
