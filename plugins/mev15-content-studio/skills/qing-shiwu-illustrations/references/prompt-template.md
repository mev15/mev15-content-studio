# 生图提示词模板

每张图单独生成。根据正文内容替换变量，不要把多张图拼在一起。

```text
Generate one standalone 16:9 horizontal Chinese article illustration.

Visual DNA:
Pure white background. Minimalist black hand-drawn line art. Slightly wobbly pen lines. Lots of empty white space. Sparse red/orange/blue handwritten Chinese annotations. Clean absurd product-sketch feeling. No gradients, no shadows, no paper texture, no complex background, no commercial vector style, no PPT infographic look, no cute mascot poster, no children's illustration, no realistic UI.

Recurring IP character required:
Use the attached `qing-shiwu-avatar.jpg` as a mandatory identity reference for 青十五. Reproduce the same pure-white, oversized rounded head-and-upper-torso silhouette with a slightly uneven black hand-drawn outline, two asymmetrically placed solid-black dot eyes, two short slanted eyebrows, and thin line arms. Show upper body only: the lower edge must leave the canvas or be hidden behind a desk, machine, or core object. Never draw a waist, lower body, legs, feet, or a full standing figure. Preserve the same restrained, focused, deadpan expression. The fruit held in the reference avatar is not part of the character identity; omit it unless the current theme specifically needs it. 青十五 must perform the core conceptual action with the arms, gaze, and upper-body pose, not decorate the scene.

Theme:
{正文配图主题}

Structure type:
{结构类型：Workflow / 系统局部 / 前后对比 / 角色状态 / 概念隐喻 / 方法分层 / 地图路线 / 小漫画分镜}

Core idea:
{这张图要表达的核心意思}

Composition:
{具体画面：青十五从哪里露出上半身、手臂正在做什么、主要物件是什么、信息如何流动}

Suggested elements:
{元素1} / {元素2} / {元素3} / {元素4}

Chinese handwritten labels:
{标注词1} / {标注词2} / {标注词3} / {标注词4} / {可选标注词5}

Color use:
Black for main line art, labels, and 青十五's outline, eyes, eyebrows, and arms. Keep 青十五's body pure white. Orange for main flow/path/arrows. Red only for key warnings/problems/results. Blue only for secondary notes or feedback/system state.

Constraints:
One image explains only one core structure. Keep the main subject around 40%-60% of the canvas. Preserve at least 35% blank white space. Use at most 5-8 short handwritten Chinese labels. Do not write a title in the top-left corner. Do not write the structure type on the image. Do not make it a formal diagram, course slide, or dense explainer. Do not invent legs or a full body for 青十五. Do not copy prior examples or reuse known case compositions unless explicitly requested; invent a fresh visual metaphor for this specific article. It should be clear but not instructional, interesting but not childish, strange but clean.
```

## 图像编辑提示

去掉左上角标题：

```text
Edit the provided image. Remove only the handwritten title "{要删除的文字}" and its underline from the top-left corner. Fill that area with the same clean white background, matching the surrounding blank paper. Preserve everything else exactly: characters, labels, paths, line style, composition, aspect ratio, and image quality. Do not add any new text or objects.
```

增强怪诞感：

```text
Regenerate this illustration with the same core meaning and simple layout. Use the attached `qing-shiwu-avatar.jpg` as the mandatory identity reference. Make 青十五 more central to the conceptual action, using thin arms, gaze, and an upper-body pose to do the strange work that explains the idea. Show upper body only, with no waist, legs, feet, or full standing figure. Keep it clean, sparse, hand-drawn, restrained, and not mascot-like.
```
