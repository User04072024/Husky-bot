const axios = require("axios");
const cheerio = require("cheerio");

const CUEVANA = "https://cue.cuevana3.nu";
const NETU = "https://www.netupeliculas.com";

/* =======================
   UTILS
======================= */

function log(...a) {
  console.log("[PELICULA]", ...a);
}

async function fetch(url) {
  const res = await axios.get(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/125.0.0.0",
    },
    timeout: 20000,
  });
  return res.data;
}

/* =======================
   CUEVANA API
======================= */

async function searchCuevanaAPI(query) {
  const urls = [
    `${CUEVANA}/wp-json/cuevana/v1/search?q=${encodeURIComponent(query)}`,
    `${CUEVANA}/wp-json/cuevana/v1/search-title?q=${encodeURIComponent(query)}`,
  ];

  for (const url of urls) {
    try {
      log("Cuevana API:", url);
      const data = await fetch(url);

      let list =
        Array.isArray(data) ? data : data?.data || data?.items;

      if (list && list.length) {
        const item = list[0];
        let link = item.url || item.permalink || item.link;
        if (link?.startsWith("/")) link = CUEVANA + link;

        return {
          title: item.title || item.name,
          year: item.release || item.year || "N/A",
          type: item.type || "Contenido",
          url: link,
          source: "Cuevana",
        };
      }
    } catch {}
  }
  return null;
}

/* =======================
   CUEVANA HTML
======================= */

async function searchCuevanaHTML(query) {
  const url = `${CUEVANA}/search?s=${encodeURIComponent(query)}`;
  log("Cuevana HTML:", url);

  const html = await fetch(url);
  const $ = cheerio.load(html);

  const a = $(".MovieList .TPostMv a").first();
  if (!a.length) return null;

  return {
    title: a.attr("title") || a.text().trim(),
    year: "N/A",
    type: "Contenido",
    url: CUEVANA + a.attr("href"),
    source: "Cuevana",
  };
}

/* =======================
   NETUPELÍCULAS HTML
======================= */

async function searchNetuHTML(query) {
  const url = `${NETU}/search?q=${encodeURIComponent(query)}&m=1`;
  log("Netu HTML:", url);

  const html = await fetch(url);
  const $ = cheerio.load(html);

  const a = $("article h2 a").first();
  if (!a.length) return null;

  return {
    title: a.text().trim(),
    year: "N/A",
    type: "Contenido",
    url: a.attr("href"),
    source: "NetuPelículas",
  };
}

/* =======================
   BUSCADOR GLOBAL (Netu primero)
======================= */

async function searchMovie(query) {
  return (
    (await searchNetuHTML(query)) ||       // Primero Netu
    (await searchCuevanaAPI(query)) ||     // Luego Cuevana API
    (await searchCuevanaHTML(query)) ||    // Luego Cuevana HTML
    (() => {
      throw new Error("Película no encontrada");
    })()
  );
}

/* =======================
   COMANDO
======================= */

module.exports = {
  name: "película",
  alias: ["película", "movie", "film"],
  desc: "Buscar película y devolver link",

  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(from, {
        text: "🎬 Usa:\n!pelicula nombre",
      });
    }

    try {
      const movie = await searchMovie(args.join(" "));

      await sock.sendMessage(
        from,
        {
          text:
            `🎬 *${movie.title}*\n` +
            `📅 Año: ${movie.year}\n` +
            `🎞️ Tipo: ${movie.type}\n` +
            `📡 Fuente: ${movie.source}\n\n` +
            `👉 Ver aquí:\n${movie.url}\n\n` +
            "⚠️ *Aviso:* Esta página contiene anuncios.\n" +
            "👉 Se recomienda usar un bloqueador de anuncios (AdBlock).",
        },
        { quoted: msg }
      );
    } catch (e) {
      log("ERROR:", e.message);
      await sock.sendMessage(from, {
        text: "❌ " + e.message,
      });
    }
  },
};
