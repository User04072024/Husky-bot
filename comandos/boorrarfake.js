const fs = require("fs");
const path = require("path");

// Ruta del JSON de frases burlonas
const frasesPath = path.join(__dirname, "../lib/frases_grupo_delete.json");

let frases = [];
try {
    const data = fs.readFileSync(frasesPath, "utf8");
    const json = JSON.parse(data);
    frases = json.frasesBurlonas || [];
} catch (e) {
    console.error("Error cargando frases:", e);
}

// --------------------------------
// COMANDO PRINCIPAL
// --------------------------------
module.exports = {
    name: "grupo-borrar",
    alias: ["borrarfake", "autodeletefake"],
    desc: "Simula borrar el grupo",

    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith("@g.us");

        if (!isGroup) {
            return sock.sendMessage(from, { text: "Este comando solo se puede usar en grupos." });
        }

        // Texto completo del mensaje sin prefix
        const full = args.join(" ").toLowerCase();

        // Palabras clave válidas
        const acciones = ["borrar", "eliminar", "autoeliminar"];

        // Detecta formatos:
        // !grupo borrar
        // !grupo eliminar
        // !grupo autoeliminar
        // !borrar grupo
        // !eliminar grupo
        // !autoeliminar grupo
        const matchNormal = acciones.includes(args[0]);
        const matchInvertido = acciones.includes(args[0]) === false && acciones.some(a => full.startsWith(a) && full.includes("grupo"));

        if (!matchNormal && !matchInvertido) {
            return sock.sendMessage(from, { text: "Ejemplo: *!grupo borrar*" });
        }

        // -------------------------
        // Secuencia falsa del proceso
        // -------------------------

        await sock.sendMessage(from, { text: "🗑️ *Iniciando eliminación del grupo…*" });
        await delay(1300);

        await sock.sendMessage(from, { text: "📦 Limpiando mensajes…" });
        await delay(1300);

        await sock.sendMessage(from, { text: "📡 Conectando con servidores de WhatsApp…" });
        await delay(1600);

        await sock.sendMessage(from, { text: "🛠️ Reescribiendo permisos administrativos…" });
        await delay(2000);

        // -------------------------
        // Mensaje final de error + frase burlona
        // -------------------------

        const frase = frases[Math.floor(Math.random() * frases.length)];

        await sock.sendMessage(from, {
            text: `❌ *Ocurrió un error.*\n${frase}`
        });

        return;
    }
};


// -------------------------
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
