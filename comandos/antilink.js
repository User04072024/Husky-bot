// 📁 comandos/antilink.js
module.exports = {
  name: "antilink",
  description: "Activa o desactiva el modo AntiLink en el grupo",
  async execute(sock, msg, chatConfig, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    if (!from.endsWith("@g.us")) return;

    const metadata = await sock.groupMetadata(from);
    const isAdmin = metadata.participants.some(
      (p) => p.id === sender && (p.admin === "admin" || p.admin === "superadmin")
    );

    if (!isAdmin) {
      await sock.sendMessage(from, { text: "🫵 Solo los *administradores* pueden usar este comando, crack 😎" });
      return;
    }

    // 🔧 Asegurar existencia del objeto global
    global.chats = global.chats || {};
    if (!global.chats[from]) global.chats[from] = { antilink: false };

    const opcion = args[0]?.toLowerCase();

    if (["1", "on", "activar"].includes(opcion)) {
      global.chats[from].antilink = true;
      await sock.sendMessage(from, { text: "🚨 *AntiLink activado.*\nPrepárense mortales, los links serán purgados 😏" });
      console.log(`🛡️ AntiLink activado en ${from}`);
    } else if (["0", "off", "desactivar"].includes(opcion)) {
      global.chats[from].antilink = false;
      await sock.sendMessage(from, { text: "✅ *AntiLink desactivado.*\nLos links vuelven a ser libres... por ahora 😈" });
      console.log(`⚙️ AntiLink desactivado en ${from}`);
    } else {
      await sock.sendMessage(from, {
        text: "📘 Usa:\n!antilink 1 → Activar\n!antilink 0 → Desactivar",
      });
    }
  },
};
