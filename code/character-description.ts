import type characterTemplate from "../resources/character_description_template.json";

type WidenNeverArraysToStringArrays<T> =
  T extends readonly (infer U)[]
    ? U extends never
      ? string[]
      : Array<WidenNeverArraysToStringArrays<U>>
    : T extends object
      ? { [K in keyof T]: WidenNeverArraysToStringArrays<T[K]> }
      : T;

export type CharacterDescription = WidenNeverArraysToStringArrays<typeof characterTemplate>;
