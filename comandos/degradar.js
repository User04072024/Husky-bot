module.exports = {
  name: "degradar",
  description: "Quita el rol de admin a un usuario (respondiendo su mensaje)",
  async execute(sock, msg, args, from, sender, db, saveDB, isOwner, sendMessageSafe, isAdmin, getGroupMetadata) {
    try {

      // Verificar que quien ejecuta sea admin
      if (!isAdmin && !isOwner) {
        return await sock.sendMessage(from, {
          text: "🚫 Solo los administradores pueden usar este comando.",
        }, { quoted: msg });
      }

      // Verificar que el mensaje sea una respuesta
      const target = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!target) {
        return await sock.sendMessage(from, {
          text: "❌ Responde al mensaje del admin que quieres degradar 😅",
        }, { quoted: msg });
      }

      // Degradar usuario directamente
      await sock.groupParticipantsUpdate(from, [target], "demote");

      // Frases graciosas aleatorias
      const frases = [
        "😂 ¡Ups! Se te cayó la corona.",
        "🤣 ¡Otro admin menos en el reino!",
        "👋 El poder se te subió a la cabeza, ahora baja al pueblo.",
        "💔 Te quitaron el trono, ex-admin.",
        "😜 Admin degradado con estilo.",
      ];
      const frase = frases[Math.floor(Math.random() * frases.length)];

      await sock.sendMessage(from, {
        text: `✅ ${frase}\n@${target.split("@")[0]} fue degradado.`,
        mentions: [target],
      }, { quoted: msg });

    } catch (error) {
      console.log("❌ Error en !degradar:", error);
      await sock.sendMessage(from, {
        text: "⚠️ No se pudo degradar al usuario 😞",
      }, { quoted: msg });
    }
  },
};
