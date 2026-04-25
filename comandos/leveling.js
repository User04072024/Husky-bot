// leveling.js
const fs = require("fs");

module.exports = {
  name: "leveling",
  description: "Activa o desactiva el sistema de niveles",
  execute: async (sock, msg, args, from, db, saveDB) => {
    if (!args[0]) return sock.sendMessage(from, { text: "❌ Usa !leveling 1 para activar o 0 para desactivar." });                                                                      
    const estado = args[0] === "1" ? true : false;
    
    if (!db.config) db.config = {};
    db.config.leveling = estado;
    saveDB();
    
    await sock.sendMessage(from, { text: `✅ Sistema de niveles ${estado ? "activado" : "desactivado"}.` });
  },
};

// Manejo automático de niveles al enviar mensajes
module.exports.handleMessage = async (sock, msg, db, saveDB) => {
  // 1. Verificación de seguridad y activación
  if (!db.config?.leveling) return;
  // Ignorar mensajes sin contenido o de estados (broadcast)
  if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

  // 2. Determinación de IDs
  // El sender es el ID del usuario, esencial para la DB (en grupo es participant, si no, es remoteJid)
  const sender = msg.key.participant || msg.key.remoteJid;
  // El chatJid es el destino del mensaje (el grupo o chat privado)
  const chatJid = msg.key.remoteJid; 
  const pushName = msg.pushName || "Usuario";
  
  // 3. Inicializar y actualizar datos del usuario
  
  // CORRECCIÓN CLAVE: Asegurar que el objeto db.usuarios existe antes de usarlo.
  if (!db.usuarios) db.usuarios = {}; 
  
  if (!db.usuarios[sender]) {
    db.usuarios[sender] = { count: 0, xp: 0, nivel: 0, name: pushName };
  }

  const user = db.usuarios[sender];
  // Asegurar que el nombre se actualiza si el usuario lo cambia
  user.name = pushName; 
  user.count++;
  user.xp++;

  const messagesPerLevel = 20; // cada 20 mensajes sube de nivel
  const oldLevel = user.nivel;
  user.nivel = Math.floor(user.xp / messagesPerLevel);
  // Guardamos la DB inmediatamente después de sumar XP y calcular el nivel
  saveDB();

  // 4. Cálculo del nombre de nivel
  const nivelesBase = ["Tierra", "Cobre", "Bronce", "Plata", "Oro", "Platino", "Diamante", "Titanio"];
  const emojis = ["🌱","🪙","🥉","🥈","🥇","💎","💠","⚡"];

  let nivelIndex = user.nivel; 

  let nivelName, emoji;
  const maxBaseLevels = nivelesBase.length * 3;
  
  if (nivelIndex >= maxBaseLevels) {
    nivelName = "Gran Maestro";
    emoji = "🏆";
  } else {
    // Evita el error "Index out of bounds" en los arrays
    const baseIndex = Math.min(Math.floor(nivelIndex / 3), nivelesBase.length - 1); 
    const subNivel = (nivelIndex % 3) + 1;
    nivelName = `${nivelesBase[baseIndex]} ${subNivel}`;
    emoji = emojis[baseIndex];
  }

  // 5. Notificación de subida de nivel
  if (oldLevel < user.nivel) {
    // Prepara el ID para la mención en el texto (solo la parte numérica antes del @)
    const senderMentionId = sender.split('@')[0];
    
    await sock.sendMessage(chatJid, {
      text: `*🎉 LEVEL UP! ✨*\n\n` +
            `¡Enhorabuena *@${senderMentionId}*! Has alcanzado el Nivel *${user.nivel}*.\n` +
            `• XP acumulada: *${user.xp} XP*\n` +
            `• Rango desbloqueado: *${nivelName} ${emoji}*\n\n` +
            `💡 Sigue interactuando para desbloquear más rangos y recompensas! 🚀`,
      // Se necesita el ID completo para que la mención sea efectiva
      mentions: [sender] 
    });
  }
};

