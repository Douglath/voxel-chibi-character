# v5 八表情与普通眨眼

复用随母版交付的 `expressions.mjs`。这是用户认可的脸部模板，不从新角色插画重新猜眼型。默认提供 Normal、Happy、Angry、Crying、Scared、Confused、Hungry、Closed；初始 Normal，并自动眨眼。新角色默认只改虹膜基色；用户要求不同表情时选择预设或局部修改模板，不顺带改身体、头发、服装和附加动态。

## 固定与可改部分

- `templates` 固定逐行像素、左右眼位置、眼线与高光；`defaults` 固定各表情默认可选层组合。换色不得修改这些布局。
- `model.mjs` 的 `palette.iris` 是角色虹膜基色；构建时自动派生上暗、中间原色、下微亮。`irisPalette` 使用 RGB 偏移上层 (-13,-12,-12)、下层 (+10,+10,+9)，截断至有效范围。v5 原色 #788c86 得到 #6b807a / #788c86 / #82968f。小眼型只呈现可见区域，不强塞三行。
- `skin`、`dark`、`eyeWhite`、`eyeHighlight` 从角色语义调色板独立读取。服装换色不得污染眼白或高光。预览换色只是运行时试色；持久化应改 `model.mjs` 并重建静态与骨骼 GLB。
- `blush`、`tears`、`sweat`、`anger`、`spark`、`drool` 独立开关。怒气、汗滴、饥饿闪光位于正面观察者右上方的头发区域，彩色图案占位宽 5.25 个母版像素，带 0.2625 像素深色描边；眼泪、腮红和口水在脸部。三种头顶符号共用位置，默认不同时启用。

## 眨眼定稿

Normal 默认约每 3–5 秒眨眼一次，序列 215 ms：半闭 55 ms → 闭合 80 ms → 半闭 80 ms → 恢复睁眼。`blinkTemplates` 单独定义，不复用 Closed。

半闭只让上眼皮下降，虹膜底边保持原位置，高光被遮挡，不能随眼皮下移。闭合是一像素厚、与原上眼线同宽的平直线，位置低于 Closed；不加上翘两端或 U 形弧度，避免短暂出现笑眼。用户已经否定过细线、加粗上翘弧线及高光下移的过渡。

眨眼只在 Normal 生效；切换其他表情立即复位。随角色暂停而冻结。保留独立闭合眼型预览按钮，便于检视，但默认应正常自动播放。

## 接入与复用边界

```js
import {palette} from './model.mjs';
import {attachExpressions} from './expressions.mjs';
const expressions = attachExpressions(rig, palette);
expressions.set('Normal');
// 在未暂停的渲染循环内：
expressions.update(dt);
expressions.set('Angry');
expressions.setColor('#ae608b');
expressions.toggle('anger', false);
```

随包 `rig-viewer.mjs` 已接入 `setupExpressionUI(rig,palette)`、自动眨眼、试色与独立层控件。脚手架自动复制代码及 `test-expressions.mjs`，无需每个角色重写。

模板依赖 v5 脸部体素尺度 0.085、正面 +Z、`Face` 网格和 `head` 骨骼。保持同一脸部母版即可换色/切换表情。其他头型、变更眼部坐标或不同网格结构须适配挂点与肤色封面并重新目视验证；不能声称已自动适配任意角色。传入的调色板必须与已加载 GLB 一致，Normal 才能正确复用原 Face。

## 成本与交付

复用原顶点色材质，无新增纹理、骨骼或物理粒子。常驻 9 个新增网格对象（眼睛、6 符号、2 眨眼缓存）及原 Face 的肤色副本。几何只在切换表情/试色时重建；眨眼每帧仅更新计时器，阶段变化时切换缓存网格。

默认预设新增可见三角面 / draw calls：Normal 0/0，Happy 24/2，Angry 112/2，Crying 24/1，Scared 108/2，Confused 112/1，Hungry 96/3，Closed 16/1。Normal 眨眼半闭 32/1、闭合 12/1。试色后的 Normal/Crying 额外显示眼睛网格（64 面/1 call）。常驻新增 560–752 顶点、280–376 面，另有 60 顶点/30 面的肤色副本。按实际产物重新统计，不把一个材质说成一次绘制。

运行 `node character/test-expressions.mjs`（包内直接运行 `node test-expressions.mjs`），验证实际 GLB、换色不改布局、原几何保留、独立层、头骨挂接及 30/60/144 FPS 眨眼缓存。再在浏览器检查动画及符号无遮挡。

GLB 仍仅含母版几何、骨架和基础动画；表情切换与眨眼由运行时代码提供，不能宣传下载 GLB 即包含表情系统。交付代码与可运行预览。其他引擎、任意头型适配和多角色性能未验证。
