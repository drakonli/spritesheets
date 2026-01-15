import OpenAI from "openai";
import type { CharacterImageDescriberApi } from "./character-image-describer.js";
import { CharacterImageDescriber } from "./character-image-describer.js";
import { CachingCharacterImageDescriberProxy } from "./character-image-describer-proxy.js";
import { CharacterVariantGenerator } from "./character-variant-generator.js";

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

  characterVariantGenerator(): CharacterVariantGenerator {
    return new CharacterVariantGenerator(this.openai());
  }

  characterImageDescriber(): CharacterImageDescriberApi {
    const templatePath = new URL("../resources/character_description_template.json", import.meta.url).pathname;
    const promptPath = new URL("../resources/prompts/character_description_v1.json", import.meta.url).pathname;

    const describer = new CharacterImageDescriber(this.openai(), templatePath, promptPath);
    return new CachingCharacterImageDescriberProxy(describer);
  }
}
