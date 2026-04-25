module.exports = {
  name: "getid",
  alias: ["id"],
  desc: "Busca el ID de un canal incluso con origen desconocido",
  async execute(sock, msg, args, from) {
    try {
      // 1. Acceder al objeto de contexto del mensaje citado
      const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
      
      if (!quotedContext) {
        return await sock.sendMessage(from, { text: "❌ Responde a un mensaje del canal." }, { quoted: msg });
      }

      // 2. Intentar buscar en 'forwardedNewsletterMessageInfo'
      // Es el lugar oficial, aunque tu debug diga UNKNOWN, a veces Baileys lo mapea fuera.
      let canalId = quotedContext.forwardedNewsletterMessageInfo?.newsletterJid;

      // 3. Si no está ahí, buscar en la propiedad 'participant' 
      // Si el mensaje es de un canal y fue reenviado, a veces el ID se filtra aquí.
      if (!canalId && quotedContext.participant?.includes("@newsletter")) {
        canalId = quotedContext.participant;
      }

      if (canalId) {
        const pureId = canalId.split("@")[0];
        const nombre = quotedContext.forwardedNewsletterMessageInfo?.newsletterName || "Canal Detectado";

        const response = `✅ *ID LOCALIZADO*\n\n` +
                         `📢 *Canal:* ${nombre}\n` +
                         `🆔 *ID:* ${canalId}\n` +
                         `📌 *Formato:* @${pureId}.us`;

        await sock.sendMessage(from, { text: response }, { quoted: msg });
      } else {
        // 4. ÚLTIMO RECURSO: Si el origen es UNKNOWN, significa que el JID no viajó en el reenvío.
        // Vamos a pedirle al usuario que use el enlace con un método de emergencia.
        await sock.sendMessage(from, { 
          text: "⚠️ *Origen Desconocido*\n\nWhatsApp ocultó el ID en este reenvío. Intenta esto:\n1. Ve al canal.\n2. Copia el *enlace público* del canal.\n3. Usa el comando: `!getcanal [enlace]`\n\n*(Estaré usando un nuevo método de búsqueda por texto si usas ese comando)*" 
        }, { quoted: msg });
      }

    } catch (err) {
      console.error("❌ Error en !getid:", err);
      await sock.sendMessage(from, { text: "⚠️ Error técnico al leer el mensaje." }, { quoted: msg });
    }
  },
};

