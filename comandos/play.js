const { exec } = require("child_process");
const fs   = require("fs");
const path = require("path");
const yts  = require("yt-search");

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SPINNER = ["◐", "◓", "◑", "◒"];
const WAVE    = ["░", "▒", "░"];
let waveTick  = 0;

function buildBar(pct) {
  const filled = Math.round((pct / 100) * 14);
  const empty  = 14 - filled;
  const wave   = WAVE[waveTick % WAVE.length];
  return "▐" + "█".repeat(filled) + wave.repeat(empty) + "▌  " + String(pct).padStart(3) + "%";
}

function phaseLabel(phase) {
  return {
    search:   "Buscando",
    download: "Descargando",
    convert:  "Convirtiendo",
    upload:   "Subiendo",
    done:     "¡Listo!",
    error:    "Error",
  }[phase] ?? phase;
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function buildStatusMsg(phase, pct, title, spinTick) {
  const spin        = SPINNER[spinTick % 4];
  const phaseActive = phase !== "done" && phase !== "error";
  const spinStr     = phaseActive ? `  ${spin}` : "";
  const bar         = buildBar(pct);

  let detail = "";
  if (phase === "search")        detail = `> 🔎 _Buscando en YouTube..._`;
  else if (phase === "download") detail = `> 🎧 _${truncate(title, 35)}_`;
  else if (phase === "convert")  detail = `> 🔄 _Convirtiendo a MP3..._`;
  else if (phase === "upload")   detail = `> 📡 _Enviando al chat..._`;
  else if (phase === "done")     detail = `> 🎶 _¡Disfruta la música!_`;
  else if (phase === "error")    detail = `> ⚠️ _Algo salió mal. Intenta de nuevo._`;

  return [
    `🎵  *HUSKY MUSIC*  🎵`,
    ``,
    `*${phaseLabel(phase)}*${spinStr}`,
    bar,
    ``,
    detail,
  ].join("\n");
}

// Intento de envío con reintentos ante rate-overlimit
async function sendWithRetry(sock, from, payload, opts, retries = 3, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await sock.sendMessage(from, payload, opts);
    } catch (e) {
      const isRate = e.message && e.message.includes("rate-overlimit");
      console.log(`[RETRY] intento ${i + 1} falló: ${e.message}`);
      if (i < retries - 1 && isRate) {
        console.log(`[RETRY] esperando ${delay}ms...`);
        await sleep(delay);
        delay *= 1.5; // backoff
      } else {
        throw e;
      }
    }
  }
}

