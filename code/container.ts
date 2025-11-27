import OpenAI from "openai";
import { CharacterImageDescriber } from "./character-image-describer.js";
import { CharacterImageGenerator } from "./character-image-generator.js";

export class AppContainer {
  private openaiInstance?: OpenAI;

  constructor(private readonly env: NodeJS.ProcessEnv) {}

  private get apiKey(): string {
    const key = this.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error("Missing OPENAI_API_KEY. Add it to a .env file or your environment.");
    }
    return key;
  }

  openai(): OpenAI {
    if (!this.openaiInstance) {
      this.openaiInstance = new OpenAI({ apiKey: this.apiKey });
    }
    return this.openaiInstance;
  }

  characterImageGenerator(): CharacterImageGenerator {
    return new CharacterImageGenerator(this.openai());
  }

  characterImageDescriber(): CharacterImageDescriber {
    return new CharacterImageDescriber(
      this.openai(),  
      new URL("../resources/character_description_template.json", import.meta.url).pathname, 
      new URL("../resources/prompts/character_description_v1.json", import.meta.url).pathname
    );
  }
}
