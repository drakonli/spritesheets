import fs from "node:fs";
import OpenAI from "openai";
import type characterTemplate from "../resources/character_description_template.json";

export type CharacterDescription = typeof characterTemplate;

export type NewPoseOptions = {
  inputPath: string;
  prompt: string;
  characterDescription: CharacterDescription;
};

export type GeneratedImage = {
  base64: string;
  raw: Buffer;
};

type ImageGenerationCall = {
  id: string;
  status: "in_progress" | "completed" | "generating" | "failed";
  type: "image_generation_call";
  result: string | null;
};

export class CharacterImageGenerator {
  constructor(private readonly client: OpenAI) {}

  private encodeImage(filePath: string): string {
    return fs.readFileSync(filePath, { encoding: "base64" });
  }

  async generateNewPose({
    inputPath,
    prompt,
    characterDescription,
  }: NewPoseOptions): Promise<GeneratedImage> {
    const base64Image = this.encodeImage(inputPath);
    const characterDescriptionText = JSON.stringify(characterDescription, null, 2);
    const fullPrompt = `${prompt.trim()}\n\nCharacter description (JSON for the character whose pose you must change, keep all invariant details consistent):\n${characterDescriptionText}`;

    const response = await this.client.responses.create({
      model: "gpt-5",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: fullPrompt },
            {
              type: "input_image",
              image_url: `data:image/png;base64,${base64Image}`,
              detail: "high",
            },
          ],
        },
      ],
      tools: [{ type: "image_generation", input_fidelity: "high", background: "transparent" }],
    });

    const images = Array.isArray(response.output)
      ? response.output
          .filter((output): output is ImageGenerationCall => output.type === "image_generation_call")
          .map((output) => output.result)
          .filter((result): result is string => typeof result === "string")
      : [];

    if (images.length === 0) {
      throw new Error("No image data returned from image generation.");
    }

    const imageBase64 = images[0];
    return {
      base64: imageBase64,
      raw: Buffer.from(imageBase64, "base64"),
    };
  }
}
