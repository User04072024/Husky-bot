const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

module.exports = {
    name: 'attp',
    alias: ['sanimado'],
    async execute(client, msg, args) {
        const jid = msg.key.remoteJid;
        const text = args.join(' ');

        if (!text) return client.sendMessage(jid, { text: '❕ Escribe el texto para el sticker.' });

        try {
            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

            const tempFile = path.join(tempDir, `attp_${Date.now()}.gif`);
            const outputFile = path.join(tempDir, `attp_${Date.now()}.webp`);

            const response = await axios.get(`https://api.delirius.store/canvas/attp?text=${encodeURIComponent(text)}`, { responseType: 'arraybuffer' });
            fs.writeFileSync(tempFile, Buffer.from(response.data));

            // COMANDO CORREGIDO: Separamos los filtros (-filter:v) de las opciones del códec (-lossless, -loop, etc.)
            const ffmpegCommand = `ffmpeg -i ${tempFile} -vcodec libwebp -filter:v "fps=fps=20,scale=512:512:flags=lanczos,pad=512:512:(512-iw)/2:(512-ih)/2:color=0x00000000" -lossless 1 -loop 0 -preset default -an ${outputFile}`;

            exec(ffmpegCommand, async (err) => {
                if (err) {
                    console.error("Error FFmpeg detallado:", err);
                    return client.sendMessage(jid, { text: '❌ Error en la conversión de video.' });
                }

                await client.sendMessage(jid, { 
                    sticker: fs.readFileSync(outputFile),
                    mimetype: 'image/webp'
                }, { quoted: msg });

                // Limpieza inmediata
                setTimeout(() => {
                    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
                }, 2000);
            });

        } catch (e) {
            console.error("Error en ATTP:", e);
        }
    }
};

