# 来源索引与证明边界

[返回入口](README.md) · [源码/报告短摘录](source-excerpts.md) · [17 张图片哈希清单](evidence-manifest.json)

**来源快照日期：2026-09-27（Australia/Sydney）。** SU-001 审查记录日期为 2026-09-27，凯尔希迭代及专项记录属于 2026-09-24。本文保存当日读取的证据，不随未来模型或规则文件变化自动更新；此次规则发布状态由后续发布任务在公开副本核对更新，新模型验证状态须另记。

所有路径采用逻辑来源前缀，不包含本机用户名、盘符、账号链接或 API 配置。`skillupdate/` 指文档项目，`playground/` 指模型项目，`skills/` 指已安装技能目录。没有把这些定位文字做成失效的外部链接：阅读本报告所需图像、结论和短摘录均在当前目录内；完整源码/运行时不在本分享包。

## 审查来源

| ID | 逻辑位置 / 章节 | 本报告使用的内容与边界 |
| --- | --- | --- |
| S1 | `skillupdate/reports/SU-001-manager-conclusion.md`，“已证实的事实”“推断与待确认” | 六例差异、母版/参考分工、原件一致性、规则缺口及不可归因项；是既有审计结论，本轮没有重跑 ZIP 比对 |
| S2 | `skillupdate/reports/SU-001-model-validation.md`，“六例源码逐一核查” | 原始构造、修订对照及具体代码定位；本轮再次读取指定源码行 |
| S3 | `skillupdate/reports/SU-001-pipeline-repair.md`，“六例请求和原包复核”“星熊本地次生缺陷证据链” | 来源一致性与本地 v3/v4 区分；原始输入和 ZIP 哈希结论继承审计，未扩展到所有衍生文件 |
| S4 | `skillupdate/reports/SU-001-sheet-handoff.md`，“六例实物与历史记录”“证据缺口” | 图片 pass 不等于模型验收；烛煌、司霆惊蛰的 prompt 在当时有界搜索中未找到，不能声称永久不存在 |
| S5 | `skills/ak-model-batch-import/references/style-repair.md`，“用户确认的手部修复阈值” | 四张原图及手/臂联合分流；摘录保留读取版本哈希 |
| K0 | `skillupdate/kaltsit-iteration-summary.md`，“全部迭代及结论”“检查成本和证据边界” | 历史反馈、v2 局部认可、v3/v4 否决、裙/发长纠正、项链补强及最终认可边界；反馈为该复盘转述，未重新查私密会话 |
| K1 | `skillupdate/output/kaltsit-refined-20260924/README.md`，开头、“验证状态与边界” | 裙体/发长、GLB 与运行时分工、有限验证范围；此角色 README 的旧发布表述不用于判断此次规则发布状态 |
| K2 | `skillupdate/output/kaltsit-refined-20260924/character/necklace-validation.json`，`pass/sourceSHA256/summary` | 修后 25 姿态 × 840 样本及结果，已收录选定字段；无旧版近景，不把文字事件当图片复现 |
| K3 | 同上目录 `forward-run-validation.json`，`summary.results/sustainedDrive` | 专用强跑有限采样及同路径开关对照；已收录字段，不是本轮运行 |
| K4 | 同上目录 `forward-live-validation.json`，`completed/frames/metrics` | 网页既有执行记录；保留 `strongMotionValidation: unverified` 与专用报告状态差异 |
| K5 | 同上目录 `validation-summary.md`，全文 | 最终模型哈希、有限接触/动态范围、隐藏头皮嵌入等例外；不能称全模型零相交 |
| K6 | `skillupdate/handoff.md`，`follow-up: necklace clearance and forward run`、`local skill consolidation` | 确认项链问题发生在早先交付之后、后续修正以及角色实现/规则更新的时间区别；后面仍有其他历史任务，不自动继承为待办 |
| S8 | `skillupdate/output/kaltsit-angled-preview-20260924/comparison.png` 与 `kaltsit-reference-preview-20260924/comparison.png` | 本轮实际查看并核对两者字节相同；只采用前者为 v1/v2 对照，不作为 v4 成果图 |

