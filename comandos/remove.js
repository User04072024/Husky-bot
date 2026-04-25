const fetch = require("node-fetch");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

module.exports = {
  name: "remove",
  alias: ["nofondo", "removebg", "delfondo"],
  desc: "Elimina el fondo de una imagen usando remove.bg",

  async execute(sock, msg, args, from, sender, db, saveDB, isOwner, sendMessageSafe, isAdmin, getGroupMetadata) {
    try {

      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quoted      = contextInfo?.quotedMessage;
      const isImage     = quoted?.imageMessage ||
                          msg.message?.imageMessage;

      if (!isImage) {
        return await sock.sendMessage(from, {
          text: "❌ Responde a una imagen para eliminar su fondo.\n\n📌 Ejemplo: responde una imagen con *!remove*"
        }, { quoted: msg });
      }

      // Reaccionar con ⏳
      await sock.sendMessage(from, {
        react: { text: "⏳", key: msg.key }
      });

      // Descargar imagen
      const isQuoted = !!quoted?.imageMessage;
      const quotedMsg = isQuoted ? {
        key: {
          remoteJid:   from,
          id:          contextInfo?.stanzaId   || msg.key.id,
          participant: contextInfo?.participant || msg.key.participant
        },
        message: quoted
      } : msg;

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
        await sock.sendMessage(from, {
          react: { text: "❌", key: msg.key }
        });
        return await sock.sendMessage(from, {
          text: "⚠️ No se pudo descargar la imagen."
        }, { quoted: msg });
      }

      // Enviar a remove.bg
      const FormData = require("form-data");
      const formData = new FormData();
      formData.append("image_file", buffer, {
        filename:    "image.png",
        contentType: "image/png"
      });
      formData.append("size", "auto");

      const response = await fetch("https://api.remove.bg/v1.0/removebg", {
        method:  "POST",
        headers: {
          "X-Api-Key": "zCdVbVyLkHkVkqRRzycSzMrc",
          ...formData.getHeaders()
        },
        body: formData
      });

      if (!response.ok) {
        await sock.sendMessage(from, {
          react: { text: "❌", key: msg.key }
        });
        return await sock.sendMessage(from, {
          text: `⚠️ Error de la API: ${response.statusText}`
        }, { quoted: msg });
      }

      const resultBuffer = Buffer.from(await response.arrayBuffer());

      // Enviar imagen sin fondo
      await sock.sendMessage(from, {
        image:   resultBuffer,
        caption: "✅ Fondo eliminado correctamente."
      }, { quoted: msg });

      // Reaccionar con ✅
      await sock.sendMessage(from, {
        react: { text: "✅", key: msg.key }
      });

    } catch (err) {
      console.error("❌ Error en !remove:", err);
      await sock.sendMessage(from, {
        react: { text: "❌", key: msg.key }
      });
      await sock.sendMessage(from, {
        text: "⚠️ Ocurrió un error al procesar la imagen."
      }, { quoted: msg });
    }
  },
};
