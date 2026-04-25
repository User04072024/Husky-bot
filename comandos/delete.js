// comandos/delete.js
module.exports = {
    name: "delete",
    alias: ["d"],
    description: "Borra un mensaje respondiendo a él y elimina el comando",
    async execute(sock, m) {
        try {
            // 1. Detectamos el mensaje citado (al que respondes)
            const quoted = m.message?.extendedTextMessage?.contextInfo?.stanzaId
                ? {
                    id: m.message.extendedTextMessage.contextInfo.stanzaId,
                    participant: m.message.extendedTextMessage.contextInfo.participant || m.key.remoteJid,
                    remoteJid: m.key.remoteJid
                }
                : null;

            if (!quoted) {
                return sock.sendMessage(m.key.remoteJid, { text: "⚠️ Responde al mensaje que quieras borrar con !delete" }, { quoted: m });
            }

            // 2. Borrar el mensaje citado (el objetivo)
            await sock.sendMessage(quoted.remoteJid, {
                delete: {
                    remoteJid: quoted.remoteJid,
                    fromMe: false, // Cambiar a true si el mensaje es del bot
                    id: quoted.id,
                    participant: quoted.participant
                }
            });

            // 3. Borrar el propio comando (!delete)
            await sock.sendMessage(m.key.remoteJid, {
                delete: m.key
            });

        } catch (e) {
            console.error("❌ Error al borrar mensaje:", e);
            // No enviamos mensaje de error aquí para evitar dejar "basura" en el chat si falla el borrado
        }
    }
};