S8 两图 SHA-256 均为 `45f014adf41b8c66d1b81f7a0dfaf2be743ee70d230678d2cf695a538ad71354`。v4 的被否决/回退由 K0/K6 支持，不能把重复图片当成独立旁证。

## S9 · 快速预览 HTML 交付范围的文档冲突

2026-09-27 追加现场核对：同源维护仓库的 `skills/voxel-chibi-character/SKILL.md:58`（“固定预览交付”）写“所有生成模型均附带同源的离线游乐场 HTML”；`skills/voxel-chibi-character/references/validation.md:12`（“快速预览范围／最短执行”）写“不为静态稿运行 rig-export 或默认离线 HTML 打包”。本机安装副本同样存在这两句，后者当时位于第 11 行。

读取时维护仓库两文件 SHA-256 分别为 `1b4836f46018589f21642e8c962370887ccd9c5b1dc095a84e4a7aec889d7c46`、`352d9bd39b5d1a2d0828aaa89c1055e05e7adcbaad24d82b788d504c3773a268`。另只读核对仓库已提交版本 `1d1832839c6364c35dca23d76f43eb0a72f91bee`：上述两句已经分别位于第 58、11 行，支持其并非此次四肢修改引入。

影响限于交付范围可能被不同解释：是否给快速静态预览默认打包离线 HTML。此次只登记、不修改 skill，冲突尚未解决；没有本轮新模型复现实验，不据此认定任何案例已漏交付或额外交付。人工复核可在同一版本并读这两个章节；最终如何消歧需另行处理。

## 实物来源

六例原图分别取自原始 source 工程的 `evidence/front.png`、`previews/front.png`、`character/front.png`、`validation/static-view-front.png`、`validation/front.png`、`validation/model-front.png`；精确 form ID、项目名及文件位置在图片清单中逐项列出。

代码短摘录 C1–C6/C2G/C6G 覆盖六例局部结构；R1–R6 是对应 `revision-v2/REVISION.md` 的有界节选；W3 来自真实 v3 备份，W4 来自之后的 v4 文件。源文件哈希与摘录行号均保留，旧版本目录名不被当成实际内容版本。

四图标尺取自 `skills/ak-model-batch-import/references/hand-thresholds/example-1.png` 至 `example-4.png`。1/2 的“轻度”和 3/4 的“临界”来自已有用户标准，不是本报告作者重新评级。

## 本轮现场验证与继承证据

本轮亲自查看了所有 17 张交付图；回读六例相关代码、六份修订说明、v3/v4 相关代码、手标尺规则、凯尔希复盘/交接及指定报告。图片均原样复制并核对 SHA-256。另看过 quick v1 三视图和 v4 目录旧对照，前者因冗余未收录，后者用于排除错误归属。

本轮未打开历史云端生成会话，未操作云端资料，未重新生成图片/模型，未重新运行 GLB 或网页动作。历史浏览器测试、ZIP 一致性、用户认可等结论均按各自来源和范围标注。尚未明确的字段和当前规则发布状态保留为待核对，不以新文档存在推定已解决。

## 未收录为独立结论的内容

- 未给六例原手补造轻度/临界/超临界评级：现有正面图不足以完成相近尺度多视角判断。
- 不以旧 v4 README、旧对照图或目录名证明 v4 成功；不从静态截图判断全部动作。
- 不补造缺失的出图 prompt，不推出云端版本差异，不估算技能成功率。
- 未把历史原始道具问题扩写为完整案例；本轮没有加入足够的原始道具实物对照。
- 不把单角色持续驱动实现、齐肩高度、双鬓等长、具体骨骼数量推广为通用要求。

维护时应先核对目标文件版本，再更新对应状态；尤其要让发布记录与新模型验证结果分开记录。
