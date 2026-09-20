# Silver Wolf Voxel Chibi Skill

以当前银灰狼耳少女为唯一基准的第二版体素角色 skill。保留调用名称 `voxel-chibi-character`，同时包含配套 `character-sheet-to-voxel` 入口。

旧版及此前规则已保存于 https://github.com/Douglath/voxel-chibi-character-skill ，冻结点 31d6e56。新版独立维护，不覆盖旧仓库历史。

当前基准：3182 三角面、6792 顶点、43 骨骼、一个顶点色材质。源码、GLB、实际多视图、附件与掉落范例随包提供。头发规则来自实际迭代：宽发片、鬓发轮廓分离、后发低对比宽色阶；不把回退的鬓发提亮或复杂侧发方案变成默认。

安装：将 skills 下两个目录复制到本地 Codex skills 目录。使用原调用名称。Node.js 与 Three.js 0.180.0；仓库根安装依赖后运行 `node scripts/verify-examples.mjs`。脚手架复制可编辑母版，必须按新参考改造型、附件、绑定与测试，并非自动识图建模服务。

GLB含基础动画，弹簧和重力依赖运行时代码。完整网格自碰撞、自动LOD、多角色性能、其他引擎物理迁移尚未验证。不附用户原始插画，不额外授予角色IP权利。
