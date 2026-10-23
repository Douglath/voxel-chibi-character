# 配件构造与连接

用于胸卡、扣件、织带、口袋、挂包和设备等组合结构。先看实际参考，记录身份作用、承载物、连接关系与推定，再选几何；不要为了使用配件库而给角色加装备。头发仍遵循 [hair.md](hair.md)，兽耳、尾巴和带状物的专用运动规则见 [ears-tails-straps.md](ears-tails-straps.md)。

仅为入口 scopeReview 的保留项使用构件；检查时机按 [validation.md](validation.md)，本专题不增加每轮检查。

## 用少量结构组合

| 构件 | 常见用途 | 保留的结构 |
|---|---|---|
| plate 薄片 | 卡面、臂章、标签、屏幕色块 | 尺寸、厚度、表面或独立悬挂 |
| frame 框环 | 卡框、调节扣、连接环 | 真实开孔、穿接空间、外轮廓 |
| strap 路径扁带 | 背带、腰腿带、带尾 | 宽厚、走向、固定段、过扣点、自由端 |
| cord 路径细绳 | 抽绳、挂绳、线缆 | 两端来源、松弛路径、绳扣或末端 |
| shell 壳体 | 翻盖袋、挂包、硬盒、终端 | 体积、开口、盖片、承载位置 |

例如胸卡保留“衣物缝合区—短带—连接环—卡套—卡面”的连接链；斜跨带记录肩部、胸前调节扣和腰包等经过点。带尾来自已有带子穿扣后的余段，不是凭空新增一根装饰。部件父级描述承载者，多个 attachments 描述实际连接，不能只写 parent: chest。

可选组合范例为 [technical-kit.mjs](../assets/accessory-examples/technical-kit.mjs)，配合当前母版重建用户认可的 technical-kit-eyes-v5：4,026 三角面、8,480 顶点、46 骨骼、55 网格、1 材质、0 纹理。它演示连接和部件分工，服装/头发/虹膜明暗沿用母版；不成为第二造型母版，也不要求给每个角色附加整套装备。新角色按参考选取和重新定位。

## 形变与运动分开

