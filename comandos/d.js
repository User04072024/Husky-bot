const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: "d",
    alias: ["ver", "desbloquear"],
    description: "Desbloquea fotos o videos de ver una vez",

    async execute(sock, msg, args) {
        try {
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg)
                return sock.sendMessage(msg.key.remoteJid, { text: "📌 Responde a un mensaje ver una vez." }, { quoted: msg });

            // 🔍 Intentar encontrar el contenido viewOnce en cualquier estructura
            let mediaMsg =
                quotedMsg.viewOnceMessageV2?.message ||
                quotedMsg.viewOnceMessage?.message ||
                quotedMsg.viewOnceMessageV2Extension?.message ||
                quotedMsg.ephemeralMessage?.message?.viewOnceMessage?.message ||
                quotedMsg.ephemeralMessage?.message?.viewOnceMessageV2?.message ||
                quotedMsg;

            let type =
                mediaMsg.imageMessage ? "image" :
                mediaMsg.videoMessage ? "video" : null;

            if (!type)
                return sock.sendMessage(msg.key.remoteJid, { text: "⚠️ No es foto/video de ver una vez" }, { quoted: msg });

            const media = mediaMsg[`${type}Message`];
            const stream = await downloadContentFromMessage(media, type);

            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            const ext = type === "image" ? "jpg" : "mp4";
            const tempFile = path.join(__dirname, `unlock_${Date.now()}.${ext}`);
            fs.writeFileSync(tempFile, buffer);

            await sock.sendMessage(msg.key.remoteJid, {
                [type]: buffer,
                caption: "🔓 Desbloqueado con éxito"
            }, { quoted: null }); // no delata al ejecutor

            fs.unlinkSync(tempFile);

        } catch (e) {
            console.log(e);
            sock.sendMessage(msg.key.remoteJid, { text: "❌ Error al procesar el mensaje ver una vez." }, { quoted: msg });
        }
    }
}
