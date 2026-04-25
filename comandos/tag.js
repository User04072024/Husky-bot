module.exports = {
    name: "tag",
    alias: ["todos", "mention"],

    async execute(sock, message, args) {
        try {
            const chatId = message.key.remoteJid;

            // Verificar si es grupo
            if (!chatId || !chatId.endsWith("@g.us")) {
                return await sock.sendMessage(chatId, { text: "❌ Este comando solo funciona en grupos." });
            }

            // Obtener metadata
            const metadata = await sock.groupMetadata(chatId);

            // --- NORMALIZAR JIDs ---
            const mentionsAll = metadata.participants
                .map(p => p.id)
                .filter(id => typeof id === "string")
                .map(id => id.split(":")[0] + "@s.whatsapp.net");
            // -----------------------

            // Obtener texto del usuario
            let texto = null;

            // 1. Si el usuario escribió texto
            if (args.length > 0) {
                texto = args.join(" ");
            }

            // 2. Si respondió un mensaje
            if (!texto && message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quoted = message.message.extendedTextMessage.contextInfo.quotedMessage;

                texto =
                    quoted.conversation ||
                    quoted.extendedTextMessage?.text ||
                    quoted.imageMessage?.caption ||
                    quoted.videoMessage?.caption ||
                    null;
            }

            if (!texto) {
                return await sock.sendMessage(chatId, {
                    text: "⚠️ Escribe un mensaje o responde a uno para usar *!tag*."
                });
            }

            // Enviar mensaje con menciones ocultas
            await sock.sendMessage(
                chatId,
                {
                    text: texto,
                    mentions: mentionsAll // ← FUNCIONA SIN CRASHEAR
                }
            );

        } catch (err) {
            console.error("Error en !tag:", err);
            await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Error ejecutando el comando. Revisa consola."
            });
        }
    }
};
