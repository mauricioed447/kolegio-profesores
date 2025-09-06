import { defineConfig } from "vite";
import react from "@vitejs/plugin-react"; // <-- ESTA ES LA LÍNEA CORREGIDA
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
