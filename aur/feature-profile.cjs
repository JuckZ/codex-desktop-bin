#!/usr/bin/env node
"use strict";

// Distribution policy: used by source builds, packaged updater and release CI.
// No third-party dependencies; the updater carries this exact file.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const same = (a, b, label) => assert.deepEqual(a, b, label);
const sorted = (values) => [...values].sort();
const check = (condition, message) => { if (!condition) throw new Error(message); };
function members(actual, expected, label) {
  check(Array.isArray(actual) && new Set(actual).size === actual.length, `${label}: invalid/duplicate IDs`);
  same(sorted(actual), sorted(expected), `${label}: feature omission or unexpected feature`);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function compareConfig(config, policy, label) {
  members(config.enabled, Object.keys(policy.features).filter((id) => policy.features[id].status === "enabled"), label);
  same(canonical(config.settings ?? {}), canonical(policy.settings ?? {}), `${label}: settings differ from reviewed policy`);
  check(Object.keys(config).every((key) => ["enabled", "settings"].includes(key)), `${label}: unknown configuration keys`);
}
function inventory(root) {
  const features = new Map();
  const directory = path.join(root, "linux-features");
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(directory, entry.name, "feature.json");
    if (entry.name === "local") {
      check(fs.readdirSync(path.dirname(file)).length === 0, "Unreviewed local feature directory");
      continue;
    }
    check(fs.existsSync(file), `Unclassified feature directory: ${entry.name}`);
    const manifest = read(file);
    check(manifest.id === entry.name && !features.has(manifest.id), `Invalid manifest identity: ${file}`);
    features.set(manifest.id, { manifest, file });
  }
  return features;
}
function auditSource({ root, policy, config, complete = true, descriptors }) {
  check(policy.schemaVersion === 1, "Unsupported feature policy schema");
  const entries = Object.entries(policy.features);
  check(entries.length > 0, "Empty feature policy");
  for (const [id, rule] of entries) {
    check(["enabled", "conditional", "excluded"].includes(rule.status), `Unclassified feature: ${id}`);
    check(rule.reason?.trim() && /^[a-f0-9]{64}$/.test(rule.manifestSha256), `Missing review evidence: ${id}`);
  }
  compareConfig(config, policy, "build configuration");
  check(Array.isArray(policy.patches), "Missing reviewed patch inventory");
  if (descriptors) members(descriptors, policy.patches.map((p) => p.id), "source patch inventory");
  const enabled = new Set(config.enabled);
  for (const [name, group] of Object.entries(policy.requiredGroups)) {
    check(group.length > 0, `Empty required capability group: ${name}`);
    for (const id of group) check(enabled.has(id), `Required capability ${name} is incomplete: ${id}`);
  }
  const manifests = inventory(root);
  if (complete) members([...manifests.keys()], Object.keys(policy.features), "upstream inventory");
  for (const [id, { manifest, file }] of manifests) {
    check(policy.features[id], `Unclassified new upstream feature: ${id}`);
    same(hash(file), policy.features[id].manifestSha256, `Manifest changed; review dependencies, conflicts and subfeatures: ${id}`);
    if (!enabled.has(id)) continue;
    for (const dependency of manifest.requires ?? [])
      check(enabled.has(dependency), `${id} requires explicitly configured ${dependency}`);
    for (const conflict of manifest.conflicts ?? [])
      check(!enabled.has(conflict), `${id} conflicts with ${conflict}`);
  }
  for (const id of enabled) check(manifests.has(id), `Enabled feature implementation missing: ${id}`);
  // Pure data inspection: release CI must never execute code from the archive.
  // The build also runs the upstream resolver before installing any payload.
  return { profile: policy.profile, total: entries.length, enabled: enabled.size };
}
function executable(file) {
  check(fs.statSync(file).isFile(), `Native helper is not a file: ${file}`);
  fs.accessSync(file, fs.constants.X_OK);
}
function auditPackage({ app, policy, builderRequired = true }) {
  const enabled = Object.keys(policy.features).filter((id) => policy.features[id].status === "enabled");
  const info = read(path.join(app, ".codex-linux/build-info.json"));
  members(info.linuxFeatures?.enabled, enabled, "packaged build-info");
  same(info.upstreamLinuxPackage?.signatureVerification, "verified", "Official signature verification must remain enabled");
  const report = read(path.join(app, ".codex-linux/patch-report.json"));
  members(report.enabledFeatures, enabled, "packaged patch-report");
  members(report.patches.filter((p) => p.sourceKind === "feature").map((p) => p.name),
    policy.patches.map((p) => p.id), "packaged patch inventory");
  for (const expected of policy.patches) {
    const actual = report.patches.find((p) => p.name === expected.id);
    same(actual.featureId, expected.feature, `Patch attributed to wrong feature: ${expected.id}`);
    if (expected.required)
      check(["applied", "already-applied"].includes(actual.status),
        `Required patch did not apply: ${actual.name} (${actual.status})`);
  }
  for (const patch of report.patches) {
    if (patch.sourceKind === "feature")
      check(enabled.includes(patch.featureId), `Patch from an unselected feature: ${patch.name}`);
    if (patch.sourceKind === "core")
      check(["applied", "already-applied"].includes(patch.status), `Required patch did not apply: ${patch.name} (${patch.status})`);
  }
  const builder = path.join(app, "update-builder");
  if (builderRequired) {
    same(read(path.join(builder, "packaging/linux/feature-policy.json")), policy, "Updater policy drift");
    same(hash(path.join(builder, "packaging/linux/feature-profile.cjs")), hash(__filename), "Updater audit code drift");
    const config = read(path.join(builder, "linux-features/features.json"));
    compareConfig(config, policy, "updater configuration");
    // The updater intentionally carries only enabled implementations.
    auditSource({ root: builder, policy, config, complete: false });
    const catalog = read(path.join(builder, "linux-features/community-features-in-gui-settings/catalog.json"));
    members(catalog.features.map((f) => f.id),
      Object.keys(policy.features).filter((id) => policy.features[id].public !== false), "GUI catalog inventory");
    members(catalog.features.filter((f) => f.enabled).map((f) => f.id), enabled, "GUI catalog installed state");
  }
  for (const artifact of policy.nativeArtifacts) {
    if (!enabled.includes(artifact.feature)) continue;
    executable(path.join(app, artifact.app));
    if (builderRequired) {
      executable(path.join(builder, artifact.builder));
      same(hash(path.join(app, artifact.app)), hash(path.join(builder, artifact.builder)),
        `Updater native helper differs: ${artifact.feature}`);
    }
  }
  return { profile: policy.profile, enabled: enabled.length, upstreamVersion: info.upstreamLinuxPackage.version };
}
function renderDocs(policy) {
  const counts = Object.fromEntries(["enabled", "conditional", "excluded"].map((s) =>
    [s, Object.values(policy.features).filter((f) => f.status === s).length]));
  return `# CachyOS / KDE 完整功能配置\n\n` +
    `由 \`aur/feature-policy.json\` 生成。审阅基线：\`${policy.reviewedUpstream}\`。\n\n` +
    `共 ${Object.keys(policy.features).length} 个模块：随包安装 ${counts.enabled}，需满足条件后另行选择 ${counts.conditional}，明确排除 ${counts.excluded}。\n\n` +
    `“已安装”表示能力及相应入口已打包，不表示已授权、已连接、正在录制或已下载外部模型。设置 → 通用 → 社区功能可查看安装状态和子功能；运行时状态需在相应功能中查看。\n\n` +
    `上游新增/删除模块、已审阅 manifest 改变、依赖/冲突、必需能力组缺失、原生程序缺失、包与更新器配置不一致都会阻止构建。签名校验和补丁接受检查保持开启。更新策略必须同时修改清单与配置并通过测试。\n\n` +
    `| 模块 | 构建分类 | 原因与使用条件 |\n| --- | --- | --- |\n` +
    Object.entries(policy.features).map(([id, f]) => `| \`${id}\` | ${f.status} | ${f.reason} |`).join("\n") +
    `\n\nUI Tweaks 的九个子功能均有显式配置：字体大小、手动字体、建议提示、选中文本解释、注释提交启用；图标选择、英文强度标签、侧栏样式和未适配当前官方包的模型列表替换关闭。\n\n` +
    `远程电脑入口还遵循官方项目兼容条件。验收时从未选择本地项目的新聊天打开“工作位置”；可用远程主机取决于同账户配对与在线状态。\n`;
}
function main() {
  const [mode, target, configPath] = process.argv.slice(2);
  const policy = read(path.join(__dirname, "feature-policy.json"));
  if (mode === "docs") return process.stdout.write(renderDocs(policy));
  check(target, "Usage: feature-profile.cjs source|configured|package|app <root> [config]");
  const root = path.resolve(target);
  const configFile = configPath || process.env.CODEX_LINUX_FEATURES_CONFIG || path.join(root, "linux-features/features.json");
  const result = ["source", "configured"].includes(mode)
    ? auditSource({
      root, policy, complete: mode === "source",
      config: read(configFile),
      // Source/updater builds already execute these implementations. Release
      // package inspection below reads data only and never reaches this branch.
      descriptors: require(path.join(root, "scripts/lib/linux-features.js"))
        .loadLinuxFeaturePatchDescriptors({
          featuresRoot: path.join(root, "linux-features"), featuresConfigPath: configFile,
        }).map((p) => p.id),
    })
    : ["package", "app"].includes(mode)
      ? auditPackage({ app: root, policy, builderRequired: mode === "package" })
      : (() => { throw new Error(`Unknown audit mode: ${mode}`); })();
  console.log(`Feature profile verified: ${JSON.stringify(result)}`);
}
module.exports = { auditSource, auditPackage, compareConfig, renderDocs };
if (require.main === module) {
  try { main(); }
  catch (error) { console.error(`Feature profile rejected: ${error.message}`); process.exitCode = 1; }
}
