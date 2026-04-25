const fs = require("fs");
const path = require("path");

module.exports = {
  name: "setcookie",
  alias: ["sc", "cookie"],
  description: "Actualiza las cookies de YouTube",
  async execute(sock, m, args) {
    const from = m.key.remoteJid;
    
    // Solo tú o los admins deberían poder usar esto por seguridad
    if (!args[0]) return sock.sendMessage(from, { text: "⚠️ Pega la nueva cookie después del comando." });

    const nuevaCookie = args.join(" ");
    const cookiePath = path.join(__dirname, "../lib/cookies.txt");

    try {
      // Guardamos la cookie directamente en el archivo
      fs.writeFileSync(cookiePath, nuevaCookie, "utf8");
      
      await sock.sendMessage(from, { text: "✅ Cookies actualizadas correctamente en lib/cookies.txt. ¡Ya puedes intentar usar !play de nuevo!" }, { quoted: m });
    } catch (e) {
      console.error(e);
      await sock.sendMessage(from, { text: "❌ Error al guardar el archivo." });
    }
  }
};

