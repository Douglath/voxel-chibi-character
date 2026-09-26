# ak-model-upload

方舟资料库专用可选流程：筛选角色 → 复用或准备四视图 → 一图、一个 Drive 建模技能链接和短 prompt → 保存原会话与批次交接。此包不下载模型或接入 Playground。

## 安装与配置

解压独立 ZIP，将整个 `ak-model-upload` 目录复制到 Codex skills 目录。已有安装先备份；升级保留本地 `settings.local.json`。运行环境需要已登录的 ChatGPT 浏览器及可用的建模模型；缺图时才需要图像工具与 `chibi-character-sheet`。

可在技能目录自行创建 `settings.local.json`，字段为 `workspace`（方舟资料库根目录）、`skill_folder_url`（已确认的建模技能 Drive 链接）。本包不包含账号、令牌、个人路径或批次记录；用户显式指定优先于配置。

## 依赖与限制

- 资料库需提供 README、数据契约、角色/形态记录及批次交接目录；任意数据库格式不会自动转换。按准确角色形态筛选。
- 本包包含 `templates/web-model-request.md`。渲染和浏览器辅助脚本是原资料库的可选工具，先确认真实存在，缺失时按模板和当前浏览器能力操作。
- GPT-6 Pro 是此工作流的网页目标；实际可用性由账号和页面决定。本包不提供模型服务、登录或额度。
- 确认提交后复用原会话；发送不明先恢复现场，不重复付出生成成本。上传成功不代表模型质量已通过。

后续分别使用 `ak-model-download` 下载、`ak-model-batch-import` 在用户授权范围内入库。通用 `voxel-chibi-character` 包不依赖这些辅助技能。
