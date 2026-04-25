const fs = require('fs');
const path = require('path');

// Ruta exacta a tu base de datos actual
const dbPath = path.join(__dirname, '../db.json');

module.exports = {
    name: "fantasmas",
    alias: ["inactivos", "ghost"],

    async execute(sock, m, args) {
        const from = m.key.remoteJid;

        if (!from.endsWith("@g.us")) {
            return sock.sendMessage(from, { text: "❌ Este comando solo funciona en grupos." }, { quoted: m });
        }

        try {
            // 1. Obtener miembros actuales del grupo (la realidad de WhatsApp)
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants;

            // 2. Leer tu base de datos db.json
            if (!fs.existsSync(dbPath)) {
                return sock.sendMessage(from, { text: "❌ No se encontró la base de datos de mensajes." }, { quoted: m });
            }

            const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
            
            // Acceder a los usuarios registrados en este grupo específico dentro de tu JSON
            const usuariosEnDb = db.grupos[from]?.usuarios || {};

            // 3. Identificar fantasmas
            // Son aquellos que no están en el JSON O tienen 0 mensajes
            const fantasmas = participants.filter(p => {
                const registro = usuariosEnDb[p.id];
                return !registro || registro.mensajes === 0;
            });

            if (fantasmas.length === 0) {
                return sock.sendMessage(from, { text: "✅ *¡Todos activos!* No hay usuarios con 0 mensajes en la base de datos." }, { quoted: m });
            }

            // 4. Limitar la lista si son demasiados (para evitar errores de envío)
            const listadoFantasmas = fantasmas.slice(0, 30); // Mostramos los primeros 30
            const mentionIds = listadoFantasmas.map(f => f.id);
            
            const listaTexto = listadoFantasmas.map((f, i) => `${i + 1}. @${f.id.split("@")[0]}`).join("\n");

            const mensaje = `👻 *DETECTOR DE FANTASMAS* 👻\n\n` +
                            `Se han encontrado *${fantasmas.length}* usuarios que no tienen mensajes registrados en este grupo.\n\n` +
                            `*Lista de inactivos:*\n${listaTexto}\n\n` +
                            `${fantasmas.length > 30 ? "_...y " + (fantasmas.length - 30) + " más._\n" : ""}` +
                            `\n⚠️ _Nota: Basado en el conteo de niveles de db.json_`;

            await sock.sendMessage(from, { 
                text: mensaje, 
                mentions: mentionIds 
            }, { quoted: m });

            console.log(`✅ Comando fantasmas: ${fantasmas.length} detectados.`);

        } catch (error) {
            console.error("Error en comando fantasmas:", error);
            await sock.sendMessage(from, { text: "❌ Error al leer la base de datos de usuarios." }, { quoted: m });
        }
    }
};

