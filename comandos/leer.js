const axios = require("axios");
const fs = require("fs");
const path = require("path");

function dividirTexto(texto, max = 180) {
    const partes = [];
    for (let i = 0; i < texto.length; i += max) {
        partes.push(texto.substring(i, i + max));
    }
    return partes;
}

module.exports = {
    name: "leer",
    alias: ["tts", "voz"],
    description: "Convierte texto a audio (TTS)",

    async execute(sock, msg, args) {
        try {
            const jid = msg.key.remoteJid;
            let texto = args.join(" ");

            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!texto) {
                if (quoted?.conversation) texto = quoted.conversation;
                if (quoted?.extendedTextMessage?.text) texto = quoted.extendedTextMessage.text;
            }

            if (!texto) {
                return sock.sendMessage(jid, {
                    text: "📌 Escribe un texto o responde a un mensaje\nEjemplo:\n!leer Hola ¿cómo estás?"
                }, { quoted: msg });
            }

            const partes = dividirTexto(texto.trim(), 180);
            const tempDir = path.join(__dirname, "temp_tts");
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

            const archivos = [];

            for (let i = 0; i < partes.length; i++) {
                const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(partes[i])}&tl=es&client=tw-ob`;
                
                const { data } = await axios.get(url, {
                    responseType: "arraybuffer",
                    headers: { "User-Agent": "Mozilla/5.0" }
                });

                const filePath = path.join(tempDir, `parte_${i}.mp3`);
                fs.writeFileSync(filePath, data);
                archivos.push(filePath);
            }

            // Si solo hay una parte, envía directamente
            if (archivos.length === 1) {
                await sock.sendMessage(jid, {
                    audio: fs.readFileSync(archivos[0]),
                    mimetype: "audio/mpeg"
                }, { quoted: msg });

                fs.unlinkSync(archivos[0]);
                return;
            }

            // Unir todos los MP3 (concatenación simple)
            const finalPath = path.join(tempDir, "tts_final.mp3");
            const writeStream = fs.createWriteStream(finalPath);

            for (const file of archivos) {
                writeStream.write(fs.readFileSync(file));
                fs.unlinkSync(file);
            }
            writeStream.end();

            await new Promise(resolve => writeStream.on("finish", resolve));

            await sock.sendMessage(jid, {
                audio: fs.readFileSync(finalPath),
                mimetype: "audio/mpeg",
                ptt: false
            }, { quoted: msg });

            fs.unlinkSync(finalPath);
            fs.rmdirSync(tempDir);

        } catch (e) {
            console.error(e);
            await sock.sendMessage(msg.key.remoteJid, {
                text: "❌ Error al generar el audio."
            });
        }
    }
};
