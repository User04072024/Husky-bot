const fs = require("fs");
const path = require("path");

module.exports = {
  name: "promover",
  description: "Promueve a un usuario a admin con estilo",
  async execute(sock, msg, args, from) {
    try {
      if (!from.endsWith('@g.us')) return;

      console.log(`\n--- 🛡️ INICIO PROCESO PROMOVER EN: ${from} ---`);

      // 1. OBTENER METADATOS Y PARTICIPANTES
      const groupMetadata = await sock.groupMetadata(from);
      const participants = groupMetadata.participants;
      const groupName = groupMetadata.subject;

      // --- EL TRUCO MAESTRO: Detectar al bot por su propia sesión real ---
      const botRealId = sock.user.id.includes(':') ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : sock.user.id;
      
      const botInList = participants.find(u => 
        u.id.split('@')[0] === botRealId.split('@')[0] || 
        u.id === sock.user.id ||
        (u.admin !== null && u.id.includes('lid')) // Detectar si es el admin con LID
      );

      // 2. IDENTIFICAR AL EMISOR (Tú)
      const sender = msg.key.participant || msg.participant;
      const senderData = participants.find(u => u.id === sender);
      const senderIsAdmin = senderData?.admin === 'admin' || senderData?.admin === 'superadmin';

      console.log(`👤 Tu ID (Sender): ${sender}`);
      console.log(`👤 ¿Eres Admin?: ${senderIsAdmin}`);
      console.log(`🤖 ID detectado en lista: ${botInList?.id || 'NO ENCONTRADO'}`);

      // 3. VALIDACIÓN DE PODER
      const botIsAdmin = botInList?.admin === 'admin' || botInList?.admin === 'superadmin';

      if (!senderIsAdmin) {
        const burlas = [
          "🤣 ¿Tú dándole órdenes al bot? Sigue soñando.",
          "🤫 Shhh... los plebeyos no hablan aquí.",
          "🤡 Error 404: Los huevos para ser admin no fueron encontrados."
        ];
        return await sock.sendMessage(from, { text: burlas[Math.floor(Math.random() * burlas.length)] }, { quoted: msg });
      }

      if (!botIsAdmin) {
        return await sock.sendMessage(from, { 
          text: "⚠️ No puedo ascender a nadie si no soy admin. ¡No seas tacaño y dame el rango!" 
        }, { quoted: msg });
      }

      // 4. IDENTIFICAR AL OBJETIVO (A quién promover)
      let targetId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                     msg.message?.extendedTextMessage?.contextInfo?.participant;

      if (!targetId && args[0]) {
        targetId = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
      }

      if (!targetId) {
        return await sock.sendMessage(from, { text: "❌ Menciona o responde al mensaje de quien quieres hacer admin." }, { quoted: msg });
      }

      // Buscamos el ID real de la víctima en la lista (por si es LID)
      const targetData = participants.find(u => 
        u.id.split('@')[0] === targetId.split('@')[0] || u.id === targetId
      );

      if (!targetData) {
        return await sock.sendMessage(from, { text: "❌ Ese usuario no está en el grupo." }, { quoted: msg });
      }

      // 5. EJECUCIÓN DE PROMOCIÓN
      console.log(`🆙 Ascendiendo a: ${targetData.id}`);
      await sock.groupParticipantsUpdate(from, [targetData.id], "promote");

      // Cargar frases del JSON
      let fraseAleatoria = "¡Bienvenido al Olimpo de los Admins!";
      try {
        const filePath = path.join(__dirname, "../lib/promover.json");
        if (fs.existsSync(filePath)) {
          const jsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));
          fraseAleatoria = jsonData.promover[Math.floor(Math.random() * jsonData.promover.length)];
        }
      } catch (e) { /* fallback */ }

      await sock.sendMessage(from, {
        text: `✅ *@${targetData.id.split('@')[0]} ahora tiene poder.*\n\n⭐ ${fraseAleatoria}`,
        mentions: [targetData.id]
      }, { quoted: msg });

    } catch (error) {
      console.error("❌ Error en promover:", error);
      await sock.sendMessage(from, { text: "⚠️ No pude hacerlo. Revisa si el usuario ya es admin." }, { quoted: msg });
    }
  }
};

