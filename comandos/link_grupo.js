module.exports = {
  name: "glink",
  alias: ["link", "enlace"],
  desc: "Obtiene el link del grupo en formato tarjeta PRO",

  async execute(sock, msg, args, from) {
    try {
      const group = from;

      // 📊 Metadata del grupo
      const metadata = await sock.groupMetadata(group);
      const groupName = metadata.subject;

      // 👤 Owner del grupo
      let owner = "Owner";
      try {
        if (metadata.owner) {
          owner = `@${metadata.owner.split("@")[0]}`;
        }
      } catch {}

      // 📜 Descripción del grupo
      const desc = metadata.desc || null;

      // 📸 Foto del grupo
      let pp;
      try {
        pp = await sock.profilePictureUrl(group, "image");
      } catch {
        pp = "https://files.catbox.moe/xr2m6u.jpg";
      }

      // 🔗 Link
      const code = await sock.groupInviteCode(group);
      const link = `https://chat.whatsapp.com/${code}`;

      // 🎨 Tarjeta dinámica
      let message = `
╭━━━〔 ${groupName} 〕━━━⬣
┃
┃ 👤 *Creador:* ${owner}
┃
┃ 🔗 *LINK DIRECTO*
┃ ╰➤ ${link}
┃
`;

      // 📜 Solo si hay descripción
      if (desc) {
        message += `┃ 📜 *Descripción:*\n┃ ${desc}\n┃\n`;
      }

      message += `╰━━━━━━━━━━━━━━━━━━⬣`;

      // 📤 Enviar con mención si hay owner
      await sock.sendMessage(group, {
        image: { url: pp },
        caption: message,
        mentions: metadata.owner ? [metadata.owner] : []
      }, { quoted: msg });

    } catch (err) {
      console.error("❌ Error en !glink:", err);

      await sock.sendMessage(from, {
        text: "⚠️ No se pudo obtener la información del grupo.\n\n🔒 El bot debe ser administrador."
      }, { quoted: msg });
    }
  },
};
