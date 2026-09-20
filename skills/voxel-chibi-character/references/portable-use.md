# 同一 skill：本地、Google Drive 与离线 HTML

只维护 `voxel-chibi-character` 的一份规则和母版源码。Google Drive 是这份文件夹的存储/读取入口，不另建网页版 skill 或改写一套模型。

## 从云盘使用

让会话先读取 `SKILL.md`，再按任务读取相关 `references`。要执行建模，还须取得 `scripts`、`assets` 的实际文件，并在可写工作目录保留相对结构。只有搜索摘要或单独 SKILL.md 不足以运行。不要将 `assets` 中的 GLB、PNG、JS 或依赖转为 Google Docs。

如果连接器不能下载完整目录/二进制，可由用户提供完整 skill ZIP，再解包使用。读取云盘不等于安装 skill，也不自动获得 Node.js、Python 或 WebGL；先检查当次会话的执行能力，不承诺其他环境未经验证的能力。不要使用用户电脑的绝对盘符。

## 统一构建流程

```text
node <skill>/scripts/scaffold.mjs <new-project> character 角色名称 4192
node <new-project>/character/export.mjs
node <new-project>/character/rig-export.mjs
node <new-project>/character/test-expressions.mjs
python <new-project>/scripts/build_html.py --project <new-project> --output <new-project>/character.html --title 角色名称
```

脚手架将母版、配件支持、表情及眨眼复制到 `character/`，并从 `assets/dependencies/three` 复制所需的 Three.js 0.180.0 模块和 MIT 许可到项目 `node_modules/three`，无需网络安装。Python 3.9+ 负责 HTML 打包；新模型构建仍需 Node.js。随包依赖仅覆盖该工作流，新加未提供的 Three.js addon 时再安装完整同版本依赖。

构建前按新角色修改几何、调色板与 `character-spec.json`。配件组合仍走同一个 spec.accessories 接口；没有独立网页版构建器。已有项目不覆盖，使用新的输出目录。

`build_html.py` 从该工程的 character-spec.json 读取 id，内嵌对应静态/骨骼 GLB、Three.js、实际动态模块与表情控件。生成文件没有 CDN、本地服务或 `/evidence` 依赖，可下载后用现代浏览器打开。GLB 下载仍不包含实时弹簧和表情切换系统，须随源码交付。

## 验证

- 对实际 GLB 运行变更相关测试；不能借用母版报告。
- 独立 HTML 查看视角、八表情、眨眼、换色、跑动开始/停止、暂停恢复、附加动态和适用配件。
- 检查 GLB 与报告下载。确认没有外部模块/模型请求。Three.js 许可必须保留。
- 完整目录/ZIP 应保留 `SKILL.md`、所有引用资源与脚本；生成项目、临时日志及用户参考不放入通用 skill。
- 本地浏览器验证不等于用户网页版账号的云盘读取、执行或内嵌预览已验证；按实际会话能力报告。
