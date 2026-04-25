module.exports = {
  name: "banadm",
  description: "Expulsa de inmediato a un usuario del grupo.",
  async execute(sock, msg, args, from) {
    try {
      const isGroup = from.endsWith("@g.us");
      if (!isGroup) {
        return sock.sendMessage(from, { text: "❌ Este comando solo funciona en grupos." });
      }

      // Obtener metadata del grupo
      const metadata = await sock.groupMetadata(from);
      const participants = metadata.participants || [];

      // JIDs mencionados (si hay)
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      // Si el comando se usó respondiendo, tomar el participante del mensaje citado
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (quoted && !mentioned.length) {
        mentioned.push(quoted);
      }

      if (mentioned.length === 0) {
        return sock.sendMessage(from, { text: "❌ Debes mencionar a un usuario con @ o usar el comando como respuesta a su mensaje." });
      }

      

      // Procesar cada mención (o solo la primera si prefieres)
      for (const usuario of mentioned) {
        // Evitar expulsar al bot a sí mismo
        if (usuario === me) {
          await sock.sendMessage(from, { text: "❌ No puedo expulsarme a mí mismo." });
          continue;
        }

        // Encontrar info del usuario objetivo
        const target = participants.find(p => p.id === usuario);
        if (!target) {
          await sock.sendMessage(from, { text: `❌ No encontré al usuario ${usuario.split("@")[0]} en el grupo.` });
          continue;
        }

        // Intentar remover
        try {
          await sock.groupParticipantsUpdate(from, [usuario], "remove");
          await sock.sendMessage(from, {
            text: `🚫 @${usuario.split("@")[0]} ha sido expulsado del grupo.`,
            mentions: [usuario]
          });
        } catch (err) {
          console.log("❌ Error expulsando usuario:", err);
          await sock.sendMessage(from, { text: `❌ No pude expulsar a @${usuario.split("@")[0]}. Revisa mis permisos.` , mentions: [usuario] });
        }
      }

    } catch (err) {
      console.error("❌ Error en banadm:", err);
      await sock.sendMessage(from, { text: "❌ Ocurrió un error procesando el comando." });
    }
  }
};
