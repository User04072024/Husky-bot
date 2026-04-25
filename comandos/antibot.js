const fs = require('fs');
global.antibotConfig = global.antibotConfig || {}; 

// Almacén temporal para detectar spam de velocidad
const messageLog = new Map();

module.exports = {
  name: "antibot",
  alias: ["detectbot"],
  desc: "Activa/Desactiva la detección de bots por comportamiento",
  async execute(sock, msg, args, from, isGroupAdmins) {
    if (!from.endsWith('@g.us')) return;
    if (!isGroupAdmins) return;

    const mode = args[0]?.toLowerCase();
    if (mode === 'on') {
      global.antibotConfig[from] = true;
      await sock.sendMessage(from, { text: "🛡️ *Antibot Inteligente activado.*\n\nDetectaré bots por IDs de librería y por comportamiento (menciones masivas)." });
    } else if (mode === 'off') {
      global.antibotConfig[from] = false;
      await sock.sendMessage(from, { text: "❌ *Antibot desactivado.*" });
    }
  },

  async monitor(sock, msg, from) {
    if (!global.antibotConfig?.[from]) return; 
    if (msg.key.fromMe || !from.endsWith('@g.us')) return;

    const sender = msg.key.participant || msg.key.remoteJid;
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const isBaileys = msg.key.id.startsWith('BAE5') || msg.key.id.startsWith('3EB0');

    let isBotDetected = false;
    let reason = "";

    // 1. Detección por ID de Librería (El bot clásico)
    if (isBaileys) {
        isBotDetected = true;
        reason = "ID de librería detectado (Baileys/Web)";
    }

    // 2. Detección por Menciones Masivas (El bot de spam "invencible")
    // Si menciona a más de 5 personas en un solo mensaje y no es admin
    if (!isBotDetected && mentions.length > 5) {
        isBotDetected = true;
        reason = "Menciones masivas detectadas";
    }

    // 3. Detección por Spam de Velocidad (Opcional)
    const now = Date.now();
    const userLog = messageLog.get(sender) || [];
    userLog.push(now);
    // Mantener solo los últimos 5 segundos
    const recentMessages = userLog.filter(time => now - time < 5000);
    messageLog.set(sender, recentMessages);

    if (!isBotDetected && recentMessages.length > 7) { // 7 mensajes en 5 segundos
        isBotDetected = true;
        reason = "Spam de mensajes ultra rápido";
    }

    if (isBotDetected) {
      try {
        const groupMetadata = await sock.groupMetadata(from);
        const botId = sock.user.id.split(':')[0];
        const me = groupMetadata.participants.find(p => p.id.includes(botId));
        
        if (!me?.admin) return; // Si mi bot no es admin, no puede hacer nada

        // Si el intruso es admin, NO lo tocamos (para evitar guerras de bots)
        const senderData = groupMetadata.participants.find(p => p.id === sender);
        if (senderData?.admin) return;

        console.log(`[ANTIBOT] Castigando a @${sender.split('@')[0]} por: ${reason}`);

        const advertirCmd = require('./advertir.js');
        await advertirCmd.execute(sock, msg, [`@${sender.split('@')[0]}`, reason], from, true);

        await sock.sendMessage(from, { 
          text: `🛡️ *SISTEMA ANTIBOT*\n\nSe detectó comportamiento automático de @${sender.split('@')[0]}.\n*Razón:* ${reason}`,
          mentions: [sender]
        });

      } catch (err) {
        console.error("Error en Antibot:", err.message);
      }
    }
  }
};

