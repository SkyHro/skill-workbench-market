# Skill 工作台插件市场

打开工作台的「插件市场」即可搜索、查看详情和安装。工作台选择已上架版本中适用于当前客户端的最高版本。[公网目录](https://skyhro.github.io/skill-workbench-market/index.json)

## 下载客户端

从[市场首页](https://skyhro.github.io/skill-workbench-market/)下载适用于 Apple 芯片的 macOS 客户端。公开发行页提供版本说明及 ZIP 的 SHA-256 校验文件。

## 提交插件

1. Fork 此仓库。下载 [SDK 2.1](https://skyhro.github.io/skill-workbench-market/skill-workbench-plugin-sdk-2.1.0.tgz)，在自己的 Node.js 24 项目执行 `npm install --save-dev ./skill-workbench-plugin-sdk-2.1.0.tgz`。可从 [引用巡检示例](examples/reference-audit/) 开始。
2. 将 ID 改为「自己的 GitHub 用户名小写.插件名」，更新作者名称、三段版本号和 `engines.workbench`。例如使用 `>=0.1.0 <0.2.0` 限定兼容的工作台。API 2 插件在 `contributions` 中选择位置 `skill.detail` 或 `diagnosis.summary`，以及输出 `panel` 或 `markdown`。
3. 执行 `npx workbench-pack manifest.json activate.js <id>-<version>.json`。将生成文件放入本市场的 `packages/`，提交 PR 到 `master`。主题和报告可直接提交 API 1 JSON。公共市场采用 GitHub 身份与 PR 审核；SDK 中的 `workbench-publish` 供支持直传的私有市场使用。
4. 在 PR 中说明用途、需要的输入、目标位置和验证步骤。维护者检查包内逻辑、身份、版本及兼容范围后合并。部署完成后，用户重新进入市场或点击「刷新市场」即可发现。更新时发布新的文件，历史版本保持原字节。

## 维护与撤回

`npm ci --ignore-scripts && npm run catalog` 在本机生成与 Pages 相同的目录，不执行投稿插件。GitHub Actions 在合并后发布目录与版本包。紧急撤回时由维护者在 `withdrawn.json` 增加完整文件名并合并。下一次部署去掉该包和目录条目，客户端刷新后可安装其余兼容版本。已安装副本仍在用户本机，必要时请通过发行说明告知用户停用。仓库 Git 历史可用于恢复发布资料；再次上架修复应提高版本号。用户下载时由客户端校验 SHA-256。
