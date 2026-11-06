# 岁己 V4 局部风格样例与可选组件

适用于参考中存在宽厚螺旋卷发、倾斜贝雷帽或扁平光环的角色。先看下列真实模型图，再决定匹配的构造；这是用户认可的岁己 V4 局部几何，不是新的整角色母版。只读取随包素材，不检索角色数据库。

## 实际视觉依据

| 部件 | 参考与判断重点 |
|---|---|
| 螺旋卷发 | [正面](../assets/approved-parts/spiral-front-posed.png)、[侧面](../assets/approved-parts/spiral-side-posed.png)、[斜视](../assets/approved-parts/spiral-three-posed.png)：渐细发芯承托宽厚卷片，轮廓连续收束，不能变成薄带、珠串或叠盘。 |
| 帽子 | [局部成形](../assets/approved-parts/beret-three-local.png)、[整体倾斜](../assets/approved-parts/beret-three-posed.png)：帽冠、帽带、心形扣使用同一姿态，保留可见层次。 |
| 光环 | [局部成形](../assets/approved-parts/halo-three-local.png)、[整体倾斜](../assets/approved-parts/halo-three-posed.png)：局部 XZ 平面内的像素环，倾斜不产生新的世界轴台阶。 |

与角色整体的关系见 [认可版正面](../assets/approved-parts/approved-context-front.png)、[侧面](../assets/approved-parts/approved-context-side.png)、[斜视](../assets/approved-parts/approved-context-three.png)。它们说明根部、发量与帽子的关系，不授权复制本角色脸、衣装或配色到其他人物。截图是实际模型渲染，不是生成设定图。

## 可直接复用的实现

本模块是可选参考，不修改原脚手架。仅当本角色确需这些构造时，按需复制 `assets/approved-parts/` 到工程；不替换现有正确实现。`approved-parts.mjs` 依赖相邻 `sui-v4-local-data.mjs`，二者一起保留。它接收工程自己的 THREE，不绑定其他人物工程路径，不需要运行时网络读取。

```js
import {createApprovedPart,attachApprovedPart} from '../assets/approved-parts/approved-parts.mjs';
const curl = createApprovedPart(THREE, 'spiral', {
  position: [rootX, rootY, rootZ], // 角色绑定姿态中的发根
  scale: [fullnessX, lengthScale, fullnessZ], // 在部件局部空间塑形
  mirror: false, // 另一侧以自己的发根放置，并设 true
  rotation: [0, 0, 0],
  palette: {hair:'#e4e2ed', hairLight:'#f8f5fa', hairShade:'#c3bed2', hairSoftShade:'#cec9dc'}
});
curl.children[0].name = 'Ponytail_L'; // 按工程绑定名称适配
attachApprovedPart(root, curl);

const hat = createApprovedPart(THREE, 'beret', {
  position: [hatX,hatY,hatZ], rotation:[0,0,tiltZ],
  scale:[widthScale,heightScale,depthScale], includeMotifs: true
});
attachApprovedPart(root,hat);
const halo = createApprovedPart(THREE, 'halo', {
  position:[haloX,haloY,haloZ], rotation:[tiltX,0,tiltZ], order:'ZYX',
  scale:[radiusXScale,thicknessScale,radiusZScale], includeMotifs:true
});
attachApprovedPart(root,halo);
```

参数为相对原始部件的正数比例，不是目标绝对尺寸。spiral 原点在发根，沿 -Y 延伸；beret 原点在帽底中心附近；halo 在局部 XZ 平面，厚度沿 Y。`approvedPose(kind)` 返回岁己 V4 的放置值，仅用于同角色参考还原或样例，不默认套用到其他角色。`includeMotifs` 默认 false：省略帽心扣或光环羽饰；其他角色仅在参考确有这些饰件时开启。帽带仍保留，其他帽型应选别的构造。`namePrefix` 可避免重名，重命名后同步绑定。

组件保留原始顶点色和硬边法线；`palette` 按来源语义色覆盖，未指定颜色保留，不能以此省略新角色配色适配。帽带和扣件保留独立材质。适配整体尺寸后需看实际局部/全身图确认帽带朝向、卷发根部和身体净空。

## 为什么不会出现倾斜造成的额外阶梯

接口只做 `placement × localShape`：先对局部几何缩放/镜像，再施加统一旋转和平移；**不对结果重新取整或体素化**。姿态直接烘焙进 BufferGeometry，网格变换保持单位值，以兼容只导出几何的路径。不要再把返回的顶点塞回世界轴体素占用表；不要重复添加相同旋转。

帽冠、帽带和扣件通过同一次调用放置；独立帽饰若后加，必须使用相同帽子局部坐标系和姿态。光环使用一个刚性运动组；倾斜是基础姿态，动态骨施加的是其上的小幅整体响应。

这是已认可造型的可缩放几何组件，不是能改变圈数、编织方式或任意帽型的通用生成器。参考相近且选择复用时，改变长度与发量应保留发芯/卷片比例。参考确需其他卷法时使用 hair.md 构造配方并对照视觉依据，不强套本预设。组件不自动生成骨骼、蒙皮或风阻；仍需接入当前角色运行时，不以导入组件证明动态完成。

## 最小验收与来源

先看实际模型上部件是否接入、比例和参考方向是否一致；一次局部近景加必要侧/斜视即可。倾斜部件检查其平面保持平直、像素块整体一起转动；卷发检查发芯、卷层、收束。不追加数据库或其他角色扫描。

[provenance.json](../assets/approved-parts/provenance.json) 记录 V4 来源与提取范围；[component-validation.json](../assets/approved-parts/component-validation.json) 只证明提取重现、姿态变换和镜像面朝向，不代表任意新角色外观或动态通过。角色形象权利与 Skill 代码许可分开，保留原有来源说明。
