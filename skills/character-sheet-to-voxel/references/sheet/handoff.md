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

交接记录 scopeReview.kept、excluded、explicitlyRequestedProps 及依据；建模端仍独立复核，旧交接缺少字段时自行补齐，不假定出图已过滤道具。

parts 的旧字段 motion 为 rigid / secondary / skinned，evidence 为 observed / inferred。发带等刚性附件记录挂在哪束头发上，不能只写 head 而丢失随动关系。palette 使用独立语义键，即使色值一样也不合并眼睛与服装用途。

## 复杂部件的可选描述

继续使用 schema_version: 1，旧交接保持有效；按实际复杂度给 parts 添加以下可选字段，不要求简单角色填满所有字段：

| 字段 | 设计阶段的含义 |
|---|---|
| shapeMode | rigid 保持自身形状；deformable 可沿长度或承载面弯曲 |
| motionMode | follow 跟随承载物；secondary 有独立附加运动 |
| attachments | 多个连接描述，每项记录 owner、location、role 和 evidence；如缝合端、过扣点、包侧端 |
| path | 从起点到终点的有序描述，区分固定、过渡和自由段；无需在图片阶段猜三维坐标 |
| priority | identity / structure / detail：身份锚点、承载连接、可简化微细节 |

例如卡套可为 rigid + secondary，贴身肩带可为 deformable + follow，带尾可为 deformable + secondary。刚性和独立摆动不是互斥选项。父部件仍记录承载关系；attachments 记录跨部件连接，不将其强行压成单父节点。图片位置使用角色自身左右。

旧 motion 在模型适配阶段结合参考转换：rigid 通常为 rigid + follow；skinned 通常为 deformable + follow；secondary 指独立运动，自身是否变形由材质/形状判断。若已提供新字段，以显式新字段为准，并记录旧字段矛盾；不能把所有旧 secondary 都当软带。此转换是建模适配工作，构件包不自动解释设计交接。

## 映射到模型实现

建模 skill 将这些设计字段映射到其 scaffold 生成的 character-spec.json，保留后者的绑定、动态预算与交付字段。不要直接用此文件覆盖模型 spec，也不要把图片“看起来可动”标为模型已测试。

需要通用配件时，按底层 [配件构造与连接](../../../voxel-chibi-character/references/accessories.md) 将设计 parts 转换为工程根 character-spec.json 的 accessories 实现对象：实际尺寸、模型坐标、命名挂点、骨骼、路径权重与动态参数均在建模阶段确定。设计 attachments 中的 owner/location 描述不等于实现 attachments 的 anchor/at 数值字段。无法表达的结构由角色源码适配，不把尚未实现的描述标为完成。
