const axios = require("axios");

module.exports = {
  name: "pet",
  alias: ["acariciar", "pat", "petgif"],
  desc: "Genera un GIF de una mano acariciando a un usuario",
  async execute(sock, msg, args, from) {
    try {
      // 1. Determinar de quién obtener la imagen
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      
      let target;
      if (mentioned) {
        target = mentioned; // Si mencionaron a alguien
      } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        target = msg.message.extendedTextMessage.contextInfo.participant; // Si respondió a un mensaje
      } else {
        target = msg.key.participant || msg.key.remoteJid; // El que envía el comando
      }

      // 2. Obtener la URL de la foto de perfil
      let ppUrl;
      try {
        ppUrl = await sock.profilePictureUrl(target, 'image');
      } catch (e) {
        // Imagen por defecto si el usuario no tiene foto o la tiene privada
        ppUrl = 'https://i.ibb.co/fzsG7jzZ/d.jpg'; 
      }

      // 3. Construir la URL de la API de Delirius
      const petUrl = `https://api.delirius.store/canvas/petgif?url=${encodeURIComponent(ppUrl)}`;

      // 4. Enviar el GIF (en WhatsApp se envía como video con gifPlayback)
      await sock.sendMessage(
        from, 
        { 
          video: { url: petUrl }, 
          gifPlayback: true,
          caption: "✨ ¡Acariciando con mucho cariño! ✨" 
        }, 
        { quoted: msg }
      );

      // 5. Opcional: Mensaje de confirmación (siguiendo tu estilo de QR)
      await new Promise(resolve => setTimeout(resolve, 500));
      await sock.sendMessage(from, { text: "✅ GIF generado con éxito." });

    } catch (err) {
      console.error("❌ Error en !pet:", err);
      await sock.sendMessage(
        from, 
        { text: "⚠️ Ocurrió un error al procesar la imagen." }, 
        { quoted: msg }
      );
    }
  },
};

