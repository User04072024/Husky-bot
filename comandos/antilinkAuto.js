const fs = require("fs");
const path = require("path");
require("events").EventEmitter.defaultMaxListeners = 50;

const dbFile = "./db.json";
const frasesFile = path.join(__dirname, "../lib/Fantilink.json");

// 📦 Cargar base de datos del bot
function loadDB() {
  try {
    if (fs.existsSync(dbFile)) {
      return JSON.parse(fs.readFileSync(dbFile, "utf8"));
    }
  } catch (err) {
    console.log("⚠️ Error cargando db.json:", err);
  }
  return { antilink: {}, grupos: {}, config: {} };
}

// 💾 Guardar base de datos
function saveDB(db) {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

// 📚 Cargar frases desde lib/Fantilink.json
function loadFrases() {
  try {
    if (fs.existsSync(frasesFile)) {
      return JSON.parse(fs.readFileSync(frasesFile, "utf8"));
    }
  } catch (err) {
    console.log("⚠️ Error cargando Fantilink.json:", err);
  }
  return { frasesAdmin: [], frasesKick: [] };
}

module.exports = {
  name: "antilinkAuto",
  async execute(sock, msg) {
    try {
      const from = msg.key.remoteJid;
      if (!from.endsWith("@g.us")) return;

      const sender = msg.key.participant || msg.key.remoteJid;
      const botNumber = sock.user?.id?.split(":")[0] + "@s.whatsapp.net";

      // 🧠 Si el mismo bot envía el mensaje → ignorar
      if (sender === botNumber || msg.key.fromMe) return;

      const body =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        "";

      if (!body) return;

      // 🔍 Detectar enlaces
      const regex = /\b((https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.[a-z]{2,}(\/[^\s]*)?)/gi;
      const contieneLink = regex.test(body);

      // Cargar base de datos actualizada
      let db = loadDB();
      
      if (!db.antilink[from]) db.antilink[from] = false;
      
      // Si no hay link o el antilink está apagado, no hacer nada
      if (!contieneLink || !db.antilink[from]) return;

      // Obtener datos del grupo para verificar permisos
      const metadata = await sock.groupMetadata(from);
      const isAdmin = metadata.participants.some(
        (p) => p.id === sender && (p.admin === "admin" || p.admin === "superadmin")
      );

      // 👑 CORRECCIÓN: Si es admin, ignorar en silencio
      if (isAdmin) return;

      // 👢 Si no es admin, proceder a borrar y eliminar
      const frasesData = loadFrases();
      const frasesKick = frasesData.frasesKick || [];

      try {
        // Borrar el mensaje
        await sock.sendMessage(from, {
          delete: {
            remoteJid: from,
            fromMe: false,
            id: msg.key.id,
            participant: sender,
          },
        });

        // Enviar frase de expulsión y remover usuario
        const frase = frasesKick[Math.floor(Math.random() * frasesKick.length)] || "🚫 Usuario eliminado por mandar link.";
        await sock.sendMessage(from, { text: frase });
        await sock.groupParticipantsUpdate(from, [sender], "remove");
        
      } catch (err) {
        console.log("❌ Error al eliminar o expulsar:", err);
      }
    } catch (err) {
      console.log("❌ Error en antilinkAuto:", err);
    }
  },
};

