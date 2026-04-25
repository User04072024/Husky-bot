module.exports = {
  name: "antilink",
  description: "Activa o desactiva el sistema AntiLink en el grupo",

  async execute(sock, msg, chatConfig, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isGroup = from.endsWith("@g.us");

    if (!isGroup) {
      await sock.sendMessage(from, { text: "❌ Este comando solo funciona en grupos." });
      return;
    }

    if (!args[0]) {
      await sock.sendMessage(from, {
        text: `📊 Estado actual del *AntiLink*: ${chatConfig.antilink ? "✅ Activado" : "❌ Desactivado"}\n\nUsa:\n!antilink 1 → Activar\n!antilink 0 → Desactivar`
      });
      return;
    }

    const option = args[0];
    if (option === "1") {
      chatConfig.antilink = true;
      await sock.sendMessage(from, { text: "🛡️ *AntiLink ACTIVADO.* Todos los links serán eliminados y los usuarios expulsados 🚫" });
    } else if (option === "0") {
      chatConfig.antilink = false;
      await sock.sendMessage(from, { text: "⚠️ *AntiLink DESACTIVADO.* Ahora se permiten enlaces temporalmente ✅" });
    } else {
      await sock.sendMessage(from, { text: "❗ Usa:\n!antilink 1 → Activar\n!antilink 0 → Desactivar" });
    }
  },
};