- shapeMode: rigid / deformable，说明部件自身是否弯曲；motionMode: follow / secondary，说明是否有独立附加运动。卡套可以保持刚性并整体摆动；贴身带可以随躯干弯曲而无自由甩动。
- 刚性扣件/卡套的全部顶点绑定同一骨骼，不因靠近软带而沿带长渐变权重。软带/绳按路径分段，固定区稳定、自由段再过渡；双端固定物需要覆盖两端的绑定和相应动作验收。
- 贴身项链/肩带沿实际承载表面走线，在颈根、锁骨或衣领转折处设路径点，预留自身半厚度与活动间隙；端点正确不代表直连路径安全。各段权重跟随其承载区域，跨颈胸时用兼容过渡；修正局部穿入，不把整条配件前移成悬浮物。疑似埋入的验证见 [层间穿插专项](validation.md#层间穿插与闪烁专项)。
- 只有需要独立响应的自由段或硬件才增加附加骨。沿用当前角色动态预算；配件数量不等于动态骨数量。挂点正确不能替代固定端的真实几何接触。

## 当前构件包接口

[accessory-kit.mjs](../assets/accessory-kit/accessory-kit.mjs) 提供 `applyAccessories(root, spec)`；[accessory-dynamics.mjs](../assets/accessory-kit/accessory-dynamics.mjs) 提供运行时附加运动。脚手架会复制构件包，build 读取**工程根** `character-spec.json` 的 `accessories`；没有此可选对象时沿用原角色。直接运行旧模型脚本或编辑另一处 spec 不会自动接入此输入。

实现对象的字段如下；它与设定图的描述性 parts 不是同一个格式：

```text
accessories: {
  version: 1,
  palette: { semanticKey: "#rrggbb" },
  anchors: { anchorId: { position: [x,y,z], bone, owner, evidence } },
  bones: [{ name, parent, position: [x,y,z] }],
  dynamics: [{ bone, axis: [x,y,z], stiffness, damping, maxAngle }],
  parts: [{
    id, kind, geometry, color: "semanticKey",
    shapeMode: "rigid|deformable", motionMode: "follow|secondary",
    binding: { bone } OR { stations: [{ t, bone }] },
    attachments: [{ anchor: "anchorId", at: [x,y,z] }],
    priority: "identity|structure|detail", evidence: "observed|inferred"
  }]
}
```

位置坐标统一为角色绑定姿态的模型局部坐标：+Y 向上、+Z 正面，沿用当前角色尺度。anchor.position、骨骼 position、几何点和 attachment.at 都在此坐标系，**不是父骨局部偏移，也不是零件自身坐标**。owner 填实际承载网格名称或配件 ID，bone 填实际骨骼名；不可把语义“左肩”当数值位置。构件包不能从 owner 自动找到衣物表面。真实骨骼名在骨骼导出/绑定阶段核对，仅构建几何不证明挂点骨有效。dynamics.axis 是附加骨的局部转轴，maxAngle 使用弧度（当前上限 π/2），不是模型位置坐标。

| kind | geometry 参数及当前范围 |
|---|---|
| plate | center、size，轴对齐有厚度薄块 |
| frame | center、size、opening: [width,height]，沿 Z 贯穿的矩形开孔 |
| shell | center、size、wall，朝 +Z 开口的壳体；盖片另组装 |
| strap | points、width、thickness；可选 step 或 subdivisions、normal 或 widthAxis |
| cord | points、width；可选 step 或 subdivisions、normal 或 widthAxis，方截面细绳 |

路径 points 为有序三维点；normal 默认从 +Z 投影得到。需要固定带宽方向时可改用 widthAxis，例如绕 XZ 平面的腿带指定 [0,1,0]，宽度沿 Y、厚度沿径向。widthAxis 与 normal 互斥，指定方向须与路径切向兼容；widthAxis 平行切向会报错。末点重复首点表示闭合路径，闭合缝不封端。路径分段用于可弯曲网格，不能靠两个端点的大长面宣称均匀弯曲。stations 按路径弧长归一化的 t 排序，覆盖 0 到 1；rigid 不使用不同骨骼的渐变 stations。当前 deformable 支持 strap/cord；plate/frame/shell 保持刚性，复杂软口袋须另写几何/蒙皮。

attachments 声明连接证据并检查 at 与命名 anchor 的距离（默认容差 0.02 模型单位），**不施加双端约束、不自动贴合、不处理碰撞**。没有独立连接的表面色块可省略 attachments（默认空数组）；实际承担连接的部件仍应记录。两端跨活动骨骼的带子需要合适 stations，并在动作中验证接触。构件函数是可编辑基础：D/O 环、弯钩、旋转壳体或复杂曲线应据参考扩展，不能把矩形框称为已经还原 D 形环。

运行时 `AccessoryDynamics(rig)` 支持 enabled、kick、update、reset；独立运动需实际动态骨、配置和蒙皮。它不提供完整布料碰撞或自动惯性适配，真实 GLB 与预览必须接入后再验收。单位、选轴、摆幅和阻尼取决于当前角色，不能照搬范例数值。

## 像素表达与验收

- identity 优先保留身份轮廓、位置和主色；structure 保留承载、开孔、路径和层次；detail 按最终观看尺寸概括。功能穿接孔保留开口，纯装饰铆钉可用亮点，小拉链齿可概括窄条。正常预览与局部近景都看，不为显示微细节放大所有配件。
- 字母、组织标记和卡面分区使用独立语义颜色；不为不清晰的参考编造照片、姓名或可读文字。允许图形化简化并记录。共用顶点色材质不要求共用语义键。
- 默认通过边框、色块和明暗提示透明卡套、金属扣的差别，构件包不自动提供真实透明/金属材质。确需新材质时记录理由，实测材质、网格和 draw calls。
- 检查当前实际 GLB 的固定端接触、穿孔空间、硬件保形、双端带连接、自由段回弹、与承载物的穿插和闪烁。静态硬件无需非零响应；新增独立动态按现有生命周期与帧率要求验证。
- 测试范围随变更选择；小配色修改不要求重建一套通用样件。基础构件验证通过只证明构件能力，新角色仍需参考适配和实际外观/动作检查，未观察部分记录 unverified。

## 悬浮饰件与材质迭代

几何独立、视觉位置和运动跟随分别记录。参考中的悬浮发饰不等于长在肩膀或与马尾焊接；可作为独立网格跟随马尾骨骼，同时保留设计间隙。固定位置用相对地标描述（如马尾经过肩高处），不能把“马尾饰件”默认解释成发梢挂件。按用户认可的空间位置修改材质时，保留几何和挂点。

不透明、半透明、发光是独立语义材质区；只把指定部位改透明，不顺带球面化或重建已认可轮廓。半透明先检查前后层排序、深度写入策略、叠层变黑与背景可见性；发光区域保持轮廓和普通镜头下可读性，不用强泛光遮盖结构。根据实际渲染器选择材质，不能把透明度参数存在当作已验证视觉效果。

新增飘带优先复用本包路径构件，数量、走向、接点及动态父级按参考与有效纠正设置。单独道具保持可分离对象与导出边界；尺寸调整核对角色和动作包络，不能只以静止包围盒证明所有动作不穿模。
