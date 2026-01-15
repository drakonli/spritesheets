import fs from "node:fs";
import OpenAI from "openai";
import type { CharacterDescription } from "./character-description.js";

export type ImageDetail = "low" | "high" | "auto";
const IMAGE_DETAIL: ImageDetail = "high";

export interface CharacterImageDescriberApi {
  describeFromBase64(base64Image: string): Promise<CharacterDescription>;
  describeFromPath(filePath: string): Promise<CharacterDescription>;
  updatePoseDescription(description: CharacterDescription, posePrompt: string): Promise<CharacterDescription>;
}

export class CharacterImageDescriber implements CharacterImageDescriberApi {
  constructor(private readonly client: OpenAI, private readonly templatePath: string, private readonly promptPath: string) {}

  private fillMissingFromTemplate(template: unknown, value: unknown): unknown {
    if (Array.isArray(template)) {
      return Array.isArray(value) ? value : template;
    }

    if (typeof template === "object" && template !== null) {
      const templateObj = template as Record<string, unknown>;
      const valueObj =
        typeof value === "object" && value !== null && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {};

      const out: Record<string, unknown> = {};
      for (const [key, templateValue] of Object.entries(templateObj)) {
        out[key] = this.fillMissingFromTemplate(templateValue, valueObj[key]);
      }
      return out;
    }

    if (typeof template === "string") {
      return typeof value === "string" && value.trim().length > 0 ? value : "unknown";
    }

    if (typeof template === "number") {
      return typeof value === "number" ? value : template;
    }

    if (typeof template === "boolean") {
      return typeof value === "boolean" ? value : template;
    }

    return value ?? template;
  }

  private encodeImage(filePath: string): string {
    return fs.readFileSync(filePath, { encoding: "base64" });
  }

  async describeFromBase64(
    base64Image: string,
  ): Promise<CharacterDescription> {
    const templateJson = fs.readFileSync(this.templatePath, "utf8");
    const template = JSON.parse(templateJson);
    const templateString = JSON.stringify(template, null, 2);

    const promptJson = fs.readFileSync(this.promptPath, "utf8");
    const promptDef = JSON.parse(promptJson);

    const developerPrompt = promptDef.developer;

    const userPrompt = promptDef.user_template.replace("{{TEMPLATE_JSON}}", templateString);
    
    const response = await this.client.responses.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      text: { format: { type: "json_object" } },
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: userPrompt },
            {
              type: "input_image",
              image_url: `data:image/png;base64,${base64Image}`,
              detail: IMAGE_DETAIL,
            },
          ],
        },
        {
          role: "developer",
          content: developerPrompt,
        },
      ],
    });

    if (!response.output_text) {
      throw new Error("No description text returned from the image description request.");
    }

    try {
      const parsed = JSON.parse(response.output_text) as unknown;
      const normalized = this.fillMissingFromTemplate(template, parsed);
      return normalized as CharacterDescription;
    } catch (error) {
      throw new Error(
        `Image description response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async updatePoseDescription(
    description: CharacterDescription,
    posePrompt: string,
  ): Promise<CharacterDescription> {
    const descriptionJson = JSON.stringify(description, null, 2);

    const developerPrompt =
      "You are a game art assistant that edits a structured JSON character description.\n" +
      "- The JSON follows a fixed schema for a 2D character, including a `pose` object.\n" +
      "- You MUST return ONLY valid JSON, no markdown, comments, or extra text.\n" +
      "- You MUST keep all non-pose fields identical to the input.\n" +
      "- You MUST update only the `pose` object fields to reflect the user's pose instructions.\n" +
      "- Do not invent new properties; only change values of existing pose fields.";

    const userPrompt =
      `Here is the current character description JSON:\n\n` +
      `${descriptionJson}\n\n` +
      `User pose instructions:\n${posePrompt}\n\n` +
      `Return ONLY JSON. Output MUST be the full character description object (same keys as input), ` +
      `with ONLY the values inside the "pose" object updated to match the requested pose.`;

    const response = await this.client.responses.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      text: { format: { type: "json_object" } },
      input: [
        {
          role: "developer",
          content: developerPrompt,
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
    });

    if (!response.output_text) {
      throw new Error("No updated description text returned from pose update request.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch (error) {
      throw new Error(
        `Pose update response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const pose = this.extractPoseUpdate(parsed, description.pose);
    const merged = JSON.parse(JSON.stringify(description)) as CharacterDescription;
    merged.pose = pose;
    return merged;
  }

  private extractPoseUpdate(
    parsed: unknown,
    fallback: CharacterDescription["pose"],
  ): CharacterDescription["pose"] {
    const isObj = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null && !Array.isArray(v);

    if (!isObj(parsed)) return fallback;

    const candidate = isObj(parsed.pose) ? parsed.pose : parsed;
    if (!isObj(candidate)) return fallback;

    const mergedPose = { ...fallback } as Record<string, unknown>;
    for (const [key, fallbackValue] of Object.entries(fallback)) {
      const value = candidate[key];
      if (typeof fallbackValue === "string" && typeof value === "string") {
        mergedPose[key] = value;
        continue;
      }
      if (Array.isArray(fallbackValue) && Array.isArray(value) && value.every((v) => typeof v === "string")) {
        mergedPose[key] = value;
      }
    }
    return mergedPose as CharacterDescription["pose"];
  }

  async describeFromPath(
    filePath: string,
  ): Promise<CharacterDescription> {
    const base64Image = this.encodeImage(filePath);
    return this.describeFromBase64(base64Image);
  }
}
