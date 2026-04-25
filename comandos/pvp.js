module.exports = {
  name: "pvp",
  description: "Desafía a otro usuario a una batalla divertida de humor y caos",
  async execute(sock, msg, args, from) {
    try {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      let userToFight;

      // Si se responde a alguien
      if (contextInfo?.participant) {
        userToFight = contextInfo.participant;
      } else if (contextInfo?.mentionedJid && contextInfo.mentionedJid.length > 0) {
        userToFight = contextInfo.mentionedJid[0];
      }

      // Si no se mencionó ni se respondió a nadie
      if (!userToFight) {
        return await sock.sendMessage(
          from,
          {
            text: `⚔️ *Modo correcto de uso:*\n\n👉 *!pvp @usuario* o respondiendo a su mensaje.\n\nEjemplo:\n!pvp @Carlos\n\n💡 Desafía a alguien a una batalla de humor legendaria.`,
          },
          { quoted: msg }
        );
      }

      const challenger = msg.pushName || "Desconocido";
      const opponentTag = `@${userToFight.split("@")[0]}`;

      // 1️⃣ — Reto inicial
      const inicio = `🎮 *${challenger}* desafía a ${opponentTag} a una batalla de memes, caos y honor legendario 🔥`;
      await sock.sendMessage(from, { text: inicio, mentions: [userToFight] }, { quoted: msg });

      // Pausa antes de la historia
      await new Promise((r) => setTimeout(r, 2000));

      // 2️⃣ — Historias aleatorias largas y graciosas
      const historias = [
        `⌛ Cargando los guantes inflables...
💫 Los combatientes se miran con cara de 😤
🐔 Un gallo se cuela en el campo y grita: “¡PELEA YA!”
💥 ¡Primer golpe! pero fue al aire...
🤣 Ambos se caen intentando esquivar.
🧃 Pausa para tomar jugo y revisar los stickers nuevos.
🎶 El público empieza a cantar: ¡OLEEEE OLEEEE! 🎵`,

        `🎭 ${challenger} llega con capa hecha de toalla y una escoba como espada.
🪄 ${opponentTag} responde con una chancleta mágica legendaria.
💥 El choque hace temblar los grupos de WhatsApp.
📸 Un moderador grita: “¡ESTO SE VA A DESCONTROLAR!”
😂 Nadie sabe quién gana, pero todos disfrutan el espectáculo.`,

        `🧙‍♂️ ${challenger} invoca un poder ancestral del sticker de Goku.
⚡ ${opponentTag} responde con un meme de Shrek versión ultra instinto.
🔥 El grupo entero arde de risa.
📞 La abuela de ${opponentTag} entra al chat: “¡DEJEN ESA PELEA Y VAYAN A COMER!”`,

        `🍕 ${challenger} lanza una pizza ninja 🍕
🥤 ${opponentTag} esquiva y contraataca con un combo de Pony Malta.
🧃 Ambos se sientan a tomar un descanso porque se cansaron rápido.
🎤 El público grita: “¡REMATCH!”`,

        `🦸‍♂️ ${challenger} llega como superhéroe, pero con la capa al revés.
💃 ${opponentTag} baila champeta para esquivar.
🎯 El árbitro se distrae viendo TikToks.
😂 Un perro pasa ladrando “¡DALEEEE!” y roba la escena.`,

        `🎩 ${challenger} aparece con bigote falso y bastón de poder.
💋 ${opponentTag} lanza un beso explosivo.
🍌 Una cáscara aparece de la nada y todos resbalan.
📸 Alguien del grupo grita: “¡Screenshot de esta pelea ya!”`,

        `💻 ${challenger} intenta usar un hack de pelea, pero abre la calculadora.
📱 ${opponentTag} le responde con un sticker de “ERROR 404”.
🔥 El servidor del grupo tiembla por tanta risa.
🎮 El narrador dice: “Esto no es una pelea, es arte moderno.”`,

        `🧃 ${challenger} trae un refuerzo secreto: una cabra llamada Pancracio 🐐
💥 Pancracio embiste al aire mientras ${opponentTag} se defiende con memes de gato.
🎵 El fondo suena con Bad Bunny en flauta desafinada.
😂 Nadie entiende nada, pero todos aplauden.`,

        `🎮 ${challenger} carga poder con un grito legendario.
🌪️ ${opponentTag} activa el modo “No me toques que me caigo”.
💥 Colisión de energías, y el grupo entero siente la vibración del chisme.
🍉 Alguien lanza una sandía y termina la pelea sin razón.`,

        `🔥 ${challenger} invoca una tormenta de memes.
⚡ ${opponentTag} responde con un GIF prohibido de 2015.
🎭 El público grita: “¡ESTO ES POR LOS STICKERS!”
🐢 Una tortuga cruza lentamente y gana el round por aburrimiento.`
      ];

      const historia = historias[Math.floor(Math.random() * historias.length)];
      await sock.sendMessage(from, { text: historia, mentions: [userToFight] });

      // Pausa antes del resultado final
      await new Promise((r) => setTimeout(r, 2500));

      // 3️⃣ — Resultado final
      const ganador = Math.random() < 0.5 ? challenger : opponentTag;
      const finales = [
        `🏆 *${ganador}* ganó porque el otro se resbaló con una cáscara de banano 🍌`,
        `🎉 *${ganador}* fue coronado como *Rey del Meme Supremo* 👑`,
        `😂 *${ganador}* ganó porque el público no paraba de reírse de su baile.`,
        `💥 *${ganador}* usó su poder secreto: el *Sticker Legendario del 2016*.`,
        `🎖️ *${ganador}* ganó porque invocó a la abuela para poner orden.`,
        `🥇 *${ganador}* fue declarado campeón por decreto del gallo juez 🐔.`,
        `🍕 *${ganador}* ganó y se comió una pizza entera como trofeo.`,
        `💫 *${ganador}* venció gracias a la fuerza del chisme cósmico ☕.`,
        `🦆 *${ganador}* ganó porque el pato árbitro así lo decidió.`,
        `🎭 *${ganador}* fue proclamado héroe del grupo por el público ebrio de risa.`
      ];

      const resultado = finales[Math.floor(Math.random() * finales.length)];
      await sock.sendMessage(from, { text: resultado, mentions: [userToFight] });

    } catch (err) {
      console.error("❌ Error ejecutando comando PVP:", err);
      await sock.sendMessage(from, { text: "❌ Ocurrió un error en la batalla PvP 😢" }, { quoted: msg });
    }
  },
};
