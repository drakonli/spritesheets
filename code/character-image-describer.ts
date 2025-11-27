import fs from "node:fs";
import OpenAI from "openai";

export type ImageDetail = "low" | "high" | "auto";

export class CharacterImageDescriber {
  constructor(private readonly client: OpenAI, private readonly templatePath: string, private readonly promptPath: string) {}

  private encodeImage(filePath: string): string {
    return fs.readFileSync(filePath, { encoding: "base64" });
  }

  async describeFromBase64(
    base64Image: string,
    detail: ImageDetail = "high",
  ): Promise<string> {
    const templateJson = fs.readFileSync(this.templatePath, "utf8");
    const template = JSON.parse(templateJson);
    const templateString = JSON.stringify(template, null, 2);

    const promptJson = fs.readFileSync(this.promptPath, "utf8");
    const promptDef = JSON.parse(promptJson);

    const developerPrompt = promptDef.developer;

    const userPrompt = promptDef.user_template.replace("{{TEMPLATE_JSON}}", templateString);

    console.log(userPrompt);
    console.log(developerPrompt);
    
    const response = await this.client.responses.create({
      model: "gpt-4.1-mini",
      "temperature": 0,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: userPrompt },
            {
              type: "input_image",
              image_url: `data:image/png;base64,${base64Image}`,
              detail,
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

    return response.output_text;
  }

  async describeFromPath(
    filePath: string,
    detail: ImageDetail = "high",
  ): Promise<string> {
    const base64Image = this.encodeImage(filePath);
    return this.describeFromBase64(base64Image, detail);
  }
}
