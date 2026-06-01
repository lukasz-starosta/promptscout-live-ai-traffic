#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const packageName = packageJson.name;
const packageVersion = packageJson.version;
const tagName = process.env.GITHUB_REF_NAME ?? "";
const refType = process.env.GITHUB_REF_TYPE ?? "";
const expectedTag = `v${packageVersion}`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

if (refType !== "tag") {
  console.log("Release tag verification skipped for non-tag workflow ref.");
  process.exit(0);
}

if (!/^\d+\.\d+\.\d+$/.test(packageVersion)) {
  fail(
    "Prerelease package versions are not supported by this release workflow.",
  );
}

if (tagName !== expectedTag) {
  fail(
    `Release tag must match package.json version. Expected ${expectedTag}, got ${tagName}.`,
  );
}

const mainCheck = run("git", [
  "merge-base",
  "--is-ancestor",
  "HEAD",
  "origin/main",
]);
if (mainCheck.status !== 0) {
  fail("Release tag commit must be reachable from origin/main.");
}

const npmView = run("npm", [
  "view",
  `${packageName}@${packageVersion}`,
  "version",
  "--registry=https://registry.npmjs.org",
]);

if (npmView.status === 0) {
  fail(`${packageName}@${packageVersion} is already published.`);
}

const registryOutput = `${npmView.stdout}\n${npmView.stderr}`;
if (!/E404|404|No match found/i.test(registryOutput)) {
  fail(
    `Unable to verify whether ${packageName}@${packageVersion} is already published.`,
  );
}

console.log(
  `${packageName}@${packageVersion} is ready to publish from ${tagName}.`,
);
