import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppContainer } from "../code/container.js";
import type { CharacterDescription } from "../code/character-description.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const characterPath = path.join(projectRoot, "resources", "THE CHARACTER.png");
const targetPath = path.join(projectRoot, "output", "character_new_pose.png");

const container = new AppContainer(process.env);
const generator = container.characterVariantGenerator();
const describer = container.characterImageDescriber();

const originalDescription: CharacterDescription = await describer.describeFromPath(characterPath);

console.log("----original description----");
console.log(JSON.stringify(originalDescription, null, 2));

const variantDescription = await describer.updatePoseDescription(
  originalDescription,
  "Mid air jump"
);

console.log("----variant description----");
console.log(JSON.stringify(variantDescription, null, 2));

const { raw } = await generator.generateCharacterVariant({
  inputPath: characterPath,
  originalDescription,
  variantDescription,
});

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, raw);
