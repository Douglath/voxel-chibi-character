# 像素角色网页版适配包

## 使用方式

- **直接看母版**：下载独立 character-preview.html，在现代浏览器打开。Three.js、模型、动态均已内嵌，不依赖本地服务器或 CDN。GLB 和报告可在页面下载。
- **查看配件组合**：technical-kit-preview.html 展示已确认的胸卡、斜带、拉片和腿包组合（technical-kit-eyes-v5）；对应 technical-kit-rigged.glb。它是可选范例，不会默认给新角色添加装备。
- **ChatGPT 有 Skills 上传入口**：上传 voxel-character-web-skill.zip；按界面完成检查/安装。
- **支持插件导入的工作区**：使用 voxel-character-web-plugin.zip，其中有根 plugin.json 与兼容清单。安装方式取决于工作区，不保证个人账号都有同一入口。
- **没有安装入口**：在可处理附件的会话中上传 skill ZIP，明确要求解包并读取 SKILL.md。这属于本次会话提供参考，不是持久安装。

创建新角色需要当前会话具备文件和代码执行能力。模型构建使用 Node.js，HTML 打包使用 Python 标准库；Three.js 已随包。只有普通聊天时不能保证生成、运行或验收模型。内嵌预览不支持脚本时下载到浏览器打开，不需要关闭浏览器安全设置。

示例提示：

> 请解包并阅读 voxel-character-web 的 SKILL.md，依据我上传的参考制作角色。先确认执行能力；保留宽发片和适用的附加动态，交付可下载的自包含 HTML、GLB 和源码。不要把基准角色当成新角色。

默认 `scripts/create_project.py <新目录>` 复制母版并生成可编辑 character-spec.json；增加 `--accessory-example technical-kit` 可复建配件范例，`--accessory-example wrist-kit` 可查看腕部设备组合。构造包支持薄片、真实开孔框环、路径织带、细绳和壳体；尺寸、挂点和动态仍需根据当前参考适配。

母版包含衣片内部明暗、头发接界与分束、克制的虹膜层次。换角色时同时检查 model.mjs、hair-colors.mjs 和 tonal-colors.mjs 的配色和选面规则，避免派生色覆盖角色主色。

## 验证范围

本包验证独立浏览器与本地代码执行。尚未在用户的网页版 ChatGPT 账号安装验证，未提交公共插件目录，未部署在线服务。安装插件本身不会部署脚本或提供执行环境。

官方打包规范：https://developers.openai.com/plugins/build/plugins

Three.js 0.180.0 MIT 许可随 assets/three/LICENSE 提供；角色模型不额外授予原角色IP权利。

当前源码验收：使用随包 Three.js 重建母版和可选配件范例，无 npm 安装；静态和骨骼 GLB 的逐网格位置、法线、颜色、索引和蒙皮与对应已确认版本一致。8 项母版实际 GLB 回归和 11 项配件构件/动态测试通过。网页交互验收按 references/web-validation.md 对最终 HTML 单独记录；不能以源码测试代替浏览器画面或用户账号内安装验证。包中同时直接附带 GLB，模型获取不依赖页面下载按钮。
