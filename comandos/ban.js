const path = require("path");
const fs = require("fs");

const phrasesPath = path.join(__dirname, "../lib/ban.json");
let frases = {};
if (fs.existsSync(phrasesPath)) {
  try { frases = JSON.parse(fs.readFileSync(phrasesPath)); } catch (e) {}
}

module.exports = {
  name: "ban",
  description: "Eliminar a un usuario del grupo con protección y video",

  async execute(sock, msg, args, from, sender, db, saveDB, isOwner, sendMessageSafe, isAdmin) {
    try {
      console.log(`\n--- 🛡️ INICIO PROCESO BAN EN: ${from} ---`);

      if (!from.endsWith("@g.us")) {
        return sock.sendMessage(from, { text: "❌ Solo en grupos." }, { quoted: msg });
      }

      // 📌 1. Metadata
      const groupMetadata = await sock.groupMetadata(from);
      const participants = groupMetadata.participants || [];

      // 📌 2. BOT (FORMA CORRECTA USANDO JID)
      const botNumber = sock.user.id.split(':')[0];

      const botData = participants.find(u => {
        return u.jid === botNumber + "@s.whatsapp.net";
      });

      const botIsAdmin = ["admin", "superadmin"].includes(botData?.admin);

      // 📌 3. SENDER
      const senderIsAdmin = isAdmin;

      // 🧪 DEBUG
      console.log(`👤 Sender real: ${sender}`);
      console.log(`👤 Número sender: ${sender.split('@')[0]}`);
      console.log(`👤 ¿Es admin?: ${senderIsAdmin}`);

      console.log("🤖 Buscando bot con número:", botNumber);
      console.log("📋 Admins en el grupo:", participants.filter(p => p.admin).map(p => p.id));
      console.log("📋 TODOS los participants:", participants.map(p => p.id));
      console.log("🤖 sock.user.id completo:", sock.user.id);

      console.log("🤖 Bot encontrado:", JSON.stringify(botData));

      // 📌 4. Validaciones
      if (!senderIsAdmin && !isOwner) {
        return sock.sendMessage(from, {
          text: "🤡 No tienes rango para dar órdenes."
        }, { quoted: msg });
      }

      if (!botIsAdmin) {
        return sock.sendMessage(from, {
          text: "⚠️ No soy admin.\nDame admin para poder ejecutar el ban."
        }, { quoted: msg });
      }

      // 📌 5. Detectar objetivo
      let targetId =
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
        msg.message?.extendedTextMessage?.contextInfo?.participant;

      if (!targetId && args[0]) {
        const num = args[0].replace(/[^0-9]/g, "");
        if (num) targetId = num + "@s.whatsapp.net";
      }

      if (!targetId) {
        return sock.sendMessage(from, {
          text: "❌ Menciona, responde o escribe el número."
        }, { quoted: msg });
      }

      console.log(`🎯 targetId raw: ${targetId}`);

      // 📌 6. Buscar target (compatible LID + normal)
      const todosLid = participants.every(p => p.id.endsWith("@lid"));
      let targetData = null;

      if (todosLid) {
        if (targetId.endsWith("@lid")) {
          targetData = participants.find(u => u.id === targetId);
        } else {
          const targetNum = targetId.split("@")[0];

          const targetLid = Object.values(db?.lidmap || {}).find(lid =>
            lid.includes(targetNum)
          );

          if (targetLid) {
            targetData = participants.find(u => u.id === targetLid);
            console.log(`🎯 Target LID resuelto: ${targetNum} → ${targetLid}`);
          } else {
            targetData = participants.find(u =>
              u.jid?.includes(targetNum)
            );
            console.log(`⚠️ Fallback por jid: ${targetData?.id || "no encontrado"}`);
          }
        }
      } else {
        targetData = participants.find(u =>
          targetId.includes(u.id.split('@')[0]) ||
          u.id === targetId
        );
      }

      if (!targetData) {
        return sock.sendMessage(from, {
          text: "❌ Usuario no encontrado en el grupo.\n💡 Debe haber enviado un mensaje recientemente."
        }, { quoted: msg });
      }

      console.log(`🎯 Target encontrado: ${targetData.id} | admin: ${targetData.admin}`);

      // 🚫 PROTECCIONES
      if (["admin", "superadmin"].includes(targetData.admin)) {
        return sock.sendMessage(from, {
          text: "⚠️ No puedes eliminar a otro admin."
        }, { quoted: msg });
      }

      if (targetData.id === sender) {
        return sock.sendMessage(from, {
          text: "🤡 No puedes banearte a ti mismo."
        }, { quoted: msg });
      }

      const esBotTarget = targetData.jid === botNumber + "@s.whatsapp.net";

      if (esBotTarget) {
        return sock.sendMessage(from, {
          text: "🤖 No puedo eliminarme."
        }, { quoted: msg });
      }

      // 📌 7. Mensaje previo
      const videoPath = path.join(__dirname, "../media/banbye.mp4");

      const fraseExito =
        (frases.ban_success?.length > 0)
          ? frases.ban_success[Math.floor(Math.random() * frases.ban_success.length)]
          : "Adiós 👋";

      const textoFinal =
        `✅ *¡ELIMINADO!*\n\n@${targetData.id.split("@")[0]} fuera del grupo.\n\n🔥 ${fraseExito}`;

      if (fs.existsSync(videoPath)) {
        await sock.sendMessage(from, {
          video: { url: videoPath },
          caption: textoFinal,
          gifPlayback: true,
          mentions: [targetData.id]
        }, { quoted: msg });
      } else {
        await sock.sendMessage(from, {
          text: textoFinal,
          mentions: [targetData.id]
        }, { quoted: msg });
      }

      // ⏳ Delay visual
      await new Promise(res => setTimeout(res, 1000));

      // 📌 8. BAN REAL
      await sock.groupParticipantsUpdate(from, [targetData.id], "remove");

      console.log(`✅ BAN ejecutado: ${targetData.id}`);

    } catch (err) {
      console.error("🔴 ERROR BAN:", err);
      await sock.sendMessage(from, {
        text: "⚠️ Error al ejecutar el ban."
      }, { quoted: msg });
    }
  }
};
