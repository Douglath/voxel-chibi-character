---
name: voxel-chibi-character
description: 根据角色参考制作或迭代像素体素 Q 版模型，交付 Three.js 源码、GLB、骨架、八表情及自然眨眼，默认带轻量附加动态。只执行建模；不用于出图或严格复制平滑曲面。
---

# 体素 Q 版角色

角色参考决定身份、发型、服装裁片、配色与饰件；[银灰狼耳少女母版](assets/silver-wolf-refined-dynamics/) 提供像素几何、基础素体比例、骨架与渲染约定。不要将母版服装、狼耳或配色带入新角色。用户明确纠正优先于生成设定图；像素局部形状、部件整体姿态与动态形变分别处理。

## 输入与范围

- 本入口只建模。默认读取已完成的四视图；仅有原始插画时先提示使用独立 `chibi-character-sheet` 出图包。用户明确直接按现图建模或禁止出图时可继续，记录必要推定，不因缺少图像工具自行跳过准备。
- 查看真实图像。有完整或简版设计交接时沿用身份、排除项、推定与评审；仅有合格四视图也能自行提取。重大结构矛盾或 needs_revision 先解决，用户已接受的偏差记录范围。由一体化流程调用时复用其输入评审，无变更不重复预检。
- 若目标是严格复制平滑曲面或原图头身比例，先说明与体素母版的冲突并确定目标；普通像素任务不新增风格确认。

**独立过滤道具：**默认只制作角色本体、服装及穿戴饰件，不生成手持物、武器、工具或场景物件；图中存在或属于标志物不构成许可。只有用户明确要求的道具才保留。不得将排除物改挂腰背或为其补造带子、底座、支架；武器工具挂在身上仍属道具，发饰、扣具、身份牌及原有穿戴包袋不一概删除。此规则不依赖出图阶段已清理。

在 character-spec.json 的 scopeReview 中简要记录 kept、excluded、explicitlyRequestedProps 及依据；沿用有效记录，只在范围改变时更新。被排除项不进入几何、绑定、动态或预览，最终按实际 GLB 复核。

## 制作与迭代

1. 开工时查看角色图与母版 rig-front/side/three.png，读取 character-baseline.mjs 的实际尺寸。记录少量身份锚点和部件关系，执行 [造型与绑定](references/modeling.md)。输入及源码保留可恢复版本，不覆盖唯一母版。
2. 在未存在的新目录运行脚手架；若 design 已占角色目录，使用其新的 model 子目录，不删除旧目录重跑。

   ```text
   node <skill>/scripts/scaffold.mjs <new-project> <character-id> <角色名称> <端口>
   ```

   脚手架只复制可编辑母版和 Three.js，不识图、不定制角色。按需修改 model.mjs、rig-export.mjs、hair-physics.mjs 与 character-spec.json；删除/改名部件同步绑定、动态与相关测试。配色后处理适配见 modeling.md，不只改基础色而保留银灰覆盖规则。
3. **先稳定外形。**每批相关修改后只检查改动处、必要视角及基本构建/显示；几何和绑定同步保持可用。此时不跑整套动作、多帧率、掉落或碰撞扫描，不反复生成全套截图和报告。
4. **再适配功能。**默认基础动画与轻量附加动态，明确静态要求才省略；模式与预算见 [动态选择](references/dynamics.md)。复用 [v5 表情与普通眨眼](references/expressions.md)，默认只替换虹膜基色。针对稳定后的改动执行相关专项。
5. **交付前集中验收。**按 [检查调度与交付](references/validation.md) 核对最终 GLB 和实际预览；验收后小修只重测受影响项。一次性交付请求自主完成这些阶段，不为阶段切换新增用户确认；外观迭代稿可标待验收，不冒充成品。

`npm run build` 只导出模型，`npm start` 打开预览；构建不等于要求全套测试。最终交付源码、GLB、基础片段、实际运行的表情/附加动态、预览及简短验证结果。GLB 基础动画与运行时弹簧分开说明，不能仅交 GLB 就声称动态完整。

## 按任务加载专题

| 涉及内容 | 读取位置 |
|---|---|
| 头发组织与配色 | [hair.md](references/hair.md) |
| 兽耳、尾巴、绑带与飘带 | [ears-tails-straps.md](references/ears-tails-straps.md) |
| 确定保留的组合配件 | [accessories.md](references/accessories.md) |
| 完整精修动态 | [refined-dynamics.md](references/refined-dynamics.md) |
| 精修或需要强扰动验证 | [drop-testing.md](references/drop-testing.md) |
| 云盘读取或离线 HTML 交付 | [portable-use.md](references/portable-use.md) |
| 用户要求多模型对照或负载测试 | [model-lab.md](references/model-lab.md) |

专题说明构造和验收标准；**何时检查、复测哪些项目统一由 validation.md 决定**，不因打开专题就每轮执行全部检查。

## 控制开销

只读当前任务相关章节、源码段和失败日志；已读且未变内容复用，不每轮重读全部文件。图片和 GLB 使用相应工具查看/解析，不把二进制原始内容当文本读入。批量完成相关小改后再预览；成功只返回短汇总，失败才展开日志，最终版本再集中统计与报告。

优先复用 Node/Three.js 工具并局部适配，不重写渲染器或默认引入付费服务、IK、完整布料碰撞、成品动作库、多模型网站。token 仅报告真实计量，不从耗时或面数估算。
