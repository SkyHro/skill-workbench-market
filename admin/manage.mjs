// Operations run only in the checked-out market repository. Inputs are data, never shell scripts.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createReadStream, existsSync} from "node:fs";
import {readFile, writeFile, copyFile, mkdir, mkdtemp, rm, readdir, appendFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";

const repo = process.env.GITHUB_REPOSITORY || "SkyHro/skill-workbench-market";
const base = "https://skyhro.github.io/skill-workbench-market/";
const dir = ".market-state";
const config = path.join(dir,"state.json");
const json = async file => JSON.parse(await readFile(file, "utf8"));
const state = existsSync(config) ? await json(config) : {client:"0.1.0", withdrawn:[]};
state.withdrawnClients ??= [];
const action = process.env.OPERATION || "verify";
const version = process.env.CLIENT_VERSION || "";
const plugin = process.env.PLUGIN_FILE || "";
const tag = process.env.STAGING_TAG || "";
const publishClient = ["publish-client","publish-both"].includes(action);
const publishPlugin = ["publish-plugin","publish-both"].includes(action);
const withdrawClient = action === "withdraw-client";
const withdrawPlugin = action === "withdraw-plugin";
const gh = args => execFileSync("gh", [...args, "--repo", repo], {encoding:"utf8", stdio:["ignore","pipe","inherit"]});
const log = async text => {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text+"\n\n");
};
const digest = data => createHash("sha256").update(data).digest("hex");
const fileHash = async file => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
};

