# 项目与数据库接口（使用时核对当前源码）

默认 Playground：`<playground_root>`。默认数据库：`<database_dir>/database.json`。常用服务 `http://127.0.0.1:8765/`；先 GET `/api/info` 确认根目录。

## Playground

- `config/console.json` 管理显示名、tags、选择和设置；保留用户其他偏好。
- `models/<目录>/<文件>.html` 存交付；`portal_store.py` 解析 `library-data` 或 `model-data` 的内嵌 GLB。GLB 本身可能没有 JS 表情和动态，不能把 GLB 当成完整交付。
- GET `/api/catalog` 得到 assets/state/revision/errors；从首页 `portal-data` 取 token。POST `/api/import` 参数 `{name,content}`，content 为 base64；POST `/api/config` 为 `{state,revision}`。写操作使用 `X-Playground-Token`。当前实现和字段以 server.py 为准。
- 保存前重新读状态，版本冲突则合并目标项后重试，不覆盖并发编辑。不要把 form ID 等未知字段塞入有白名单的 config，将业务映射保存在批次清单和数据库链接文件。
- 现有条目备份后更新同一路径，保持 portal ID。新文件通过服务注册，确认实际产生的 ID。URL 使用 `/?model=<portal_model_id>`，实际打开验证不能只拼字符串。
- `physics-registry.mjs` 把模型 GLB SHA 映射至物理实现；几何改动后 SHA 会变，需要注册新 SHA 到原有角色 solver。保留源包中的作者动态逻辑，不能默认改成通用晃动。
- `expressions.mjs` / `profiles.json` / 记录中的 expression 布局负责表情；保留原布局和特殊口鼻位置。
- `python -X utf8 build.py` 生成 `dist/model-playground.html`。单角色 HTML 由此模板填 `library-data`，嵌入新 GLB、正确 physics 签名和 expression，`openSingle=true`，settings.physics=false，模型 physicsEnabled=false。校验原项目是否有专用构建流程再采用。
- 标签应为叠加 AND 过滤，例如“明日方舟 + 6星”；已有 tags.mjs/selectedTags 机制时复用，不重新实现或改成单选。已有设置正常则不做无关 UI 改动。

## 数据库

三个一致性目标：`database.json`、`playground-model-links.json`、`index.html` 中 `<script id="db" type="application/json">`。

`operator_forms` 按 `character_form_id` 精确匹配，读取当前中文、英文、rarity 字段。本体与异格不合并；实际字段类型先查，不盲目猜 rarity 是否从零开始。此项目用户约定：确认方舟角色但无数据时用 3星，并标明推定。

验证后的 form：`local_model_status='modeled'`，`local_models` 合并对应 portal_model_id，不删除其他有效皮肤/版本。链接记录按 portal_model_id upsert，包含 display_name、tags、matched_operator_form_id、model_html_relative_path、absolute_path、file_exists、file_size、sha256、playground_url、href_from_specialty_panel、offline_href、runtime_validation、runtime_report 及源文件追溯。

`playground_url` / `href_from_specialty_panel` 指向精确角色活页，`offline_href` 是数据库目录至实际 HTML 的相对路径。先确认文件存在与 SHA，再更新 counts 和当前维护的来源摘要。内嵌 JSON 用 JSON 编码并转义 `<`，不可全局替换页面文本。数据库写前备份，临时文件写入后替换，三文件读回比对；中断时根据清单修复一致性。不要把未通过验证的条目标为 modeled。

此 specialty 库与 `ak_collect/catalog/catalog.json` 是不同用途：本流程关联 specialty，不额外伪造 general catalog 资产记录。

星级标签应复用当前项目已有的规范拼写（本项目当前为 六星/五星/四星/三星），不要另建 6星 与 六星 两套同义标签。
