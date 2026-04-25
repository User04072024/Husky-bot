const fs = require("fs");

module.exports = {
  name: "bye",
  description: "Activa o desactiva los mensajes de despedida para los que salen del grupo.",

  async execute(sock, msg, args, from, db) {
    const status = args[0];
    if (!["1", "0"].includes(status)) {
      return sock.sendMessage(from, {
        text: "⚙️ Usa el comando así:\n!bye 1 para activar\n!bye 0 para desactivar"
      });
    }

    db.bye = db.bye || {};
    db.bye[from] = status === "1";

    fs.writeFileSync("./db.json", JSON.stringify(db, null, 2));
    const state = status === "1" ? "✅ *Despedidas activadas*" : "❌ *Despedidas desactivadas*";
    sock.sendMessage(from, { text: state });
  },

  // ✅ Evita duplicados + muestra nombre visible
  async onParticipantRemove(sock, groupMetadata, participant, db, action) {
    const from = groupMetadata.id;
    if (!db.bye || !db.bye[from]) return;

     // 🆕 Detectar tanto expulsión (remove) como salida voluntaria (leave)
    if (action && !["remove", "leave"].includes(action)) return;

    // Protección contra duplicados (2 segundos)
    global.lastBye = global.lastBye || {};
    const last = global.lastBye[participant];
    const now = Date.now();
    if (last && now - last < 2000) return;
    global.lastBye[participant] = now;

    // Obtener nombre o número visible
    let name;
    try {
      name = await sock.getName(participant);
      if (!name) name = participant.split("@")[0];
    } catch {
      name = participant.split("@")[0];
    }

    const frases = [
      `👋 @${participant.split("@")[0]} se marchó… el chat guardará un minuto de silencio (o un sticker triste).`,
      `😢 @${participant.split("@")[0]} abandonó el barco. ¡Buena suerte en tus nuevas aventuras!`,
      `🚪 @${participant.split("@")[0]} se fue sin mirar atrás, como en las mejores películas.`,
      `🌪️ @${participant.split("@")[0]} desapareció entre los mensajes. El caos continúa sin él.`,
      `🎭 @${participant.split("@")[0]} hizo su última aparición y salió del escenario.`,
      `🕊️ @${participant.split("@")[0]} voló libre como un meme en tendencia.`,
      `🔥 @${participant.split("@")[0]} se fue, pero dejó huellas de pura energía.`,
      `🧳 @${participant.split("@")[0]} empacó sus stickers y dejó el grupo.`,
      `💨 @${participant.split("@")[0]} se esfumó como los datos móviles al ver videos.`,
      `🌙 @${participant.split("@")[0]} salió del grupo, pero su espíritu de chat sigue presente.`,
      `🦋 @${participant.split("@")[0]} partió hacia nuevos grupos y mejores memes.`,
      `🎇 @${participant.split("@")[0]} se despidió con estilo. ¡Buena vibra en tu camino!`,
      `🌈 @${participant.split("@")[0]} dejó el grupo, pero se llevó todo el color con él.`,
      `🪦 @${participant.split("@")[0]} fue eliminado de la lista... que los stickers lo acompañen.`,
      `🏃 @${participant.split("@")[0]} escapó antes de que empiecen los mensajes de voz.`,
      `🥀 @${participant.split("@")[0]} se fue y el grupo se siente un poco más vacío.`,
      `🚀 @${participant.split("@")[0]} emprendió viaje al espacio de otros grupos.`,
      `🧙‍♂️ @${participant.split("@")[0]} lanzó su último hechizo y desapareció.`,
      `🎭 @${participant.split("@")[0]} salió del grupo, fin de su temporada.`,
      `⚡ @${participant.split("@")[0]} dejó una descarga de energía antes de irse.`,
      `🧩 @${participant.split("@")[0]} ya no está, falta una pieza en el rompecabezas.`,
      `🔥 @${participant.split("@")[0]} se fue, pero el grupo sigue ardiendo.`,
      `🌍 @${participant.split("@")[0]} partió hacia nuevas conversaciones globales.`,
      `💫 @${participant.split("@")[0]} se fue dejando una estela de buena vibra.`,
      `🕶️ @${participant.split("@")[0]} salió con estilo, sin decir adiós.`,
      `🎤 @${participant.split("@")[0]} dejó el micrófono y se fue.`,
      `🌪️ @${participant.split("@")[0]} desapareció tan rápido que ni el bot lo notó.`,
      `📉 @${participant.split("@")[0]} se fue y el nivel de memes bajó un poco.`,
      `🏰 @${participant.split("@")[0]} dejó el reino del chat. Su legado quedará.`,
      `🕊️ @${participant.split("@")[0]} voló lejos, pero su eco aún resuena en los stickers.`
    ];

    const frase = frases[Math.floor(Math.random() * frases.length)];
    await sock.sendMessage(from, { text: frase, mentions: [participant] });
  },
};

