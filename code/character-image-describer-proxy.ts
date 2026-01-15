import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import type { CharacterImageDescriberApi } from "./character-image-describer.js";
import type { CharacterDescription } from "./character-description.js";

type CacheEntry<T> = {
  createdAtMs: number;
  value: T;
};

export type CachingCharacterImageDescriberProxyOptions = {
  cacheTtlMs?: number;
  cacheRootDir?: string;
};

export const CHARACTER_IMAGE_DESCRIBER_CACHE_TTL_MINUTES = 60;

export class CachingCharacterImageDescriberProxy implements CharacterImageDescriberApi {
  private readonly cacheDir: string;
  private readonly cacheTtlMs: number;

  constructor(
    private readonly target: CharacterImageDescriberApi,
    options: CachingCharacterImageDescriberProxyOptions = {},
  ) {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(moduleDir, "..");
    const cacheRoot = options.cacheRootDir ?? path.join(projectRoot, "cache");

    this.cacheDir = path.join(cacheRoot, "character-image-describer");
    this.cacheTtlMs =
      options.cacheTtlMs ?? CHARACTER_IMAGE_DESCRIBER_CACHE_TTL_MINUTES * 60 * 1000;
  }

  private ensureCacheDir(): void {
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  private sha256(input: string | Buffer): string {
    return crypto.createHash("sha256").update(input).digest("hex");
  }

  private cachePathForKey(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  private invalidateCache(key: string): void {
    const cachePath = this.cachePathForKey(key);
    try {
      fs.unlinkSync(cachePath);
    } catch {
      // ignore
    }
  }

  private readCache<T>(key: string): T | null {
    const cachePath = this.cachePathForKey(key);
    if (!fs.existsSync(cachePath)) return null;

    try {
      const raw = fs.readFileSync(cachePath, "utf8");
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (!entry || typeof entry.createdAtMs !== "number") return null;

      const ageMs = Date.now() - entry.createdAtMs;
      if (ageMs > this.cacheTtlMs) {
        try {
          fs.unlinkSync(cachePath);
        } catch {
          // ignore
        }
        return null;
      }

      return entry.value ?? null;
    } catch {
      return null;
    }
  }

  private writeCache<T>(key: string, value: T): void {
    this.ensureCacheDir();
    const cachePath = this.cachePathForKey(key);
    const tmpPath = `${cachePath}.tmp`;

    const entry: CacheEntry<T> = { createdAtMs: Date.now(), value };
    fs.writeFileSync(tmpPath, JSON.stringify(entry, null, 2), "utf8");
    fs.renameSync(tmpPath, cachePath);
  }

  private isCharacterDescription(value: unknown): value is CharacterDescription {
    const isObj = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null && !Array.isArray(v);

    if (!isObj(value)) return false;

    const requiredKeys: Array<keyof CharacterDescription> = [
      "character_id",
      "one_line_summary",
      "pose",
      "art_style",
      "body_base",
      "head_and_face",
      "hair",
      "outfit",
      "equipment_and_props",
      "color_palette",
      "rendering_constraints",
    ];

    if (!requiredKeys.every((k) => k in value)) return false;

    const pose = value.pose;
    if (!isObj(pose)) return false;

    const requiredPoseKeys: Array<keyof CharacterDescription["pose"]> = [
      "overall_pose",
      "action",
      "motion_state",
      "is_airborne",
      "movement_direction",
      "speed_or_intensity",
      "ground_contact_points",
      "weight_shift_and_balance",
      "body_orientation",
      "head_orientation",
      "gaze_direction",
      "arm_positions",
      "leg_positions",
      "facial_expression",
      "camera_movement_or_zoom",
    ];

    return requiredPoseKeys.every((k) => k in pose);
  }

  async describeFromBase64(base64Image: string): Promise<CharacterDescription> {
    const imageFingerprint = this.sha256(base64Image);
    const key = this.sha256(`describeFromBase64|img=${imageFingerprint}`);

    const cached = this.readCache<CharacterDescription>(key);
    if (cached !== null) {
      if (this.isCharacterDescription(cached)) return cached;
      this.invalidateCache(key);
    }

    const result = await this.target.describeFromBase64(base64Image);
    this.writeCache(key, result);
    return result;
  }

  async describeFromPath(filePath: string): Promise<CharacterDescription> {
    const base64Image = fs.readFileSync(filePath, { encoding: "base64" });
    return this.describeFromBase64(base64Image);
  }

  async updatePoseDescription(
    description: CharacterDescription,
    posePrompt: string,
  ): Promise<CharacterDescription> {
    const descriptionFingerprint = this.sha256(JSON.stringify(description));
    const promptFingerprint = this.sha256(posePrompt);
    const key = this.sha256(`updatePoseDescription|desc=${descriptionFingerprint}|prompt=${promptFingerprint}`);

    const cached = this.readCache<CharacterDescription>(key);
    if (cached !== null) {
      if (this.isCharacterDescription(cached)) return cached;
      this.invalidateCache(key);
    }

    const updated = await this.target.updatePoseDescription(description, posePrompt);
    this.writeCache(key, updated);
    return updated;
  }
}
