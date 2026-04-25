const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const BASE_URL = "https://www.dramaboxdb.com";
const DATA_DIR = path.join(process.cwd(), "drama_data");
const TEMP_DIR = path.join(DATA_DIR, "temp");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

/* =======================
   UTILS
======================= */

function log(...a) {
  console.log("[DRAMA]", ...a);
}

function keyName(t) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "_");
}

function sessionKey(msg, query) {
  const chatId = msg.key.remoteJid.replace(/[@.]/g, "_");
  return keyName(query) + "_" + chatId;
}

async function fetchPage(url) {
  const res = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/125.0.0.0",
    },
    timeout: 30000,
  });
  return res.data;
}

function extractNextData(html) {
  const $ = cheerio.load(html);
  const raw = $("#__NEXT_DATA__").html();
  if (!raw) throw new Error("No se encontró __NEXT_DATA__");
  return JSON.parse(raw);
}

/* =======================
   BUSCAR DRAMA
======================= */

async function searchDramaDubbed(query) {
  const q = `${query} doblado`;
  const url = `${BASE_URL}/es/search?searchValue=${encodeURIComponent(q)}`;
  log("FETCH (DOBLADO):", url);

  const html = await fetchPage(url);
  const json = extractNextData(html);
  const list = json?.props?.pageProps?.bookList;

  if (!list || !list.length) return null;

  return {
    id: list[0].bookId,
    title: list[0].bookName,
    mode: "dubbed",
  };
}

async function searchDramaNormal(query) {
  const url = `${BASE_URL}/search?searchValue=${encodeURIComponent(query)}`;
  log("FETCH (NORMAL):", url);

  const html = await fetchPage(url);
  const json = extractNextData(html);
  const list = json?.props?.pageProps?.bookList;

  if (!list || !list.length) throw new Error("Drama no encontrado");

  return {
    id: list[0].bookId,
    title: list[0].bookName,
    mode: "original",
  };
}

async function searchDramaAuto(query) {
  const dubbed = await searchDramaDubbed(query);
  if (dubbed) {
    log("✅ Usando versión doblada");
    return dubbed;
  }
  log("⚠️ No hay doblado, usando versión original");
  return await searchDramaNormal(query);
}

/* =======================
   CARGAR EPISODIOS
======================= */

async function loadDramaInfo(drama) {
  const url = `${BASE_URL}/movie/${drama.id}`;
  const html = await fetchPage(url);
  const json = extractNextData(html);
  const chapters = json.props.pageProps.chapterList || [];

  return {
    title: drama.title,
    id: drama.id,
    mode: drama.mode,
    created: Date.now(),
    chapters: chapters.map((c, i) => ({
      num: i + 1,
      index: c.indexStr || String(i + 1).padStart(3, "0"),
      mp4: c.mp4 || null,
      m3u8: c.m3u8Url || null,
      epUrl: c.jumpUrl || null,
      sent: false,
    })),
  };
}

/* =======================
   EXTRAER VIDEO DESDE EP
======================= */

async function extractVideoFromEpisode(epUrl) {
  if (!epUrl) return null;

  const html = await fetchPage(BASE_URL + epUrl);
  const json = extractNextData(html);

  const play =
    json?.props?.pageProps?.playInfo ||
    json?.props?.pageProps?.videoInfo;

  if (!play) return null;

  return {
    mp4: play.mp4 || null,
    m3u8: play.m3u8Url || null,
  };
}

/* =======================
   DESCARGAR EPISODIO
======================= */

async function downloadEpisode(ep, out) {
  const url = ep.epUrl;
  if (!url) throw new Error("No hay URL de episodio disponible");

  const options = [
    '-f', 'best', // Selecciona el mejor formato disponible
    '-o', out
  ];

  try {
    execSync(`yt-dlp ${url} ${options.join(' ')}`);
    if (!fs.existsSync(out) || fs.statSync(out).size < 100000) {
      throw new Error("La descarga falló");
    }
  } catch (error) {
    log("Error al descargar con yt-dlp:", error);
    throw new Error("No hay fuente de video disponible");
  }
}

/* =======================
   COMANDO
======================= */

module.exports = {
  name: "drama",
  alias: ["novela"],
  desc: "DramaBox por episodios (multiusuario)",

  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;

    if (!args.length)
      return sock.sendMessage(from, {
        text: "📺 Usa:\n!drama nombre\n!drama nombre 1\n!drama borrar",
      });

    // ===== BORRAR SESIÓN =====
    if (args[0].toLowerCase() === "borrar") {
      const chatId = msg.key.remoteJid.replace(/[@.]/g, "_");

      fs.readdirSync(DATA_DIR)
        .filter((f) => f.endsWith(".json") && f.includes(chatId))
        .forEach((f) => fs.unlinkSync(path.join(DATA_DIR, f)));

      return sock.sendMessage(from, {
        text: "🗑️ Información eliminada para este chat.",
      });
    }

    const epNum = Number(args[args.length - 1]);
    const hasEp = !isNaN(epNum);
    const query = hasEp ? args.slice(0, -1).join(" ") : args.join(" ");

    const key = sessionKey(msg, query);
    const jsonFile = path.join(DATA_DIR, `${key}.json`);

    try {
      // ===== CREAR INFO =====
      if (!hasEp) {
        const drama = await searchDramaAuto(query);
        const info = await loadDramaInfo(drama);

        fs.writeFileSync(jsonFile, JSON.stringify(info, null, 2));

        return sock.sendMessage(from, {
          text:
            `🎬 *${info.title}*\n` +
            `🌐 ${info.mode === "dubbed" ? "Español doblado 🇪🇸" : "Original"}\n` +
            `📺 Episodios: ${info.chapters.length}\n\n` +
            `Usa:\n*!drama ${query} 1*`,
        });
      }

      // ===== ENVIAR EP =====
      if (!fs.existsSync(jsonFile))
        throw new Error("No hay drama cargado en este chat");

      const data = JSON.parse(fs.readFileSync(jsonFile));
      const ep = data.chapters.find((c) => c.num === epNum);

      if (!ep) throw new Error("Episodio inválido");
      if (ep.sent) throw new Error("Episodio ya enviado");

      const file = path.join(TEMP_DIR, `${ep.index}_${Date.now()}.mp4`);

      await sock.sendMessage(from, {
        text: `⬇️ Descargando episodio ${epNum}...`,
      });

      await downloadEpisode(ep, file);

      await sock.sendMessage(
        from,
        {
          video: fs.readFileSync(file),
          caption:
            `🎬 ${data.title}\n📺 Episodio ${epNum}\n` +
            `🌐 ${data.mode === "dubbed" ? "Español doblado 🇪🇸" : "Original"}`,
        },
        { quoted: msg }
      );

      fs.unlinkSync(file);
      ep.sent = true;

      fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2));

      if (data.chapters.every((c) => c.sent)) {
        fs.unlinkSync(jsonFile);
        await sock.sendMessage(from, {
          text: "✅ Drama completado. Información eliminada.",
        });
      }
    } catch (e) {
      log("ERROR:", e.message);
      await sock.sendMessage(from, { text: "❌ " + e.message });
    }
  },
};

