# ak-model-download

方舟批次的可选下载流程。读取用户提供的 `batch-handoff.json`，到原 ChatGPT 会话回收实际交付，保存原文件名和下载记录。只检查落盘与 ZIP 可读性，不建模、不作视觉验收、不标记已建模。

## 安装与配置

解压 ZIP，将 `ak-model-download` 目录复制到 Codex skills 目录。升级保留 `settings.local.json`；可用 `download_root` 指定下载根目录，默认当前用户 Downloads 下的 `Arknights-Models`。按 `<job_id>/<角色名或slug>/` 保存，已有历史文件不自动迁移。

## 依赖与限制

需要含真实会话链接的批次交接、已登录浏览器和本地写入能力。没有上传脚本、模型服务或数据库依赖。仍在生成、链接失效、缺附件时如实记录；默认检查一轮，只有用户明确要求时持续回收。同名不同内容另存，原件保留。

此技能可单独安装；后续入库须另外调用 `ak-model-batch-import`。通用建模包无需安装本包。
