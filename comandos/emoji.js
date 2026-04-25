const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

module.exports = {
  name: "a",
  alias: ["emo"],

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;

    // 1️⃣ Obtener emoji
    const emoji = args.join("").trim();
    if (!emoji) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: *!a 😎*"
      });
    }

    // 2️⃣ Convertir emoji a codepoint
    const code = emojiToCodePoint(emoji);

    // URL directa a gif de Emojiterra
    const url = `https://emojiterra.com/data/animated-emoji/${code}.gif`;

    // Archivos temporales
    const base = path.join(__dirname, `emo_${Date.now()}`);
    const gif = `${base}.gif`;
    const webp = `${base}.webp`;

    try {
      // 3️⃣ Descargar gif
      const res = await axios.get(url, {
        responseType: "arraybuffer"
      });

      // 4️⃣ Guardar gif
      fs.writeFileSync(gif, res.data);

      // 5️⃣ Convertir a webp sticker
      await run(
        `ffmpeg -y -i ${gif} -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -loop 0 ${webp}`
      );

      // 6️⃣ Enviar sticker
      await sock.sendMessage(jid, {
        sticker: fs.readFileSync(webp)
      }, { quoted: m });

    } catch (e) {
      console.error("❌ No se encontró animación:", e.message);

      return sock.sendMessage(jid, {
        text: "❌ No encontré animación para ese emoji."
      });
    }

    // 7️⃣ Borrar archivos temporales
    [gif, webp].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
  }
};

// 🔹 convertir emoji → codepoint ascii
function emojiToCodePoint(emoji) {
  return [...emoji]
    .map(e => e.codePointAt(0).toString(16))
    .join("-");
}

function run(cmd) {
  return new Promise((resolve, reject) =>
    exec(cmd, e => (e ? reject(e) : resolve()))
  );
}
