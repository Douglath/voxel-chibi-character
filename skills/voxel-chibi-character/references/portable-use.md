# 云盘使用与离线 HTML

本地与网页端使用同源 skill。`chibi-character-sheet.zip` 只出图，`voxel-chibi-character.zip` 只建模；两个包分别包含本阶段资源。先出图时，将最终四视图及完整/简版交接提供给建模包；输入与道具范围遵循 [入口](../SKILL.md)，不另设网页端规则。

## 取得资源

先读 SKILL.md，再按任务读取专题。执行建模需取得 scripts、assets 实际文件，在可写目录保留相对结构；搜索摘要不够。连接器不能取全目录时使用完整 ZIP。PNG、GLB、JS 及依赖保持原文件，不转 Google Docs。

云盘只存储文件，不提供图像工具、Node.js、Python 或 WebGL。按当次环境能力执行，不套用用户电脑的绝对盘符。脚手架自带工作流所需 Three.js 0.180.0 与 MIT 许可；仅新增未提供的 addon 时才需补齐相同版本依赖。

## 构建与打包

先运行脚手架创建新的可编辑工程：

```text
node <skill>/scripts/scaffold.mjs <new-project> character 角色名称 4192
```

随后按参考修改几何、配色、绑定和 character-spec.json。脚手架仅复制母版，不能立即打包当成新角色。每批相关修改后按 [渐进检查](validation.md) 预览；稳定后导出并打包：

```text
node <new-project>/character/export.mjs
node <new-project>/character/rig-export.mjs
python <new-project>/scripts/build_html.py --project <new-project> --output <new-project>/character.html --title 角色名称
```

Python 3.9+ 负责打包，Node.js 负责模型构建。build_html.py 从 spec 读取角色 id，内嵌静态/骨骼 GLB、Three.js、实际动态和表情控件。无 CDN、本地服务或 /evidence 依赖；GLB 单独下载不含运行时弹簧和表情切换系统，仍须交付源码。

## 最终独立文件检查

仅在离线 HTML 成为交付物时，用最终文件完成 validation.md 的浏览器验收，并检查 GLB/报告下载、无外部模块/模型请求和 Three.js 许可。该结果可覆盖同版本相同功能的浏览器检查，不在服务器预览再重复一套。打包方式改变后复测加载/下载和受影响功能；普通外观迭代不重复打包。

ZIP 保留入口、引用资源和脚本，排除角色临时工程、用户参考及日志。本地验证不等于其他网页端账号已经成功读取、执行或内嵌预览，按实际证据报告。
