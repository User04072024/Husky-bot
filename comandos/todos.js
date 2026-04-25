const fs = require('fs');
const path = require('path');

module.exports = {
  name: "todos",
  description: "Menciona a todos con el bug de invisibilidad",
  async execute(sock, msg, args, from) {
    try {
      if (!msg.key.remoteJid.endsWith("@g.us")) {
        return sock.sendMessage(from, { text: "❌ Este comando solo funciona en grupos." }, { quoted: msg });
      }

      const groupMetadata = await sock.groupMetadata(from);
      const participants = groupMetadata.participants;
      const mentions = participants.map(p => p.id);

      /** * EL TRUCO DEL FONT 15:
       * Usamos el Zero Width Space (\u200B). 
       * WhatsApp detecta que hay texto, pero al no tener ancho, 
       * el globo del mensaje se ve como en tu captura.
       **/
      const invisibleBug = "\u200B".repeat(15); 

      // Enviamos el mensaje "vacío" con las menciones ocultas
      await sock.sendMessage(from, { 
        text: invisibleBug, 
        mentions: mentions 
      }, { quoted: msg });

      /* NOTA: He quitado la parte del video y las frases para que 
         el efecto sea exactamente el de un mensaje fantasma. 
         Si mandas un video, el bug no se nota igual.
      */

    } catch (err) {
      console.error("❌ Error en !todos:", err);
    }
  },
};

