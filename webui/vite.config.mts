import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hmrPlugin, presets } from "vite-plugin-web-components-hmr";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    hmrPlugin({
      include: ["./src/**/*.ts"],
      presets: [presets.lit],
    }),
    // Custom plugin for handling the root path redirect
    {
      name: "configure-server",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/") {
            res.writeHead(302, {
              Location: "/src/web-components/demo/index.html",
            });
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    // Define a middleware to handle the root path redirects
    middlewareMode: false,
    fs: {
      // Allow serving files from these directories
      allow: ["/app/webui"],
    },
  },
});
