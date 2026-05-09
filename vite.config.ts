import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    exclude: ["tegaki", "tegaki/fonts/parisienne"],
  },
  plugins: [react(), tailwindcss()],
});
