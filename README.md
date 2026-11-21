# Skill 工作台插件市场

在[市场首页](https://skyhro.github.io/skill-workbench-market/)点击插件可查看介绍、发布者和兼容版本。打开工作台的「插件市场」即可搜索、查看详情和安装。工作台选择已上架版本中适用于当前客户端的最高版本。[公网目录](https://skyhro.github.io/skill-workbench-market/index.json)

## 下载客户端

从[市场首页](https://skyhro.github.io/skill-workbench-market/)下载适用于 Apple 芯片的 macOS 客户端。公开发行页提供版本说明及 ZIP 的 SHA-256 校验文件。

## 提交插件

1. Fork 此仓库，在自己的 Node.js 24 插件项目根目录运行以下命令，将 SDK 2.1.0 添加为开发依赖：

   ```sh
   npm install --save-dev https://skyhro.github.io/skill-workbench-market/skill-workbench-plugin-sdk-2.1.0.tgz
   ```

   npm 会下载并解包 SDK。可从[引用巡检示例](examples/reference-audit/)复制 `manifest.json` 和 `activate.js`，再按下面的步骤打包。

2. 将 ID 改为「自己的 GitHub 用户名小写.插件名」，更新作者名称、三段版本号和 `engines.workbench`。例如使用 `>=0.1.0 <0.2.0` 限定兼容的工作台。API 2 插件在 `contributions` 中选择位置 `skill.detail` 或 `diagnosis.summary`，以及输出 `panel` 或 `markdown`。
3. 执行 `npx workbench-pack manifest.json activate.js <id>-<version>.json`。将生成文件放入本市场的 `packages/`，提交 PR 到 `master`。主题和报告可直接提交 API 1 JSON。手绘风格使用 API 3 声明式笔触包，要求工作台 0.1.1 或更高的兼容版本。公共市场采用 GitHub 身份与 PR 审核；SDK 中的 `workbench-publish` 供支持直传的私有市场使用。
4. 在 PR 中说明用途、需要的输入、目标位置和验证步骤。维护者检查包内逻辑、身份、版本及兼容范围后合并。部署完成后，用户重新进入市场或点击「刷新市场」即可发现。更新时发布新的文件，历史版本保持原字节。

## 维护与撤回

`npm ci --ignore-scripts && npm run catalog` 在本机生成与 Pages 相同的目录，不执行投稿插件。GitHub Actions 在合并后发布目录与版本包。紧急撤回时由维护者在 `withdrawn.json` 增加完整文件名并合并。下一次部署去掉该包和目录条目，客户端刷新后可安装其余兼容版本。已安装副本仍在用户本机，必要时请通过发行说明告知用户停用。仓库 Git 历史可用于恢复发布资料；再次上架修复应提高版本号。用户下载时由客户端校验 SHA-256。

## 管理员发布、撤回与验证

从市场首页底部进入「管理员发布与验证」，在 GitHub 登录具有本仓库 **Admin** 权限的账号，点击 **Run workflow**，分支选 `master`。输入文件名、版本即可操作，每次运行在 Summary 记录校验摘要。

| 操作 | 输入 | 结果 |
| --- | --- | --- |
| verify | 无 | 只读核对线上首页、目录、每个插件包及客户端 ZIP、校验文件 |
| publish-both | 客户端版本、插件文件名 | 校验两份产物后发布客户端，并部署同一份市场目录 |
| publish-client | 客户端版本 | 发布已准备好的客户端 Release，并更新首页下载入口 |
| publish-plugin | 插件文件名 | 上架新包或恢复管理员撤回的版本 |
| withdraw-plugin | 完整插件文件名 | 下次刷新不再提供该版本，站点撤下对应包文件 |
| withdraw-client | 当前客户端版本 | 移除官网下载入口，将对应 GitHub Release 转为草稿 |

客户端产物先上传到本仓库的草稿 Release `client-v<版本>`，附件为 `skill-workbench-<版本>-macos-arm64.zip` 及配套 `.sha256`。插件可来自已审阅的 `packages/`，或上传至同仓库 Release，并在表单填写该标签。已发布的同版本内容不可替换。文件从指定 Release 读取，浏览器无需录入令牌。已有用户的本机安装不会因撤回被删除。

管理变更记录在 `market-state` 分支。市场源码更新时会合并这份分发状态，避免重新上架已撤回的版本。若部署或联网校验失败，查看失败步骤，重跑原操作。仓库 `withdrawn.json` 的撤回优先于管理端恢复。完成部署前以工作流的最终结果为准。
