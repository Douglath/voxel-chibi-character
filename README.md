# Silver Wolf Voxel Chibi Skill

以当前银灰狼耳少女为唯一基准的第二版体素角色 skill。保留调用名称 `voxel-chibi-character`，同时包含配套 `character-sheet-to-voxel` 入口。

## 网页版适配包

[使用说明](web/voxel-character-web/README.md) · [网页版 Skill](web/voxel-character-web/skills/voxel-character-web/SKILL.md) · [Skill 上传包](web/dist/voxel-character-web-skill.zip) · [完整插件包](web/dist/voxel-character-web-plugin.zip) · [自包含 HTML](web/dist/character-preview.html) · [GLB](web/dist/character-rigged.glb) · [适配验证](web/verification.json)

HTML 中已内嵌 Three.js、模型与动效，无 CDN 和本地服务依赖。GitHub 上请下载 HTML 后打开。独立网页验证通过；网页版 ChatGPT 的安装和内嵌预览取决于账号能力，尚未在用户账号实测。

## 快速入口

- **开始使用**：[Skill 入口](skills/voxel-chibi-character/SKILL.md) · [图片到模型](skills/character-sheet-to-voxel/SKILL.md) · [完整精修动态](skills/character-sheet-to-voxel/references/refined-dynamics.md)
- **造型与配件**：[造型与绑定](skills/voxel-chibi-character/references/modeling.md) · [头发与配色](skills/voxel-chibi-character/references/hair.md) · [耳朵、尾巴与飘带](skills/voxel-chibi-character/references/ears-tails-straps.md)
- **动态与验收**：[动态强度与成本](skills/voxel-chibi-character/references/dynamics.md) · [掉落测试](skills/voxel-chibi-character/references/drop-testing.md) · [验证与交付](skills/voxel-chibi-character/references/validation.md) · [多模型试验室](skills/voxel-chibi-character/references/model-lab.md)
- **基准模型**：[源码与完整资源](skills/voxel-chibi-character/assets/silver-wolf-refined-dynamics/) · [骨骼 GLB](skills/voxel-chibi-character/assets/silver-wolf-refined-dynamics/silver-wolf-rigged.glb) · [静态 GLB](skills/voxel-chibi-character/assets/silver-wolf-refined-dynamics/silver-wolf.glb) · [正面](skills/voxel-chibi-character/assets/silver-wolf-refined-dynamics/rig-front.png) · [侧面](skills/voxel-chibi-character/assets/silver-wolf-refined-dynamics/rig-side.png) · [背面](skills/voxel-chibi-character/assets/silver-wolf-refined-dynamics/rig-back.png) · [斜视](skills/voxel-chibi-character/assets/silver-wolf-refined-dynamics/rig-three.png)
- **工程工具**：[角色脚手架](skills/voxel-chibi-character/scripts/scaffold.mjs) · [多模型脚手架](skills/voxel-chibi-character/scripts/scaffold-lab.mjs) · [回归检查脚本](scripts/verify-examples.mjs) · [验证报告](verification.json)

旧版及此前规则已保存于 https://github.com/Douglath/voxel-chibi-character-skill ，冻结点 31d6e56。新版独立维护，不覆盖旧仓库历史。

当前基准：3182 三角面、6792 顶点、43 骨骼、一个顶点色材质。源码、GLB、实际多视图、附件与掉落范例随包提供。头发规则来自实际迭代：宽发片、鬓发轮廓分离、后发低对比宽色阶；不把回退的鬓发提亮或复杂侧发方案变成默认。

安装：将 skills 下两个目录复制到本地 Codex skills 目录。使用原调用名称。Node.js 与 Three.js 0.180.0；仓库根安装依赖后运行 `node scripts/verify-examples.mjs`。脚手架复制可编辑母版，必须按新参考改造型、附件、绑定与测试，并非自动识图建模服务。

GLB含基础动画，弹簧和重力依赖运行时代码。完整网格自碰撞、自动LOD、多角色性能、其他引擎物理迁移尚未验证。不附用户原始插画，不额外授予角色IP权利。
