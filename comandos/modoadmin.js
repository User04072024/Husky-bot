module.exports = {
  name: "modoadmin",
  description: "Restringe comandos administrativos solo a los admins del grupo",
  async execute(sock, msg, args, from, db, saveDB) {
    const sender = msg.key.participant || msg.key.remoteJid;

    if (!from.endsWith("@g.us")) {
      return await sock.sendMessage(from, { text: "❌ Este comando solo funciona en grupos." });
    }

    // Verificar si quien ejecuta es admin para cambiar la configuración
    try {
      const groupMetadata = await sock.groupMetadata(from);
      const groupAdmins = groupMetadata.participants
        .filter((p) => p.admin !== null)
        .map((p) => p.id);

      if (!groupAdmins.includes(sender)) {
        return await sock.sendMessage(from, { text: "⚠️ Solo los admins pueden configurar el filtro de seguridad." }, { quoted: msg });
      }

      const opcion = args[0];
      if (!["0", "1"].includes(opcion)) {
        return await sock.sendMessage(from, { text: "❌ Usa:\n!modoadmin 1 (Activar protección administrativa)\n!modoadmin 0 (Cualquiera puede intentar usar comandos admin)" }, { quoted: msg });
      }

      if (!db.modoadmin) db.modoadmin = {};
      db.modoadmin[from] = (opcion === "1" ? 1 : 0);
      saveDB();

      const estado = opcion === "1" ? "ACTIVADA ✅ (Comandos de gestión bloqueados para usuarios comunes)" : "DESACTIVADA ❌ (Cualquier usuario puede intentar usar comandos de gestión)";
      await sock.sendMessage(from, { text: `🛡️ Protección administrativa ${estado}.` }, { quoted: msg });

    } catch (e) {
      console.error(e);
    }
  },
};

