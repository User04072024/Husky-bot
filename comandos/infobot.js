const os = require("os");

module.exports = {
  name: "infobot",
  alias: ["status", "botinfo", "info"],

  async execute(sock, m, args) {
    try {
      const mem = process.memoryUsage();
      const uptime = process.uptime();
      const jid = m.key.remoteJid; // ✅ JID correcto

      const formatMB = (b) => (b / 1024 / 1024).toFixed(2);

      const text = `🤖 *INFO DEL BOT*

🧠 RAM:
• RSS: ${formatMB(mem.rss)} MB
• Heap: ${formatMB(mem.heapUsed)} MB

🖥️ SISTEMA:
• RAM Total: ${formatMB(os.totalmem())} MB
• RAM Libre: ${formatMB(os.freemem())} MB

⏱️ UPTIME:
• ${Math.floor(uptime)} segundos

🆔 PID:
• ${process.pid}
`;

      await sock.sendMessage(
        jid,
        { text },
        { quoted: m }
      );

    } catch (err) {
      console.error("Error infobot:", err);

      if (m?.key?.remoteJid) {
        await sock.sendMessage(
          m.key.remoteJid,
          { text: "❌ Error obteniendo info del bot" }
        );
      }
    }
  }
};
