import fs from "fs";

const packageJsonPath = "package.json";
const manifestPath = "manifest.json";
const versionsPath = "versions.json";

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const versions = JSON.parse(fs.readFileSync(versionsPath, "utf8"));

const version = packageJson.version;
if (!version || typeof version !== "string") {
  throw new Error("package.json version is missing");
}

manifest.version = version;
versions[version] = manifest.minAppVersion;

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
fs.writeFileSync(versionsPath, `${JSON.stringify(versions, null, 2)}\n`);

console.log(`Synced manifest.json and versions.json to version ${version}`);
