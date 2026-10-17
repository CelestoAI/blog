import { resolve } from "node:path";
import { isRunnableDevEnvironment, type Plugin } from "vite";

export default function contentReload(): Plugin {
  return {
    name: "blog-content-reload",
    apply: "serve",
    configureServer(server) {
      const storePath = resolve(server.config.root, ".astro/data-store.json");
      const refresh = (file: string) => {
        if (file !== storePath) return;

        const id = "\0astro:data-layer-content";
        // Astro 7.1 invalidates SSR only; Cloudflare also uses Node environments.
        for (const environment of Object.values(server.environments)) {
          if (environment.name === "client" || environment.name === "ssr")
            continue;
          const module = environment.moduleGraph.getModuleById(id);
          if (module) environment.moduleGraph.invalidateModule(module);
          if (isRunnableDevEnvironment(environment)) {
            const evaluated =
              environment.runner.evaluatedModules.getModuleById(id);
            if (evaluated) {
              environment.runner.evaluatedModules.invalidateModule(evaluated);
            }
          }
          environment.hot.send("astro:content-changed", {});
        }
        server.environments.client.hot.send({ type: "full-reload", path: "*" });
      };
      server.watcher.on("add", refresh);
      server.watcher.on("change", refresh);
      server.httpServer?.once("close", () => {
        server.watcher.off("add", refresh);
        server.watcher.off("change", refresh);
      });
    },
  };
}
