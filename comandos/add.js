const moment = require('moment-timezone');

module.exports = {
  name: "add",
  description: "Agregar un usuario al grupo o enviar invitación",

  async execute(sock, msg, args, from) {
    try {
      if (!from.endsWith("@g.us")) {
        return sock.sendMessage(from, { text: "❌ Este comando solo funciona en grupos." }, { quoted: msg });
      }

      if (!args.length) {
        return sock.sendMessage(from, { text: "✦ *Ejemplo de uso:*\n!add 5493555555555" }, { quoted: msg });
      }

      const rawInput = args.join(" ");
      const cleanNumber = rawInput.replace(/[+\s\-()]/g, "");

      if (!/^\d+$/.test(cleanNumber)) {
        return sock.sendMessage(from, { text: "📍 El número proporcionado es inválido. Debe contener solo números." }, { quoted: msg });
      }

      const targetJid = `${cleanNumber}@s.whatsapp.net`;

      const exists = await sock.onWhatsApp(targetJid);
      if (!exists || !exists[0]?.exists) {
        return sock.sendMessage(from, { text: `📍 El número *[ ${cleanNumber} ]* no existe en WhatsApp.` }, { quoted: msg });
      }

      const mentionId = exists[0].jid;
      await msg.react?.("⏰");

      try {
        const response = await sock.groupParticipantsUpdate(from, [mentionId], "add");
        const status = response[0]?.status;

        if (status === '200' || status === 200) {
          const frases = [
            "🥳 Ya se introdujo por quien lloraban.",
            "🐺 La manada acaba de crecer.",
            "🔥 Llegó refuerzo al grupo.",
            "🎉 Por fin llegó quien hacía falta.",
            "😎 Se hizo lo imposible y ya está aquí."
          ];
          const frase = frases[Math.floor(Math.random() * frases.length)];

          return sock.sendMessage(from, {
            text: `┏━━━「 𝑯𝑼𝑺𝑲𝒀 – 𝑩𝑶𝑻 」━━━┓\n┃\n┃ 👤 @${mentionId.split("@")[0]}\n┃ ✅ Agregado con éxito.\n┃ ${frase}\n┃\n┗━━━━━━━━━━━━━━━━━━┛`,
            mentions: [mentionId]
          }, { quoted: msg });
        }

        else if (status === '409' || status === 409) {
          return sock.sendMessage(from, {
            text: `📍 El usuario @${mentionId.split("@")[0]} ya está en el grupo.`,
            mentions: [mentionId]
          }, { quoted: msg });
        }

        else {
          await enviarInvitacionPrivada(sock, from, msg, cleanNumber, mentionId);
        }

      } catch (addError) {
        console.error('Error al agregar:', addError);
        await enviarInvitacionPrivada(sock, from, msg, cleanNumber, mentionId);
      }

    } catch (err) {
      console.error("❌ Error General en !add:", err);
      await sock.sendMessage(from, { text: "⚠️ Ocurrió un error inesperado." }, { quoted: msg });
    }
  }
};

// --- Función de Invitación Privada ---

async function enviarInvitacionPrivada(sock, from, msg, cleanNumber, targetJid) {
  try {
    const groupMetadata = await sock.groupMetadata(from);
    const groupName = groupMetadata.subject || 'Grupo';
    const groupDesc = groupMetadata.desc ? groupMetadata.desc.trim() : null;
    const participantCount = groupMetadata.participants?.length || 0;
    const inviteCode = await sock.groupInviteCode(from);
    const link = `https://chat.whatsapp.com/${inviteCode}`;

    // Foto del grupo
    let groupPpUrl = "https://i.postimg.cc/9fWf5k4W/file-00000000bb2c71f7b7340939641cad9f.png";
    try {
      const pp = await sock.profilePictureUrl(from, 'image');
      if (pp) groupPpUrl = pp;
    } catch (_) {}

    // Caption sin repetir el título (title ya lo muestra arriba)
    const caption =
      `▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n` +
      `✦ *${groupName}*\n` +
      (groupDesc ? `┊ 📋 _${groupDesc}_\n` : '') +
      `┊ 👥 *${participantCount}* miembros\n` +
      `▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n` +
      `👋🏻 _Alguien te invitó a este grupo._\n` +
      `_Presiona el botón para unirte_ 🚀`;

    // Intentar con botón interactivo
    try {
      await sock.sendMessage(targetJid, {
        image: { url: groupPpUrl },
        caption: caption,
        title: "⌬ HUSKY – BOT",
        subtitle: `✦ ${groupName}`,
        footer: "HuskyDev · Alf",
        media: true,
        interactiveButtons: [
          {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "🚀 Unirse al grupo",
              url: link,
              merchant_url: link
            })
          }
        ]
      });

    } catch (btnError) {
      console.error('Botón interactivo falló, usando imagen + caption:', btnError);

      // Fallback 1: imagen con caption y link
      try {
        await sock.sendMessage(targetJid, {
          image: { url: groupPpUrl },
          caption: caption + `\n\n🔗 ${link}`
        });
      } catch (imgError) {
        console.error('Imagen falló, usando solo texto:', imgError);

        // Fallback 2: solo texto
        await sock.sendMessage(targetJid, {
          text: caption + `\n\n🔗 ${link}`
        });
      }
    }

    // Confirmación en el grupo
    return sock.sendMessage(from, {
      text:
        `⌬ *HUSKY – BOT*\n` +
        `▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n` +
        `👤 @${targetJid.split("@")[0]}\n` +
        `📩 Invitación privada enviada\n` +
        `📍 _Privacidad activa · enlace enviado_\n` +
        `▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰`,
      mentions: [targetJid]
    }, { quoted: msg });

  } catch (error) {
    console.error('Error general enviando invitación:', error);
    try {
      const inviteCode = await sock.groupInviteCode(from);
      return sock.sendMessage(from, {
        text: `📍 No pude enviar la invitación. Envíale el enlace manualmente:\nhttps://chat.whatsapp.com/${inviteCode}`
      }, { quoted: msg });
    } catch (e) {
      return sock.sendMessage(from, { text: "❌ No pude enviar la invitación privada." }, { quoted: msg });
    }
  }
}
