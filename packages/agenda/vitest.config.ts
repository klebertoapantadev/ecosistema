import { mergeConfig, defineConfig } from "vitest/config";
import { vitestBaseConfig } from "@eco/config/vitest.base.mjs";

export default mergeConfig(defineConfig(vitestBaseConfig), defineConfig({}));
