# 设定图到模型的交接格式 v1

## 按环境能力交接

只在最终交付整理一次交接；迭代中保留必要的版本与问题记录，不逐轮重写完整 JSON、重复计算哈希或输出长报告。

- **完整交接**：可读写文件并计算哈希时，在 `design/design-handoff.json` 写 UTF-8 JSON，格式见下文。原图、母版、版本化阶段图、实际提示词与最终图保存在角色工程中，不覆盖源文件。文件路径相对 JSON；对 source_image、style_master、final_sheet 记录实际 SHA-256，未改文件复用已计算的值。
- **简版交接**：仅有图像工具、不能持久化文件或计算哈希时，最终图加简短文本就是有效交接。文本包括阶段与验收状态、身份锚点与关键结构/挂点、保留与排除清单、明确要求的道具、推定及未通过项。没有的路径或哈希省略，不填假值，不为凑完整格式强行安装工具或增加处理流程。
- 用户要求仅展示一张图时遵循该要求：有文件能力则在本地保留交接，无文件能力则只交图，下游从图和用户要求重新提取信息。

两种交接都以真实图像为依据。文件可访问且提供哈希时，模型端首次接收核对；同一文件未变不重复计算。图片变更后查看新图并更新受影响的评审，不沿用旧结果宣称新图通过。现成四视图没有 JSON 或未知原图/母版仍可作为输入，记录缺失信息，不补造哈希或强迫重走出图。

## 完整 JSON

以下展示字段结构，不是某角色的已完成结果：

```json
{
  "schema_version": 1,
  "character_id": "character-slug",
  "phase": "standardized",
  "status": "needs_revision",
  "source_image": {"path": "source.png", "sha256": "ACTUAL_SHA256"},
  "style_master": {"path": "style-master.png", "sha256": "ACTUAL_SHA256"},
  "final_sheet": {"path": "sheet-v1.png", "sha256": "ACTUAL_SHA256"},
  "views": ["front", "left", "back", "front-three-quarter"],
  "identity_anchors": ["根据真实输入填写具体身份锚点"],
  "parts": [{"id": "part-id", "type": "hair", "description": "具体结构和配色", "parent": "head", "attachment": "可见连接位置", "motion": "secondary", "evidence": "observed"}],
  "palette": {"iris": "参考色", "eyeWhite": "独立参数", "eyeHighlight": "独立参数", "outfitPrimary": "参考色"},
  "inferred_details": [],
  "review": [{"check": "identity", "result": "unverified", "evidence": "尚未检查"}],
  "unresolved": [],
  "scopeReview": {"kept": [], "excluded": [], "explicitlyRequestedProps": []},
  "model_target": "voxel-silver-wolf-refined-dynamics",
  "model_notes": ["保留身份；体素模型沿用三维母版比例和几何，非平滑设定图的逐像素复制"]
}
```

phase 为 concept / standardized；status 为 ready / needs_revision。ready 必须有实际视觉评审，review 覆盖 body、pose_camera、identity、structure、layout_material 五项，有阻断项时不能 ready。concept 可作为直接建模输入但不是标准化结果；只有用户接受该范围时继续。

交接记录 scopeReview.kept、excluded、explicitlyRequestedProps 及依据：明确列出未展示的道具，不能仅从 parts 中删除后丢失原因。建模端仍独立复核范围；旧交接无此字段时自行补齐，不假定没有道具。

parts 的 motion 为 rigid / secondary / skinned，evidence 为 observed / inferred。发带等刚性附件记录挂在哪束头发上，不能只写 head 而丢失随动关系。palette 使用独立语义键，即使色值一样也不合并眼睛与服装用途。

建模 skill 将这些设计字段映射到其 scaffold 生成的 character-spec.json，保留后者的绑定、动态预算与交付字段。不要直接用此文件覆盖模型 spec，也不要把图片“看起来可动”标为模型已测试。
