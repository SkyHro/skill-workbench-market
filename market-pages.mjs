import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { legacyWorkbenchRange } from "@skill-workbench/plugin-sdk";

const labels = {
  extension: "工作台扩展",
  "appearance.theme": "主题配色",
  "report.markdown": "报告导出",
};

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function pluginRow(plugin) {
  return `<li><a class="plugin" href="plugins/${plugin.id}.html">
    <h3>${escapeHtml(plugin.name)}</h3>
    <span class="meta">${labels[plugin.kind]} · ${escapeHtml(plugin.publisher)}</span>
    <span class="description">${escapeHtml(plugin.description)}</span>
    <span class="arrow" aria-hidden="true">›</span>
  </a></li>`;
}

function details(plugin) {
  const fields = [
    ["发布者", plugin.publisher], ["类型", labels[plugin.kind]], ["插件版本", plugin.version],
    ["兼容的工作台版本", plugin.engines?.workbench ?? legacyWorkbenchRange],
    ["免安装试用", plugin.trial ? "支持" : "不支持"], ["插件 ID", plugin.id],
  ];
  const contributions = (plugin.contributions ?? []).map(item => {
    const slot = item.slot === "skill.detail" ? "安装实例详情" : "健康诊断";
    return `<li>${escapeHtml(item.title)} · ${slot}</li>`;
  });
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(plugin.name)} · Skill 工作台插件市场</title><link rel="stylesheet" href="../market.css"></head>
<body><main class="detail"><a class="back" href="../index.html">‹ 返回插件市场</a>
<h1>${escapeHtml(plugin.name)}</h1><p class="intro">${escapeHtml(plugin.description)}</p>
<dl>${fields.map(([key,value]) => `<dt>${key}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>
${contributions.length ? `<h2>提供的功能</h2><ul>${contributions.join("")}</ul>` : ""}
<p>在客户端的「插件市场」搜索「${escapeHtml(plugin.name)}」，即可查看适用于当前工作台的版本。</p>
</main></body></html>`;
}

export async function writeMarketPages(out, plugins) {
  const template = await readFile("index.html", "utf8");
  const list = plugins.length ? `<ul class="catalog">${plugins.map(pluginRow).join("")}</ul>` : "<p>暂无已上架插件。</p>";
  await writeFile(out + "/index.html", template.replace("<!-- plugin-list -->", () => list));
  await copyFile("market.css", out + "/market.css");
  await mkdir(out + "/plugins");
  for (const plugin of plugins) await writeFile(out + "/plugins/" + plugin.id + ".html", details(plugin));
}
