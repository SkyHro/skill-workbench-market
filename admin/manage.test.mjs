import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtemp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

test("管理员独立验证和可重试的插件撤回、恢复",async t => {
  const cwd=await mkdtemp(path.join(tmpdir(),"market-admin-"));
  t.after(()=>rm(cwd,{recursive:true,force:true}));
  const script=fileURLToPath(new URL("./manage.mjs",import.meta.url));
  const plugin="example.demo-1.0.0.json";
  await mkdir(path.join(cwd,"packages"));
  await writeFile(path.join(cwd,"packages",plugin),"{}");
  await writeFile(path.join(cwd,"withdrawn.json"),"[]");
  function run(operation,stage="prepare",name=plugin){
    execFileSync(process.execPath,[script,stage],{cwd,stdio:"pipe",env:{...process.env,OPERATION:operation,PLUGIN_FILE:name}});
  }
  const json=async name=>JSON.parse(await readFile(path.join(cwd,name),"utf8"));
  run("verify");
  await assert.rejects(json(".market-state/state.json"),{code:"ENOENT"});
  assert.throws(()=>run("withdraw-plugin","prepare","../invalid"));
  run("withdraw-plugin"); run("withdraw-plugin"); run("withdraw-plugin","materialize");
  assert.deepEqual(await json("withdrawn.json"),[plugin]);
  // A fresh workflow checkout reads the repository ban list separately from admin state.
  await writeFile(path.join(cwd,"withdrawn.json"),"[]");
  run("publish-plugin"); run("publish-plugin","materialize");
  assert.deepEqual(await json("withdrawn.json"),[]);
  await writeFile(path.join(cwd,"withdrawn.json"),JSON.stringify([plugin]));
  assert.throws(()=>run("publish-plugin"));
});
