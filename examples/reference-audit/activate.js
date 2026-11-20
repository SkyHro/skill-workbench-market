function activate({ contributionId, skill }) {
  const broken = skill.references.filter(ref => ["missing", "unreadable"].includes(ref.kind)).length;
  const summary = skill.name + " 共 " + skill.references.length + " 条引用，其中 " + broken + " 条需要处理。";
  if (contributionId === "report") return "# 引用巡检\n\n" + summary + "\n";
  return summary;
}
