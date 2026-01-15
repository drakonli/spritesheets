import fs from "node:fs";
import OpenAI from "openai";
import type { CharacterDescription } from "./character-description.js";

export type GenerateCharacterVariantOptions = {
  inputPath: string;
  originalDescription: CharacterDescription;
  variantDescription: CharacterDescription;
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

export class CharacterVariantGenerator {
  constructor(private readonly client: OpenAI) {}

  private encodeImage(filePath: string): string {
    return fs.readFileSync(filePath, { encoding: "base64" });
  }

  async generateCharacterVariant({
    inputPath,
    originalDescription,
    variantDescription,
  }: GenerateCharacterVariantOptions): Promise<GeneratedImage> {
    const base64Image = this.encodeImage(inputPath);
    const originalDescriptionText = JSON.stringify(originalDescription, null, 2);
    const variantDescriptionText = JSON.stringify(variantDescription, null, 2);

    const promptText =
      "You are a game art assistant that generates a new 2D character sprite variant from a base sprite.\n\n" +
      "You are given:\n" +
      "- A reference sprite image (the input image).\n" +
      "- A JSON description of the original character that matches the reference sprite.\n" +
      "- A JSON description of the desired character variant.\n\n" +
      "Rules:\n" +
      "- Use the original JSON and image as the canonical source of style and invariant details.\n" +
      "- Compare the original and variant JSON objects.\n" +
      "- Only change visual aspects that differ between the original and variant JSON.\n" +
      "- Keep all other visual details identical (art style, proportions, colors, etc.).\n" +
      "- The output should be a full-body sprite of the variant character on a transparent background in the same style as the reference image.\n";

    const userText =
      `${promptText}\n` +
      `Original character JSON:\n${originalDescriptionText}\n\n` +
      `Target variant JSON:\n${variantDescriptionText}\n`;

    const response = await this.client.responses.create({
      model: "gpt-5.2",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: userText },
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
