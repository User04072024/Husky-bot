const { generateWAMessageFromContent } = require("@whiskeysockets/baileys");

module.exports = {
  name: "gets",
  alias: ["getsticker", "getlottie", "stickerdata"],
  desc: "Obtiene los datos de un sticker o Lottie respondido",

  async execute(sock, msg, args, from, sender, db, saveDB, isOwner, sendMessageSafe, isAdmin, getGroupMetadata) {
    try {
      // 1. Obtener el mensaje citado (quoted)
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quoted) {
        return await sock.sendMessage(from, {
          text: "❌ Responde a un sticker para obtener sus datos."
        }, { quoted: msg });
      }

      // 2. FUNCIÓN DE EXTRACCIÓN PROFUNDA
      // Buscamos la propiedad 'stickerMessage' en cualquier nivel del objeto
      const findSticker = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj.stickerMessage) return obj.stickerMessage;
        for (const key in obj) {
          const found = findSticker(obj[key]);
          if (found) return found;
        }
        return null;
      };

      const sticker = findSticker(quoted);

      if (!sticker) {
        // Log para depuración en consola si sigue fallando
        console.log("Estructura recibida:", JSON.stringify(quoted, null, 2));
        return await sock.sendMessage(from, {
          text: "❌ No se pudo extraer la información técnica del sticker. Asegúrate de que no sea un sticker de un 'Canal' (estos tienen restricciones)."
        }, { quoted: msg });
      }

      // 3. Extraer datos con validaciones robustas
      const isLottie   = sticker.isLottie || sticker.mimetype === 'application/json' || false;
      const isAnimated = sticker.isAnimated || false;
      
      const fileSha256    = sticker.fileSha256 ? Buffer.from(sticker.fileSha256).toString("base64") : "N/A";
      const fileEncSha256 = sticker.fileEncSha256 ? Buffer.from(sticker.fileEncSha256).toString("base64") : "N/A";
      const mediaKey      = sticker.mediaKey ? Buffer.from(sticker.mediaKey).toString("base64") : "N/A";
      
      const url           = sticker.url || "N/A";
      const directPath    = sticker.directPath || "N/A";
      const mimetype      = sticker.mimetype || "N/A";
      const height        = sticker.height || "N/A";
      const width         = sticker.width || "N/A";

      // 4. Guardado en Base de Datos
      if (isLottie) {
        if (!db.lottieStickers) db.lottieStickers = [];
        const existe = db.lottieStickers.find(l => l.fileSha256 === fileSha256);
        if (!existe) {
          db.lottieStickers.unshift({
            url, directPath, fileSha256, fileEncSha256,
            mediaKey, mimetype, height, width,
            timestamp: Date.now()
          });
          if (db.lottieStickers.length > 20) db.lottieStickers.pop();
          saveDB();
        }
      }

      const texto = `◈━━━━━━━━━━━━━━━━━━━━◈
  ⬡ *STICKER DATA* ⬡
◈━━━━━━━━━━━━━━━━━━━━◈

◌ ── 𝗧𝗜𝗣𝗢 ── ◌
  🎭 *Lottie:* ${isLottie ? "✅ Sí" : "❌ No"}
  ✨ *Animado:* ${isAnimated ? "✅ Sí" : "❌ No"}
  📐 *Tamaño:* ${width}x${height}
  📦 *Mimetype:* ${mimetype}

◌ ── 𝗨𝗥𝗟 ── ◌
  🔗 \`${url}\`

◌ ── 𝗣𝗔𝗧𝗛 ── ◌
  📁 \`${directPath}\`

◌ ── 𝗛𝗔𝗦𝗛𝗘𝗦 ── ◌
  🔐 *fileSha256:*
  \`${fileSha256}\`

  🔐 *fileEncSha256:*
  \`${fileEncSha256}\`

  🔑 *mediaKey:*
  \`${mediaKey}\`

◈━━━━━━━━━━━━━━━━━━━━◈
${isLottie ? "  ✅ Lottie guardado en DB" : "  ℹ️ No es un Lottie"}
◈━━━━━━━━━━━━━━━━━━━━◈`;

      await sock.sendMessage(from, { text: texto }, { quoted: msg });

    } catch (err) {
      console.error("❌ Error crítico en !gets:", err);
      await sock.sendMessage(from, {
        text: "⚠️ Ocurrió un error al procesar los metadatos."
      }, { quoted: msg });
    }
  },
};

