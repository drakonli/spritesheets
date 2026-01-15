import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const cacheDir = path.join(projectRoot, "cache", "character-image-describer");

if (!fs.existsSync(cacheDir)) {
  console.log(`No cache directory found at: ${cacheDir}`);
  process.exit(0);
}

fs.rmSync(cacheDir, { recursive: true, force: true });
console.log(`Cleared CharacterImageDescriber cache at: ${cacheDir}`);

