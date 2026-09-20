# Silver Wolf Voxel Chibi Skill

以当前银灰狼耳少女为唯一基准的第二版体素角色 skill。保留调用名称 `voxel-chibi-character`，同时包含配套 `character-sheet-to-voxel` 入口。

## 已确认的模型与规则

本版收录用户确认的 v5：服装内部的克制色块、头顶与四周连续接色、可读的宽发束，以及以原虹膜色为中间、上略暗下微亮的眼睛层次。基础母版已经包含这些效果；具体色号与选面规则属于银灰范例，新角色按参考调整。

通用配件支持薄片、矩形开孔框、路径扁带、方截面绳和开口壳体。身份牌、带尾、扣具、拉片、挂包及设备按承载面、挂点、路径和运动方式组合。读取 [图片到模型入口](skills/character-sheet-to-voxel/SKILL.md) 或 [建模入口](skills/voxel-chibi-character/SKILL.md)，按需加载 [配件规则与输入格式](skills/voxel-chibi-character/references/accessories.md)。新建独立工程，在 `character-spec.json.accessories` 填写规格；默认不强加整套装备。

可复用的 [组合样件定义](skills/voxel-chibi-character/assets/accessory-examples/technical-kit.mjs) 展示短带胸卡、双端斜跨带与带尾、长拉片、腿带挂包及独立腕部设备。[确认版 GLB](skills/voxel-chibi-character/assets/accessory-examples/technical-kit-rigged.glb) 与 [重新生成对比](approved-version-verification.json) 保证范例可重建。这些构件仍需按新角色适配，不是自动识图或完整服装碰撞系统。运行以下检查会新建可编辑工程并输出 [配件验证报告](accessory-verification.json)：

```powershell
node --test skills/voxel-chibi-character/assets/accessory-kit/test-accessory-kit.mjs
node scripts/verify-accessories.mjs
node scripts/verify-examples.mjs
```

生成工程路径见配件报告。在工程运行 `node character/server.mjs` 后可查看；端口占用时先换端口，已有 localhost 页面不代表刚生成的工程。测试工程复用本仓库的 Three.js 依赖。基础 GLB 动画与运行时配件弹簧分开交付。

## 已认可的表情模板

默认复用 [v5 八表情与自然眨眼](skills/voxel-chibi-character/references/expressions.md)。新角色保持眼型、像素排列、眼线与高光，仅改 palette.iris 自动生成上暗 / 原色 / 下微亮色阶。Normal 的眨眼采用上眼皮下降、遮住高光、平直一像素粗闭合线，避免笑眼。腮红、眼泪、汗滴、怒气、饥饿闪光和口水独立开关；右上符号已放大并描边。

统一脚手架和离线 HTML 均包含生产代码与控件。GLB 基础资产保持不变，表情/眨眼依赖 expressions.mjs 运行时。原身体、头发、服装与附加动态保留；开销另计。

## 统一 skill 与跨环境使用

本地和网页版均使用 [同一个 skill](skills/voxel-chibi-character/SKILL.md)，规则、模型、表情、动态只维护一份。[完整 skill ZIP](dist/voxel-chibi-character.zip) 可保存到 Google Drive；保留整个文件夹结构，由会话读取 SKILL.md 并按需获取引用文档、脚本和资源。云盘账号中的实际读取和执行尚未验证。

[跨环境说明](skills/voxel-chibi-character/references/portable-use.md) · [统一脚手架](skills/voxel-chibi-character/scripts/scaffold.mjs) · [离线 HTML 打包](skills/voxel-chibi-character/scripts/build_html.py)。脚手架自带工作流所需 Three.js；生成项目内运行 python scripts/build_html.py --project . --output character.html，即可输出内嵌模型、动态、表情及依赖的 HTML。

独立网页版 skill、插件清单和重复安装包已退役；历史可从 Git 提交 0ba7424 恢复。需要更新主 skill ZIP 时运行 python scripts/package-skill.py。

## 快速入口

- **开始使用**：[Skill 入口](skills/voxel-chibi-character/SKILL.md) · [图片到模型](skills/character-sheet-to-voxel/SKILL.md) · [完整精修动态](skills/character-sheet-to-voxel/references/refined-dynamics.md)
- **造型与配件**：[造型与绑定](skills/voxel-chibi-character/references/modeling.md) · [头发与配色](skills/voxel-chibi-character/references/hair.md) · [耳朵、尾巴与飘带](skills/voxel-chibi-character/references/ears-tails-straps.md)
- **动态与验收**：[动态强度与成本](skills/voxel-chibi-character/references/dynamics.md) · [掉落测试](skills/voxel-chibi-character/references/drop-testing.md) · [验证与交付](skills/voxel-chibi-character/references/validation.md) · [多模型试验室](skills/voxel-chibi-character/references/model-lab.md)
- **基准模型**：[源码与完整资源](skills/voxel-chibi-character/assets/silver-wolf-refined-dynamics/) · [骨骼 GLB](skills/voxel-chibi-character/assets/silver-wolf-refined-dynamics/silver-wolf-rigged.glb) · [静态 GLB](skills/voxel-chibi-character/assets/silver-wolf-refined-dynamics/silver-wolf.glb) · [正面](skills/voxel-chibi-character/assets/silver-wolf-refined-dynamics/rig-front.png) · [侧面](skills/voxel-chibi-character/assets/silver-wolf-refined-dynamics/rig-side.png) · [背面](skills/voxel-chibi-character/assets/silver-wolf-refined-dynamics/rig-back.png) · [斜视](skills/voxel-chibi-character/assets/silver-wolf-refined-dynamics/rig-three.png)
- **工程工具**：[角色脚手架](skills/voxel-chibi-character/scripts/scaffold.mjs) · [多模型脚手架](skills/voxel-chibi-character/scripts/scaffold-lab.mjs) · [回归检查脚本](scripts/verify-examples.mjs) · [验证报告](verification.json)

旧版及此前规则已保存于 https://github.com/Douglath/voxel-chibi-character-skill ，冻结点 31d6e56。新版独立维护，不覆盖旧仓库历史。

基础母版：3186 三角面、6800 顶点、43 骨骼、38 网格；完整配件范例：4026 三角面、8480 顶点、46 骨骼、55 网格。两者均为一个顶点色材质、无图像贴图。头发和服装重着色没有新增拓扑，虹膜色界较旧母版增加 4 三角面、8 顶点；这些是当前范例统计，不能代替其他角色的实测。

安装：将 skills 下两个目录复制到本地 Codex skills 目录。使用原调用名称。Node.js 与 Three.js 0.180.0；仓库根安装依赖后运行 `node scripts/verify-examples.mjs`。脚手架复制可编辑母版，必须按新参考改造型、附件、绑定与测试，并非自动识图建模服务。

GLB含基础动画，弹簧和重力依赖运行时代码。完整网格自碰撞、自动LOD、多角色性能、其他引擎物理迁移尚未验证。不附用户原始插画，不额外授予角色IP权利。
