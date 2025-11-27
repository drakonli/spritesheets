import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppContainer } from "../code/container.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const characterPath = path.join(projectRoot, "resources", "THE CHARACTER.png");
const targetPath = path.join(projectRoot, "output", "character_new_pose.png");

const container = new AppContainer(process.env);
const generator = container.characterImageGenerator();
const describer = container.characterImageDescriber();

const description = await describer.describeFromPath(characterPath);
console.log("Character description:", description);

// const { raw } = await generator.generateNewPose({
//   inputPath: characterPath,
//   prompt:
//     "Generate an image with changed pose for the 2d character provided in the input: the pose should be neutral, just standing, look to the in front of him ",
// });

// fs.mkdirSync(path.dirname(targetPath), { recursive: true });
// fs.writeFileSync(targetPath, raw);