function validateInputs() {
  assert.ok(["publish-client","publish-plugin","publish-both","withdraw-client","withdraw-plugin","verify"].includes(action),"未知操作");
  if (publishClient || withdrawClient) assert.match(version,/^\d{1,6}\.\d{1,6}\.\d{1,6}$/);
  if (publishPlugin || withdrawPlugin) assert.match(plugin,/^[a-z][a-z0-9.-]{0,79}-\d{1,6}\.\d{1,6}\.\d{1,6}\.json$/);
  if (tag) assert.match(tag,/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/);
}
async function validateClient(v, requirePublic) {
  const name = "skill-workbench-"+v+"-macos-arm64.zip";
  const release = JSON.parse(gh(["release","view","client-v"+v,"--json","isDraft,assets"]));
  if (requirePublic) assert.equal(release.isDraft,false,"客户端 Release 尚未发布");
  const archive = release.assets.find(a => a.name === name);
  assert.ok(archive?.size > 0 && release.assets.some(a => a.name === name+".sha256"),"缺少客户端 ZIP 或 SHA-256 文件");
  const temp = await mkdtemp(path.join(tmpdir(),"market-verify-"));
  try {
    gh(["release","download","client-v"+v,"--pattern",name,"--pattern",name+".sha256","--dir",temp]);
    const expected = (await readFile(path.join(temp,name+".sha256"),"utf8")).trim().split(/\s+/);
    const hash = await fileHash(path.join(temp,name));
    assert.deepEqual(expected,[hash,name],"客户端校验文件与下载的 ZIP 不符");
    if (archive.digest) assert.equal(archive.digest,"sha256:"+hash);
    execFileSync("unzip",["-tq",path.join(temp,name)],{stdio:"ignore"});
    await log("客户端 "+v+" ZIP 完整，SHA-256 `"+hash+"`");
  } finally {await rm(temp,{recursive:true,force:true});}
}
async function prepare() {
  validateInputs();
  if (publishClient) await validateClient(version,false);
  if (withdrawClient) {
    assert.ok(state.client === version || (state.client === null && state.withdrawnClients.includes(version)), "请填写当前分发的客户端版本");
    gh(["release","view","client-v"+version,"--json","tagName"]);
    state.client = null;
    if (!state.withdrawnClients.includes(version)) state.withdrawnClients.push(version);
  }
  if (publishPlugin || withdrawPlugin) {
    const managed = path.join(dir,"packages",plugin);
    const reviewed = path.join("packages",plugin);
    if (publishPlugin && tag) {
      const temp = await mkdtemp(path.join(tmpdir(),"market-plugin-"));
      try {
        gh(["release","download",tag,"--pattern",plugin,"--dir",temp]);
        const incoming = await readFile(path.join(temp,plugin));
        assert.ok(incoming.length <= 131072,"插件过大");
        for (const file of [managed,reviewed]) if (existsSync(file)) assert.ok(incoming.equals(await readFile(file)),"同版本的插件内容不能改变");
        if (!existsSync(reviewed)) {
          await mkdir(path.dirname(managed),{recursive:true});
          await writeFile(managed,incoming);
        }
      } finally {await rm(temp,{recursive:true,force:true});}
    }
    assert.ok(existsSync(managed) || existsSync(reviewed),"未找到该版本。发布新包请指定已上传附件的 Release 标签");
    if (publishPlugin) assert.ok(!(await json("withdrawn.json")).includes(plugin),"仓库已撤回此包，请发布修复版本");
    state.withdrawn = state.withdrawn.filter(f => f !== plugin);
    if (withdrawPlugin) state.withdrawn.push(plugin);
  }
  if (publishClient) {
    state.client = version;
    state.withdrawnClients = state.withdrawnClients.filter(v => v !== version);
  }
  if (action !== "verify") {
    await mkdir(dir,{recursive:true});
    await writeFile(config,JSON.stringify(state,null,2)+"\n");
  }
}
async function materialize() {
  const folder = path.join(dir,"packages");
  if (existsSync(folder)) for (const name of await readdir(folder)) {
    const source = path.join(folder,name), target = path.join("packages",name);
    if (existsSync(target)) assert.ok((await readFile(source)).equals(await readFile(target)),"同版本包冲突");
    else await copyFile(source,target);
  }
  await writeFile("withdrawn.json",JSON.stringify([...new Set([...(await json("withdrawn.json")),...state.withdrawn])]));
}
async function publicBytes(url) {
  const response = await fetch(url,{signal:AbortSignal.timeout(30000),cache:"no-store"});
  assert.ok(response.ok,response.status+" "+url);
  return Buffer.from(await response.arrayBuffer());
}
async function verify() {
  const expected = await json("_site/index.json");
  // Pages edges can briefly serve the previous deployment; only accept the exact generated snapshot.
  let ready = false;
  for (let i=0; i<12; i++) {
    try {
      const query = "?verify="+Date.now();
      assert.deepEqual(JSON.parse(await publicBytes(base+"index.json"+query)),expected);
      assert.equal((await publicBytes(base+query)).toString(),await readFile("_site/index.html","utf8"));
      ready = true; break;
    } catch(e) { if (i===11) throw e; await new Promise(resolve=>setTimeout(resolve,5000)); }
  }
  assert.ok(ready);
  for (const p of [...expected.plugins,...expected.previousReleases]) {
    const name = p.id+"-"+p.version+".json";
    assert.equal(digest(await publicBytes(base+name)),p.sha256,name+" 摘要不一致");
    await log("已核对插件 `"+name+"`");
  }
  for (const name of await json("withdrawn.json")) {
    const res = await fetch(base+name+"?verify="+Date.now(),{signal:AbortSignal.timeout(30000)});
    assert.equal(res.status,404,"已撤回插件仍可下载："+name);
  }
  if (state.client) await validateClient(state.client,true);
  for (const v of state.withdrawnClients) {
    const release = JSON.parse(gh(["release","view","client-v"+v,"--json","isDraft"]));
    assert.equal(release.isDraft,true,"已撤回的客户端仍公开："+v);
  }
  await log("公网首页、目录、下载包及撤回状态验证通过");
}
switch(process.argv[2]) {
  case "prepare": await prepare(); break;
  case "materialize": await materialize(); break;
  case "publish-client":
    if (publishClient && JSON.parse(gh(["release","view","client-v"+version,"--json","isDraft"])).isDraft)
      gh(["release","edit","client-v"+version,"--draft=false"]);
    break;
  case "withdraw-client":
    if (withdrawClient) gh(["release","edit","client-v"+version,"--draft=true"]);
    break;
  case "verify": await verify(); break;
  default: throw Error("未知阶段");
}
