import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: ["**/recipe-modal-position.spec.ts", "**/modal-position.spec.ts"],
  use: { baseURL: "http://127.0.0.1:3100", headless: true },
  projects: [
    {
      name: "iphone-safari",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
  ],
});
