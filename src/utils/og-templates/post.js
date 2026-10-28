import satori from "satori";
import logo from "../../assets/celesto-logo.png?inline";
import loadLocalFonts from "../loadLocalFonts";

export async function renderOgCard(title, description, topic = "Celesto AI") {
  const fontSize = title.length > 90 ? 48 : title.length > 65 ? 56 : 64;
  return satori(
    {
      type: "div",
      props: {
        style: {
          display: "flex",
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(155deg, #743822 0%, #44241c 42%, #291b17 100%)",
          color: "#faf9f6",
          fontFamily: "Geist",
          padding: "0 64px",
        },
        children: {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              width: "100%",
              height: "100%",
              borderLeft: "1px solid #ffffff20",
              borderRight: "1px solid #ffffff20",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    height: 224,
                    flexShrink: 0,
                    padding: "72px 32px",
                    borderBottom: "1px solid #ffffff20",
                  },
                  children: {
                    type: "img",
                    props: { src: logo, width: 48, height: 48 },
                  },
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    padding: "28px 32px 32px",
                    overflow: "hidden",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          color: "#ff9b70",
                          fontSize: 20,
                          fontWeight: 400,
                          marginBottom: 24,
                        },
                        children: topic.toUpperCase(),
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontSize,
                          fontWeight: 600,
                          lineHeight: 1.1,
                          letterSpacing: "-0.03em",
                          marginBottom: 24,
                          lineClamp: 3,
                        },
                        children: title,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontSize: 24,
                          fontWeight: 400,
                          lineHeight: 1.35,
                          color: "#dac7bf",
                          lineClamp: 2,
                        },
                        children: description,
                      },
                    },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    height: 44,
                    flexShrink: 0,
                    borderTop: "1px solid #ffffff20",
                  },
                },
              },
            ],
          },
        },
      },
    },
    { width: 1200, height: 630, fonts: await loadLocalFonts() }
  );
}

export default async post =>
  renderOgCard(
    post.data.title,
    post.data.description,
    post.data.tags[0] || "Celesto AI"
  );
