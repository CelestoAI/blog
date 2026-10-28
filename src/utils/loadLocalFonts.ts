import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const fontDirectory = join(
  dirname(require.resolve("geist/font/sans")),
  "fonts/geist-sans"
);

// Load once per build process; social cards need no external font requests.
const fonts = Promise.all(
  (
    [
      ["Regular", 400],
      ["SemiBold", 600],
    ] as const
  ).map(async ([file, weight]) => ({
    name: "Geist",
    data: await readFile(join(fontDirectory, `Geist-${file}.ttf`)),
    weight,
    style: "normal" as const,
  }))
);

export default function loadLocalFonts() {
  return fonts;
}
