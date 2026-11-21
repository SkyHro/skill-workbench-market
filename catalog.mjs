import { readFile, readdir, mkdir, writeFile, copyFile, lstat, mkdtemp, rename, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validatePlugin, parseEngines } from "@skill-workbench/plugin-sdk";
import { writeMarketPages } from "./market-pages.mjs";
import assert from "node:assert/strict";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const compare = (a,b) => a.version.localeCompare(b.version,"en",{numeric:true});
const pinned = {
  "workbench.palettes-2.0.0.json":"ee8064495524fc35424aecc9181b46a6ba72effadbd710c25acc6fbc9d5151fb",
  "workbench.markdown-2.0.0.json":"25ade764712d5839fef8e8e31fa277b174c41ed0e1105fc52becad8c3cffd1c3"
};
function palette(colors) {
  const luminance = hex => {
    assert.match(hex, /^#[0-9a-f]{6}$/i);
    const [r,g,b] = [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
      .map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
    return .2126*r+.7152*g+.0722*b;
  };
  for (const fg of ["fg","muted","accent"]) for (const bg of ["bg","panel"]) {
    const a=luminance(colors[fg]), b=luminance(colors[bg]);
    assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,"主题文字对比度不足");
  }
  luminance(colors.line);
}
function entry(input, file, sha256) {
  const p = input.kind === "extension" ? validatePlugin(input) : input;
  const {kind,id,version,name,publisher,description,apiVersion,trial} = p;
  assert.match(id,/^[a-z][a-z0-9.-]{0,79}$/);
  assert.match(version,/^\d{1,6}\.\d{1,6}\.\d{1,6}$/);
  assert.equal(file,id+"-"+version+".json");
  for (const [value,max] of [[name,80],[publisher,120],[description,2000]]) {
    assert.ok(typeof value==="string" && value.trim()===value && value.length && value.length<=max);
  }
  const engines=parseEngines(p.engines);
  assert.ok(engines || pinned[file]===sha256,"需要声明 engines.workbench");
  assert.equal(typeof trial,"boolean");
  if (kind==="appearance.theme") {
    assert.equal(apiVersion,1);
    if (p.variants) {
      assert.ok(Array.isArray(p.variants) && p.variants.length && p.variants.length<=64);
      assert.equal(new Set(p.variants.map(v=>v.name)).size,p.variants.length);
      for (const v of p.variants) {
        assert.ok(typeof v.name==="string" && v.name.trim() && v.name.length<=80);
        palette(v.light); palette(v.dark);
      }
    } else { palette(p.light); palette(p.dark); }
  } else if (kind==="appearance.style") {
    assert.equal(apiVersion,3); assert.equal(trial,false); assert.equal(p.preset,"sketch");
    for (const key of ["corners","divider","outline"]) {
      const values = p.ink?.[key];
      assert.ok(Array.isArray(values) && values.length >= 1 && values.length <= 12);
      if (key === "corners") assert.equal(values.length,8);
      assert.ok(values.every(n => Number.isInteger(n) && n >= 1 && n <= 32));
    }
  } else if (kind==="report.markdown") {
    assert.equal(apiVersion,1); assert.equal(trial,false);
    for (const key of ["body","finding","reference","testCase","emptyFindings","emptyCases"])
      assert.equal(typeof p.template[key],"string");
  } else assert.equal(kind,"extension");
  return {id,version,name,publisher,description,kind,apiVersion,trial,...(engines && {engines}),
    ...(kind==="extension" && {contributions:p.contributions}),sha256};
}

const withdrawn = new Set(JSON.parse(await readFile("withdrawn.json","utf8")));
const groups = new Map();
const files=await readdir("packages");
for (const item of withdrawn) assert.ok(files.includes(item),"未知撤回版本 "+item);
for (const key of Object.keys(pinned)) assert.ok(files.includes(key),"缺少官方包 "+key);
const out=await mkdtemp("_site-build-");
try {
  for (const file of files.sort()) {
    const source="packages/"+file;
    const stat=await lstat(source);
    assert.ok(stat.isFile() && stat.size<=131072,"需要 128 KiB 以内的 JSON 文件");
    const bytes=await readFile(source);
    const hash=digest(bytes);
    if (pinned[file]) assert.equal(hash,pinned[file]);
    if (withdrawn.has(file)) continue;
    const p=entry(JSON.parse(bytes),file,hash);
    const rows=groups.get(p.id) || [];
    if(rows.length) assert.ok(p.publisher===rows[0].publisher && p.kind===rows[0].kind,"发布者或类型发生变化");
    rows.push(p); groups.set(p.id,rows);
    await writeFile(out+"/"+file,bytes);
  }
  const plugins=[], previousReleases=[];
  for(const rows of groups.values()) {
    rows.sort(compare); plugins.push(rows.pop()); previousReleases.push(...rows);
  }
  const json=JSON.stringify({schemaVersion:1,plugins,previousReleases});
  assert.ok(Buffer.byteLength(json)<=4*1024*1024 && plugins.length<=5000 && previousReleases.length<=10000,"目录超过客户端容量");
  await writeFile(out+"/index.json",json);
  await writeMarketPages(out, plugins);
  await copyFile("sdk/skill-workbench-plugin-sdk-2.1.0.tgz",out+"/skill-workbench-plugin-sdk-2.1.0.tgz");
  await writeFile(out+"/.nojekyll","");
  await rm("_site",{recursive:true,force:true});
  await rename(out,"_site");
  console.log("已生成插件目录",plugins.length,"个插件，",previousReleases.length,"个历史版本");
} catch(error) { await rm(out,{recursive:true,force:true}); throw error; }
