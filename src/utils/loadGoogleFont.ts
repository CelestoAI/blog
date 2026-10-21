async function loadGoogleFont(
  font: string,
  text: string,
  weight: number
): Promise<ArrayBuffer> {
  const API = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}&text=${encodeURIComponent(text)}`;

  const css = await (
    await fetch(API, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
      },
    })
  ).text();

  const resource = css.match(
    /src: url\((.+?)\) format\('(opentype|truetype)'\)/
  );

  if (!resource) throw new Error("Failed to download dynamic font");

  const res = await fetch(resource[1]);

  if (!res.ok) {
    throw new Error("Failed to download dynamic font. Status: " + res.status);
  }

  return res.arrayBuffer();
}

async function loadGoogleFonts(
  text: string
): Promise<
  Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>
> {
  // Static instances are requested per weight (explicit wght) so satori
  // receives TTF files it can parse.
  const fontsConfig = [
    { name: "Geist", font: "Geist", weight: 400 },
    { name: "Geist", font: "Geist", weight: 500 },
    { name: "Geist", font: "Geist", weight: 600 },
    { name: "Geist", font: "Geist", weight: 700 },
    { name: "Geist Mono", font: "Geist+Mono", weight: 400 },
  ];

  const fonts = await Promise.all(
    fontsConfig.map(async ({ name, font, weight }) => {
      const data = await loadGoogleFont(font, text, weight);
      return { name, data, weight, style: "normal" };
    })
  );

  return fonts;
}

export default loadGoogleFonts;
