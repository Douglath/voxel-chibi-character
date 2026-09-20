# 设定图到模型的交接格式 v1

每个角色在 `design/design-handoff.json` 写 UTF-8 JSON。所有文件路径相对该 JSON，允许相对引用工程内模型资料；原图、母版和最终图应复制进角色工程，以免聊天或缓存清理后失效。不覆盖源文件。对 source_image、style_master、final_sheet 记录实际 SHA-256；模型端核对哈希，图变更后必须重看，不能沿用旧评审。

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
  "model_target": "voxel-silver-wolf-refined-dynamics",
  "model_notes": ["保留身份；体素模型沿用三维母版比例和几何，非平滑设定图的逐像素复制"]
}
```

phase 为 concept / standardized；status 为 ready / needs_revision。ready 必须有实际视觉评审，review 覆盖 body、pose_camera、identity、structure、layout_material 五项，有阻断项时不能 ready。concept 可作为直接建模输入但不是标准化结果；只有用户接受该范围时继续。

parts 的 motion 为 rigid / secondary / skinned，evidence 为 observed / inferred。发带等刚性附件记录挂在哪束头发上，不能只写 head 而丢失随动关系。palette 使用独立语义键，即使色值一样也不合并眼睛与服装用途。

建模 skill 将这些设计字段映射到其 scaffold 生成的 character-spec.json，保留后者的绑定、动态预算与交付字段。不要直接用此文件覆盖模型 spec，也不要把图片“看起来可动”标为模型已测试。

用户仅提供现成四视图时，模型 skill 自行提取同等信息即可；未知原图/母版写入限制，不补造哈希，不强迫回到出图流程。
