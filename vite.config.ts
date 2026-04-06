import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { intlExtractPlugin } from "./plugins/vite-plugin-intl-extract";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), intlExtractPlugin()],
});
