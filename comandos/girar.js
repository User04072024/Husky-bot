const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const Jimp = require("jimp");
const { buildLottieSticker } = require("../Lottie-Whatsapp/src/index");

module.exports = {
  name: "pompom",
  alias: ["pompomimg"],
  desc: "Lanzador de stickers animado (Pedrozz Engine)",

  async execute(sock, msg, args, from) {
    const REPO_BASE = path.resolve(__dirname, "..", "Lottie-Whatsapp");
    const BASE_FOLDER = path.join(REPO_BASE, "src", "exemple");
    const outputWas = path.join(REPO_BASE, `final_${Date.now()}.was`);

    try {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;

      if (!quoted || !quoted.imageMessage) {
        return await sock.sendMessage(from, { text: "❌ Responde a una imagen." }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

      // 1. Descarga
      const dfileBuffer = await downloadMediaMessage(
        { key: { remoteJid: from, id: contextInfo.stanzaId, participant: contextInfo.participant }, message: quoted },
        "buffer", {}, { logger: require("pino")({ level: "silent" }) }
      );

      // 2. Compresión (Bajamos a 160px para asegurar ligereza)
      const imgCompressed = await Jimp.read(dfileBuffer)
        .then(img => img.resize(160, 160).quality(60).getBufferAsync(Jimp.MIME_JPEG));

      // 3. Motor
      await buildLottieSticker({
        baseFolder: BASE_FOLDER,
        buffer: imgCompressed,
        mime: "image/jpeg",
        output: outputWas,
        jsonRelativePath: "animation/animation_secondary.json"
      });

      // 4. Envío con Flags corregidas
      console.log("[POMPOM] Enviando sticker generado...");
      const wasBuffer = fs.readFileSync(outputWas);
      
      await sock.sendMessage(from, {
        sticker: wasBuffer,
        mimetype: "application/was",
        isAnimated: true // Indica a WA que es animado
      }, { quoted: msg });

      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

    } catch (err) {
      console.error("[ERROR POMPOM]:", err.message);
      await sock.sendMessage(from, { text: `❌ Error: ${err.message}` });
    } finally {
      if (fs.existsSync(outputWas)) fs.unlinkSync(outputWas);
    }
  }
};

