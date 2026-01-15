import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI, { toFile } from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const inputPath = process.argv[2] ?? path.join(projectRoot, "resources", "THE CHARACTER.png");
const outputPath = process.argv[3] ?? path.join(projectRoot, "output", "jump_keyframes_4frames.png");

const prompt =
  "You are an animation assistant. Create image with 4 keyframes for the animation sequence of a jumping character that I attached. " +
  "- output a square image " +
  "- make sure that all frames fit into the image " +
  "- make sure that the anatomy of the character is accurate " +
  "- follow this sequence: " +
  "frame 1: character takes off " +
  "frame 2: character reaches the peak of its jump " +
  "frame 3: character is landing " +
  "frame 4: character has landed";

const client = new OpenAI();

const ext = path.extname(inputPath).toLowerCase();
const mimeType =
  ext === ".png"
    ? "image/png"
    : ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : null;

if (!mimeType) {
  throw new Error(`Unsupported image extension for edits: ${ext}. Use .png, .jpg/.jpeg, or .webp`);
}

const response = await client.images.edit({
  image: await toFile(fs.createReadStream(inputPath), path.basename(inputPath), { type: mimeType }),
  prompt,
  model: "gpt-image-1",
  n: 1,
  size: "1024x1024",
  quality: "auto",
  background: "transparent",
  input_fidelity: "high",
});

const b64 = response.data?.[0]?.b64_json;
if (!b64) {
  throw new Error("No image data returned from images.edit.");
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, Buffer.from(b64, "base64"));
console.log(`Wrote: ${outputPath}`);
