# ak-model-batch-import

面向特定本地方舟资料库与 Playground 接口的可选导入流程：只读盘点 → 按准确形态匹配 → 风格分级与必要修订 → 集成原动态 → 浏览器验收 → 回写已建模状态与精确链接。不是任意数据库或任意网页的通用导入器。

## 安装与配置

解压 ZIP，将 `ak-model-batch-import` 目录复制到 Codex skills 目录。升级保留本机 `settings.local.json`；字段为 `playground_root`（门户工程根）和 `database_dir`（含 specialty 数据库的目录）。用户显式指定优先。需要 Python、模型编辑/导出工具和实际浏览器验证能力；修订建模时可复用 `voxel-chibi-character`。

接口说明位于 [project-integration.md](references/project-integration.md)。先确认项目实际 API、数据库字段和服务根，不能把说明当作自动安装服务器。四张手部标尺随包提供，不依赖其他技能的绝对路径。

## 使用与限制

`python -X utf8 scripts/scan_batch.py <批次目录或文件> --output <新盘点文件>` 只读盘点，不执行 HTML、不解压、不写数据库。导入、修订和浏览器操作由代理按 SKILL.md 完成；该脚本不自动判断外观。

轻度手保留；临界手是否修取决于手臂是否异常；超过临界必须修。配件缺面独立验收。保存原 ZIP/source，修订写副本。下载成功、脚本通过与用户外观认可分别记录；身份不明不猜异格，失败项不标已建模。

不附账号、个人目录、下载批次或角色交付。通用图生模型包不强制依赖此包。

## 许可与来源

本包有权许可的通用软件/指令采用 [Apache-2.0](LICENSE)，允许商用；角色资产及第三方材料另论。作者 [@Douglath](https://space.bilibili.com/15438401)。详见 [许可范围](LICENSING.md)、[NOTICE](NOTICE) 与 [中英署名模板](CREDITS.md)。独立输出工具 credit 为自愿。
