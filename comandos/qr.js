const axios = require("axios");

module.exports = {
  name: "qr",
  alias: ["codigoqr"],
  desc: "Genera un código QR a partir de texto o enlace",
  async execute(sock, msg, args, from) {
    try {
      if (!args || args.length === 0) {
        await sock.sendMessage(from, { text: "❌ Ingresa un texto o enlace para generar el QR.\n\n📌 Ejemplo: !qr https://google.com" }, { quoted: msg });
        return;
      }

      const text = args.join(" ");
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}`;

      // 📤 Enviar la imagen primero (sin texto)
      await sock.sendMessage(from, { image: { url: qrUrl } }, { quoted: msg });

      // 🕐 Pequeño delay opcional (para que no se mezclen)
      await new Promise(resolve => setTimeout(resolve, 500));

      // 💬 Luego enviar el mensaje aparte
      await sock.sendMessage(from, { text: "✅ Código QR generado con éxito." });

    } catch (err) {
      console.error("❌ Error en !qr:", err);
      await sock.sendMessage(from, { text: "⚠️ Ocurrió un error al generar el código QR." }, { quoted: msg });
    }
  },
};
