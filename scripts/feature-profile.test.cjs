"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { auditSource, auditPackage } = require("../aur/feature-profile.cjs");
const policyPath = path.resolve(__dirname, "../aur/feature-policy.json");
const scriptPath = path.resolve(__dirname, "../aur/feature-profile.cjs");
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "feature-profile-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const policy = { schemaVersion: 1, profile: "test", features: {}, requiredGroups: { remote: ["settings", "picker"] }, settings: {}, nativeArtifacts: [],
    patches: [{ id: "remote-picker", feature: "picker", required: true }] };
  const config = { enabled: ["settings", "picker"], settings: {} };
  function manifest(id, fields = {}, status = "enabled") {
    const file = path.join(root, "linux-features", id, "feature.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ id, ...fields }));
    policy.features[id] = { status, reason: "reviewed test fixture", manifestSha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") };
  }
  manifest("settings");
  manifest("picker", { requires: ["settings"] });
  manifest("other-platform", {}, "excluded");
  return { root, policy, config, manifest };
}
test("all reviewed features are classified and complete capabilities pass", (t) => {
  assert.equal(auditSource(fixture(t)).enabled, 2);
});
test("a new upstream module cannot silently remain disabled", (t) => {
  const f = fixture(t);
  f.manifest("new-feature", {}, "conditional");
  delete f.policy.features["new-feature"];
  assert.throws(() => auditSource(f), /inventory/);
});
test("removed upstream modules require review", (t) => {
  const f = fixture(t);
  fs.rmSync(path.join(f.root, "linux-features/other-platform"), { recursive: true });
  assert.throws(() => auditSource(f), /inventory/);
});
test("omitting the picker while keeping remote settings fails", (t) => {
  const f = fixture(t); f.config.enabled = ["settings"];
  assert.throws(() => auditSource(f), /build configuration/);
});
test("required capability group still fails if policy and config both omit a member", (t) => {
  const f = fixture(t); f.config.enabled = ["settings"]; f.policy.features.picker.status = "conditional";
  assert.throws(() => auditSource(f), /Required capability remote/);
});
test("new dependency must be explicitly enabled", (t) => {
  const f = fixture(t); f.manifest("picker", { requires: ["other-platform"] });
  assert.throws(() => auditSource(f), /requires explicitly/);
});
test("conflicting alternatives cannot be packaged together", (t) => {
  const f = fixture(t); f.manifest("settings", { conflicts: ["picker"] });
  assert.throws(() => auditSource(f), /conflicts/);
});
test("changed manifest/subfeatures require a renewed review", (t) => {
  const f = fixture(t); fs.appendFileSync(path.join(f.root, "linux-features/picker/feature.json"), "\n");
  assert.throws(() => auditSource(f), /Manifest changed/);
});
test("runtime default changes cannot silently enter the build", (t) => {
  const f = fixture(t); f.config.settings = { capture: { enabled: true } };
  assert.throws(() => auditSource(f), /settings differ/);
});
test("new source patch cannot escape review under an existing feature ID", (t) => {
  const f = fixture(t);
  assert.throws(() => auditSource({ ...f, descriptors: ["remote-picker", "new-patch"] }), /source patch inventory/);
});
test("updater may omit disabled source modules but never enabled ones", (t) => {
  const f = fixture(t); f.complete = false;
  fs.rmSync(path.join(f.root, "linux-features/other-platform"), { recursive: true });
  auditSource(f);
  fs.rmSync(path.join(f.root, "linux-features/picker"), { recursive: true });
  assert.throws(() => auditSource(f), /implementation missing/);
});
function packageFixture(t) {
  const f = fixture(t);
  f.manifest("community-features-in-gui-settings");
  f.config.enabled.push("community-features-in-gui-settings");
  const app = path.join(f.root, "app");
  function write(relative, data) {
    const file = path.join(app, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  }
  write(".codex-linux/build-info.json", { linuxFeatures: { enabled: f.config.enabled }, upstreamLinuxPackage: { signatureVerification: "verified", version: "1" } });
  write(".codex-linux/patch-report.json", { enabledFeatures: f.config.enabled, patches: [
    { name: "remote-picker", sourceKind: "feature", featureId: "picker", enforceWhenEnabled: true, status: "applied" },
  ] });
  write("update-builder/packaging/linux/feature-policy.json", f.policy);
  fs.copyFileSync(scriptPath, path.join(app, "update-builder/packaging/linux/feature-profile.cjs"));
  fs.cpSync(path.join(f.root, "linux-features"), path.join(app, "update-builder/linux-features"), { recursive: true });
  write("update-builder/linux-features/features.json", f.config);
  write("update-builder/linux-features/community-features-in-gui-settings/catalog.json", {
    features: Object.keys(f.policy.features).map((id) => ({ id, enabled: f.config.enabled.includes(id) })),
  });
  return { ...f, app, write };
}
test("consistent package, updater and catalog pass together", (t) => {
  assert.equal(auditPackage(packageFixture(t)).enabled, 3);
});
test("packaged build metadata cannot omit a selected feature", (t) => {
  const f = packageFixture(t);
  f.write(".codex-linux/build-info.json", { linuxFeatures: { enabled: ["settings"] } });
  assert.throws(() => auditPackage({ ...f, builderRequired: false }), /packaged build-info/);
});
test("unapplied enabled patch rejects candidate even if declared enabled", (t) => {
  const f = packageFixture(t);
  f.write(".codex-linux/patch-report.json", { enabledFeatures: f.config.enabled, patches: [
    { name: "remote-picker", sourceKind: "feature", featureId: "picker", enforceWhenEnabled: true, status: "warn" },
  ] });
  assert.throws(() => auditPackage({ ...f, builderRequired: false }), /Required patch did not apply/);
});
test("an omitted patch cannot pass by merely listing the feature as enabled", (t) => {
  const f = packageFixture(t);
  f.write(".codex-linux/patch-report.json", { enabledFeatures: f.config.enabled, patches: [] });
  assert.throws(() => auditPackage({ ...f, builderRequired: false }), /packaged patch inventory/);
});
test("updater config drift rejects an otherwise consistent app", (t) => {
  const f = packageFixture(t);
  f.write("update-builder/linux-features/features.json", { enabled: ["settings"], settings: {} });
  assert.throws(() => auditPackage(f), /updater configuration/);
});
test("missing native helper rejects an otherwise consistent app", (t) => {
  const f = packageFixture(t);
  f.policy.nativeArtifacts.push({ feature: "picker", app: "native/missing", builder: "native/missing" });
  assert.throws(() => auditPackage({ ...f, builderRequired: false }), /ENOENT/);
});
test("GUI catalog cannot advertise an omitted capability as installed", (t) => {
  const f = packageFixture(t);
  f.write("update-builder/linux-features/community-features-in-gui-settings/catalog.json", {
    features: Object.keys(f.policy.features).map((id) => ({ id, enabled: true })),
  });
  assert.throws(() => auditPackage(f), /GUI catalog installed state/);
});
test("distribution config and generated inventory stay synchronized", () => {
  const policy = JSON.parse(fs.readFileSync(policyPath));
  const { compareConfig, renderDocs } = require("../aur/feature-profile.cjs");
  compareConfig(JSON.parse(fs.readFileSync(path.resolve(__dirname, "../aur/linux-features.json"))), policy, "committed");
  assert.equal(fs.readFileSync(path.resolve(__dirname, "../docs/FEATURES.md"), "utf8"), renderDocs(policy));
});
