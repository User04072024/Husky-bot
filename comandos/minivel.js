module.exports = {
  name: "minivel",
  alias: ["nivel", "xp"],
  description: "Muestra tu nivel, XP y progreso global en el sistema de leveling.",
  async execute(sock, msg, args, from, db) {
    try {
      const sender = msg.key.participant || msg.key.remoteJid;
      const user = db.usuarios[sender];

      if (!user) {
        await sock.sendMessage(from, { text: "⚠️ No se encontró información de tu progreso. Envía algunos mensajes para comenzar a subir de nivel." });
        return;
      }

      const messagesPerLevel = 60;
      const nivelesBase = ["Tierra", "Cobre", "Bronce", "Plata", "Oro", "Platino", "Diamante", "Titanio"];
      const emojis = ["🌱","🪙","🥉","🥈","🥇","💎","💠","⚡"];

      // Calcular nivel y rango actual
      const nivelIndex = Math.min(user.nivel, nivelesBase.length * 3);
      let nivelName, emoji;

      if (nivelIndex >= nivelesBase.length * 3) {
        nivelName = "Gran Maestro";
        emoji = "🏆";
      } else {
        const baseIndex = Math.floor(nivelIndex / 3);
        const subNivel = (nivelIndex % 3) + 1;
        nivelName = `${nivelesBase[baseIndex]} ${subNivel}`;
        emoji = emojis[baseIndex];
      }

      // 📊 Progreso global
      const maxXP = (nivelesBase.length * 3 + 1) * messagesPerLevel;
      const progressRatio = Math.min(user.xp / maxXP, 1);
      const progressBlocks = 20;
      const filledBlocks = Math.round(progressBlocks * progressRatio);
      const emptyBlocks = progressBlocks - filledBlocks;
      const progressBar = "█".repeat(filledBlocks) + "▒".repeat(emptyBlocks);
      const progressPercent = Math.round(progressRatio * 100);

      // 🧾 Mensaje informativo
      const texto = 
`🌟✨ *TUS ESTADÍSTICAS* ✨🌟

👤 *Usuario:* ${user.name}
🏅 *Rango actual:* ${nivelName} ${emoji}
💫 *Nivel:* ${user.nivel}
💎 *XP total:* ${user.xp}
💬 *Mensajes enviados:* ${user.count}

📊 *Progreso global:*  
${progressBar} ${progressPercent}%

🚀 ¡Sigue activo y alcanza el máximo poder! ⚔️`;

      await sock.sendMessage(from, { text: texto, mentions: [sender] });
    } catch (err) {
      console.error("❌ Error ejecutando comando !minivel:", err);
      await sock.sendMessage(from, { text: "⚠️ Error al mostrar tu información de nivel." });
    }
  }
};
