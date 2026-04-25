const axios = require("axios");
const FormData = require("form-data");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

module.exports = {
  name: "readqr",
  alias: ["leerqr"],
  desc: "Lee el texto de un código QR enviado como imagen",
  async execute(sock, msg, args, from) {
    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const imageMsg = msg.message?.imageMessage
        ? msg.message.imageMessage
        : quoted?.imageMessage
        ? quoted.imageMessage
        : null;

      if (!imageMsg) {
        await sock.sendMessage(from, {
          text: "📸 *Responde o envía una imagen que contenga un código QR.*",
        }, { quoted: msg });
        return;
      }

      // Descargar imagen completa en buffer
      let buffer = Buffer.from([]);
      const stream = await downloadContentFromMessage(imageMsg, "image");
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      if (!buffer || buffer.length === 0) {
        await sock.sendMessage(from, {
          text: "⚠️ No se pudo descargar la imagen. Intenta reenviarla sin comprimir.",
        }, { quoted: msg });
        return;
      }

      // Crear formulario multipart
      const form = new FormData();
      form.append("file", buffer, { filename: "qr.jpg" });

      // Enviar al lector de QR
      const { data } = await axios.post("https://api.qrserver.com/v1/read-qr-code/", form, {
        headers: form.getHeaders(),
      });

      const result = data?.[0]?.symbol?.[0]?.data;
      if (!result) {
        await sock.sendMessage(from, { text: "❌ No se detectó ningún QR en la imagen." }, { quoted: msg });
        return;
      }

      await sock.sendMessage(from, { text: `✅ *Código QR leído correctamente:*\n\n${result}` });
    } catch (err) {
      console.error("❌ Error en !readqr:", err);
      await sock.sendMessage(from, { text: "⚠️ Error al leer el QR. Intenta nuevamente." }, { quoted: msg });
    }
  },
};
