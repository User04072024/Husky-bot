const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const os = require("os");

module.exports = {
  name: "bigsticker",
  alias: ["bigs", "stickergrande"],
  desc: "Convierte imagen, GIF, video o sticker en sticker grande que sobresale",

  async execute(sock, msg, args, from, sender, db, saveDB, isOwner, sendMessageSafe, isAdmin, getGroupMetadata) {
    try {

      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quoted      = contextInfo?.quotedMessage;
      const isImage     = quoted?.imageMessage;
      const isVideo     = quoted?.videoMessage;
      const isSticker   = quoted?.stickerMessage;

      if (!quoted || (!isImage && !isVideo && !isSticker)) {
        return await sock.sendMessage(from, {
          text: "❌ Responde a una imagen, GIF, video o sticker.\n\n📌 Ejemplo: responde con *!bigsticker*"
        }, { quoted: msg });
      }

      await sock.sendMessage(from, {
        text: "⏳ Convirtiendo..."
      }, { quoted: msg });

      const quotedMsg = {
        key: {
          remoteJid:   from,
          id:          contextInfo?.stanzaId   || msg.key.id,
          participant: contextInfo?.participant || msg.key.participant
        },
        message: quoted
      };

      const buffer = await downloadMediaMessage(
        quotedMsg,
        "buffer",
        {},
        {
          logger: require("pino")({ level: "silent" }),
          reuploadRequest: sock.updateMediaMessage
        }
      );

      if (!buffer || buffer.length === 0) {
        return await sock.sendMessage(from, {
          text: "⚠️ No se pudo descargar el archivo."
        }, { quoted: msg });
      }

      // 🔑 Si ya es un sticker WebP enviarlo directo sin recomprimir
      if (isSticker) {
        return await sock.sendMessage(from, {
          sticker: buffer
        }, { quoted: msg });
      }

      // Para imágenes y videos convertir con ffmpeg
      let ext = "jpg";
      if (isVideo) ext = "mp4";

      const tmpInput  = path.join(os.tmpdir(), `input_${Date.now()}.${ext}`);
      const tmpOutput = path.join(os.tmpdir(), `output_${Date.now()}.webp`);
      fs.writeFileSync(tmpInput, buffer);

      const isGif = quoted?.videoMessage?.gifPlayback;

      const ffmpegOptions = (isVideo || isGif)
        ? [
            "-vf", [
              "scale=512:682:force_original_aspect_ratio=decrease",
              "pad=512:682:(ow-iw)/2:(oh-ih)/2:color=black@0",
              "format=rgba"
            ].join(","),
            "-c:v", "libwebp",
            "-lossless", "0",
            "-q:v", "90",
            "-preset", "drawing",
            "-loop", "0",
            "-t", "6",
            "-an",
            "-vsync", "0"
          ]
        : [
            "-vf", [
              "scale=512:682:force_original_aspect_ratio=decrease",
              "pad=512:682:(ow-iw)/2:(oh-ih)/2:color=black@0",
              "format=rgba"
            ].join(","),
            "-c:v", "libwebp",
            "-lossless", "0",
            "-q:v", "90",
            "-preset", "drawing",
            "-loop", "0",
            "-an",
            "-vsync", "0"
          ];

      await new Promise((resolve, reject) => {
        ffmpeg(tmpInput)
          .outputOptions(ffmpegOptions)
          .toFormat("webp")
          .save(tmpOutput)
          .on("end", resolve)
          .on("error", (e) => {
            console.error("ffmpeg error:", e.message);
            reject(e);
          });
      });

      const webpBuffer = fs.readFileSync(tmpOutput);

      try { fs.unlinkSync(tmpInput);  } catch {}
      try { fs.unlinkSync(tmpOutput); } catch {}

      if (!webpBuffer || webpBuffer.length === 0) {
        return await sock.sendMessage(from, {
          text: "⚠️ Error al generar el sticker."
        }, { quoted: msg });
      }

      await sock.sendMessage(from, {
        sticker: webpBuffer
      }, { quoted: msg });

    } catch (err) {
      console.error("❌ Error en !bigsticker:", err);
      await sock.sendMessage(from, {
        text: "⚠️ Ocurrió un error al procesar."
      }, { quoted: msg });
    }
  },
};
