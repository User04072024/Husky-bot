module.exports = {
  name: "degradar",
  description: "Quita el rol de admin a un usuario (respondiendo a su mensaje)",
  async execute(sock, msg, args, from, db, saveDB) {
    try {
      // Verificar si el mensaje es respuesta
      const target = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!target) {
        return await sock.sendMessage(from, {
          text: "❌ Debes responder al mensaje del usuario que quieres degradar.",
        });
      }

      const sender = msg.key.participant || msg.key.remoteJid;
      const groupMetadata = await sock.groupMetadata(from);
      const groupAdmins = groupMetadata.participants
        .filter((p) => p.admin !== null)
        .map((p) => p.id);

      // Validar que el bot sea admin
      const botNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net";
      if (!groupAdmins.includes(botNumber)) {
        return await sock.sendMessage(from, {
          text: "🤖 Necesito ser *administrador* para degradar usuarios.",
        });
      }

      // Validación: solo admins pueden usar el comando
      if (!groupAdmins.includes(sender)) {
        return await sock.sendMessage(from, {
          text: "⚠️ Solo los *administradores* pueden usar este comando.",
        });
      }

      // Verificar que el usuario objetivo sea admin
      const targetIsAdmin = groupAdmins.includes(target);
      if (!targetIsAdmin) {
        return await sock.sendMessage(from, {
          text: "😅 Este usuario no es administrador.",
        });
      }

      // Evitar degradarse a sí mismo
      if (target === sender) {
        return await sock.sendMessage(from, {
          text: "🙃 No puedes degradarte a ti mismo.",
        });
      }

      // Frases divertidas aleatorias
      const frases = [
        `😂 @${target.split("@")[0]} perdió el poder… el pueblo ha hablado.`,
        `😜 @${target.split("@")[0]} fue degradado… ya no manda ni en su casa.`,
        `🤣 @${target.split("@")[0]} bajó del trono, se acabó su reinado.`,
        `😏 @${target.split("@")[0]} ya no es admin… vuelve al lado humilde del grupo.`,
        `😅 @${target.split("@")[0]} intentó mantener el poder, pero el sistema dijo *NO*.`,
        `🤭 @${target.split("@")[0]} fue degradado… ahora puede disfrutar sin responsabilidades.`,
        `👋 @${target.split("@")[0]} perdió su corona, descansa admin caído.`,
        `🥴 @${target.split("@")[0]} pasó de jefe a espectador.`,
        `😎 @${target.split("@")[0]} ya no manda, pero sigue siendo buena gente.`,
      ];
      const frase = frases[Math.floor(Math.random() * frases.length)];

      // Ejecutar degradación
      await sock.groupParticipantsUpdate(from, [target], "demote");
      await sock.sendMessage(from, {
        text: frase,
        mentions: [target],
      });

    } catch (error) {
      console.log("❌ Error en comando !degradar:", error);
      await sock.sendMessage(from, {
        text: "⚠️ No se pudo degradar al usuario. Intenta nuevamente.",
      });
    }
  },
};
