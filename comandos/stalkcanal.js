const axios = require("axios");

module.exports = {
  name: "stwa",
  alias: ["canalwa"],
  desc: "Obtiene información de canales de WhatsApp (Versión Corregida)",
  async execute(sock, msg, args, from) {
    try {
      if (!args || args.length === 0) {
        await sock.sendMessage(from, { 
          text: "❌ Ingresa el enlace de un canal.\n\n📌 Ejemplo: !stwa https://whatsapp.com/channel/0029VbBMsVPIyPtXL3UDeu1U" 
        }, { quoted: msg });
        return;
      }

      let rawUrl = args[0].trim().split('?')[0];
      const apiUrl = `https://api.delirius.store/tools/whatsappchannelstalk?channel=${encodeURIComponent(rawUrl)}`;

      console.log(`[LOG !stwa] Consultando URL: ${rawUrl}`);

      const response = await axios.get(apiUrl, { timeout: 10000 });
      const res = response.data;

      // 🛠️ MAPEADO FLEXIBLE (Soporta data o datos / status o estado)
      const status = res.status ?? res.estado;
      const info = res.data ?? res.datos;

      if (!status || !info) {
        console.error("[LOG !stwa] Respuesta inválida de la API:", res);
        await sock.sendMessage(from, { text: "⚠️ No se encontró información detallada para este canal." }, { quoted: msg });
        return;
      }

      // 🧹 Limpieza de textos (La API a veces trae basura de "Download Whatsapp")
      const tituloLimpio = info.title?.split("Looks")[0]?.trim() || "Sin nombre";
      const descLimpia = info.description?.split("Don't")[0]?.trim() || "Sin descripción";

      const caption = `📢 *CANAL ENCONTRADO*\n\n` +
                      `👤 *Título:* ${tituloLimpio}\n` +
                      `👥 *Seguidores:* ${info.followers || info.seguidores || '0'}\n` +
                      `✅ *Verificado:* ${info.verified ?? info.verificado ? 'Sí' : 'No'}\n\n` +
                      `📝 *Descripción:* ${descLimpia}\n\n` +
                      `🔗 *Link:* ${info.url || rawUrl}`;

      const imagenUrl = info.profile ?? info.perfil;

      if (imagenUrl) {
        await sock.sendMessage(from, { 
          image: { url: imagenUrl }, 
          caption: caption 
        }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: caption }, { quoted: msg });
      }

    } catch (err) {
      console.error("--- ERROR EN !STWA ---");
      console.error(err.message);
      await sock.sendMessage(from, { text: `⚠️ Error en la solicitud: ${err.message}` }, { quoted: msg });
    }
  },
};