// ─── COOKIES ─────────────────────────────────────────────────────────────────
const COOKIES_FILE = path.resolve(__dirname, "../cookies.txt");

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  name: "play",
  alias: ["yt", "music"],

  async execute(sock, m, args) {
    const from = m.key.remoteJid;

    if (!args[0]) {
      return sock.sendMessage(from, {
        text:
          `🎵  *HUSKY MUSIC*  🎵\n` +
          `\n` +
          `> 📌 *Uso:* !play <canción o URL>\n` +
          `\n` +
          `*Ejemplos:*\n` +
          `> 🎤 !play bad bunny tití me preguntó\n` +
          `> 🎸 !play bohemian rhapsody queen\n` +
          `> 🔗 !play https://youtube.com/watch?v=...`,
      }, { quoted: m });
    }

    try {
      const query = args.join(" ");
      console.log(`\n[PLAY] ════════════════════════════`);
      console.log(`[PLAY] Buscando: "${query}"`);

      const search = await yts(query);
      if (!search.videos.length) {
        console.log("[PLAY] ❌ Sin resultados");
        return sock.sendMessage(from, {
          text:
            `🎵  *HUSKY MUSIC*  🎵\n\n` +
            `> ❌ _No se encontraron resultados para:_\n` +
            `> _${query}_`,
        }, { quoted: m });
      }

      const v = search.videos[0];
      const { title, thumbnail, timestamp, url, author, views, ago, description } = v;
      console.log(`[PLAY] ✅ "${title}"`);
      console.log(`[PLAY]    URL: ${url}`);

      // ── Info card ─────────────────────────────────────────────────────────
      const shortDesc = (description || "")
        .split("\n").map(l => l.trim()).find(l => l.length > 0) || "";

      const infoCaption =
        `🎵  *HUSKY MUSIC*  🎵\n\n` +
        `*🎬 DETALLES DEL VIDEO*\n\n` +
        `> 🎵 *${title}*\n` +
        `> ⏱ Duración › *${timestamp}*\n` +
        `> 👁 Vistas › *${views.toLocaleString()}*\n` +
        `> 👤 Canal › *${author.name}*\n` +
        `> 📅 Subido › *${ago}*\n` +
        (shortDesc ? `> 📝 _${truncate(shortDesc, 80)}_\n` : "") +
        `> 🔗 ${url}`;

      const msgInfo = await sock.sendMessage(from,
        { image: { url: thumbnail }, caption: infoCaption },
        { quoted: m }
      );

      // ── Estado animado ────────────────────────────────────────────────────
      let curPhase = "search";
      let curPct   = 0;
      let spinTick = 0;
      let animOn   = true;
      let editBusy = false; // evita ediciones solapadas

      const statusMsg = await sock.sendMessage(from,
        { text: buildStatusMsg(curPhase, curPct, title, spinTick) },
        { quoted: m }
      );

      // Intervalo de 8s → por debajo del límite de edición de WhatsApp
      const animTimer = setInterval(async () => {
        if (!animOn || editBusy) return;
        spinTick++;
        waveTick++;
        editBusy = true;
        try {
          await sock.sendMessage(from, {
            text: buildStatusMsg(curPhase, curPct, title, spinTick),
            edit: statusMsg.key,
          });
        } catch (e) {
          console.log("[ANIM] warn:", e.message);
        } finally {
          editBusy = false;
        }
      }, 8000);

      function setStatus(phase, pct) {
        curPhase = phase;
        if (pct !== undefined) curPct = pct;
        console.log(`[STATUS] ${phaseLabel(phase)}  (${curPct}%)`);
      }

      async function stopAnim(phase) {
        animOn = false;
        clearInterval(animTimer);
        // Espera a que termine cualquier edición en curso
        if (editBusy) await sleep(1000);
        const finalPct = phase === "done" ? 100 : curPct;
        waveTick = 0;
        try {
          await sock.sendMessage(from, {
            text: buildStatusMsg(phase, finalPct, title, spinTick),
            edit: statusMsg.key,
          });
        } catch (e) {
          console.log("[STOP] warn:", e.message);
        }
      }

      async function borrarInfo() {
        try { await sock.sendMessage(from, { delete: msgInfo.key }); }
        catch (e) { console.log("[BORRAR] warn:", e.message); }
      }

      // ── yt-dlp ────────────────────────────────────────────────────────────
      const tempDir = path.resolve(__dirname, "../temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      const outName     = `audio_${Date.now()}`;
      const outTemplate = path.join(tempDir, `${outName}.%(ext)s`);
      const expectedMp3 = path.join(tempDir, `${outName}.mp3`);

      const hasCookies = fs.existsSync(COOKIES_FILE);
      const cookieArg  = hasCookies ? `--cookies "${COOKIES_FILE}"` : "";
      console.log(hasCookies ? `[YTDLP] Cookies: ${COOKIES_FILE}` : "[YTDLP] Sin cookies");

      const cmd = [
        "yt-dlp",
        "-x",
        "--audio-format mp3",
        "--audio-quality 0",
        "--force-ipv4",
        "--no-check-certificate",
        "--no-playlist",
        "--extractor-retries 5",
        "--socket-timeout 30",
        '--extractor-args "youtube:player_client=android_vr"',
        cookieArg,
        "--newline",
        `-o "${outTemplate}"`,
        `"${url}"`,
      ].filter(Boolean).join(" ");

      console.log("[YTDLP] Comando:\n", cmd);
      setStatus("download", 15);

      let ytPct = 15;
      const pctTimer = setInterval(() => {
        if (ytPct < 60) {
          ytPct += 5;
          setStatus("download", ytPct);
        } else if (ytPct < 82) {
          ytPct += 3;
          setStatus("convert", ytPct);
        }
      }, 8000); // mismo ritmo que animTimer

      exec(cmd, async (err, stdout, stderr) => {
        clearInterval(pctTimer);

        console.log("[YTDLP] stdout:", stdout.slice(0, 600));
        if (stderr) console.log("[YTDLP] stderr:", stderr.slice(0, 600));

        if (err) {
          console.log("[YTDLP] ❌ código:", err.code);
          console.log("[YTDLP] ❌ msg   :", err.message.slice(0, 400));
          if (stderr.includes("Sign in") || stderr.includes("bot"))
            console.log(`\n💡 SOLUCIÓN: Guarda cookies en: ${COOKIES_FILE}\n`);
          if (stderr.includes("429"))
            console.log("💡 Rate limit de YouTube (429) — espera unos minutos\n");
          await stopAnim("error");
          return;
        }

        // Localiza archivo
        let finalFile = fs.existsSync(expectedMp3) ? expectedMp3 : null;
        if (!finalFile) {
          const candidates = fs.readdirSync(tempDir).filter(f => f.startsWith(outName));
          console.log("[YTDLP] Candidatos:", candidates);
          if (candidates.length) finalFile = path.join(tempDir, candidates[0]);
        }
        if (!finalFile) {
          console.log("[YTDLP] ❌ Sin archivo. Contenido de temp:", fs.readdirSync(tempDir));
          await stopAnim("error");
          return;
        }

        const sizeMB = (fs.statSync(finalFile).size / 1048576).toFixed(2);
        console.log(`[YTDLP] ✅ ${finalFile} (${sizeMB} MB)`);
        setStatus("upload", 90);

        // Pequeño delay antes de enviar el audio para no chocar con la última edición
        await sleep(2000);

        try {
          await sendWithRetry(sock, from, {
            audio: fs.readFileSync(finalFile),
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`,
          }, { quoted: m });

          await sleep(1500);
          await stopAnim("done");
          await sleep(1000);
          await borrarInfo();
        } catch (e) {
          console.log("[SEND] ❌", e.message);
          await stopAnim("error");
        } finally {
          try { fs.unlinkSync(finalFile); } catch {}
        }
      });

    } catch (error) {
      console.error("[PLAY] ❌ Error general:", error);
      sock.sendMessage(from, { text: "✖️ Error en Husky-Music." });
    }
  },
};

