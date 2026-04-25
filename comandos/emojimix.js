// comandos/emojimix.js
const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

module.exports = {
    name: 'emojimix',
    description: 'Combina 2 emojis en un sticker (cualquier combinación)',
    async execute(sock, m, args) {
        if (!args[0])
            return sock.sendMessage(
                m.key.remoteJid,
                { text: '❌ Ingresa 2 emojis separados por +\nEj: !emojimix 👻+👀' },
                { quoted: m }
            );

        const [emoji1, emoji2] = args.join(' ').split('+');
        if (!emoji1 || !emoji2)
            return sock.sendMessage(
                m.key.remoteJid,
                { text: '❌ Formato inválido. Usa emoji1+emoji2' },
                { quoted: m }
            );

        try {
            if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');

            const inputPath = './temp/emojimix_input.png';
            const outputPath = './temp/emojimix_output.webp';

            // Convertir emojis a Unicode para la API
            const toUnicode = (emoji) =>
                Array.from(emoji)
                    .map((char) => char.codePointAt(0).toString(16))
                    .join('-');

            const e1 = toUnicode(emoji1);
            const e2 = toUnicode(emoji2);

            const url = `https://emojik.vercel.app/s/${e1}_${e2}?size=512`;

            // Descargar la imagen combinada
            const imgBuffer = await axios
                .get(url, { responseType: 'arraybuffer' })
                .then((r) => r.data);

            if (!imgBuffer || imgBuffer.length === 0)
                return sock.sendMessage(
                    m.key.remoteJid,
                    { text: '❌ Error al descargar el sticker.' },
                    { quoted: m }
                );

            fs.writeFileSync(inputPath, imgBuffer);

            // Convertir a WebP (sticker)
            const ffmpegCmd = `ffmpeg -y -i ${inputPath} -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0.0" -loop 0 ${outputPath}`;
            await execPromise(ffmpegCmd);

            // Enviar sticker
            const buffer = fs.readFileSync(outputPath);
            await sock.sendMessage(m.key.remoteJid, { sticker: buffer }, { quoted: m });

            // Limpiar archivos temporales
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);

        } catch (e) {
            console.error(e);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: `⚠️ Error: ${e.message}` },
                { quoted: m }
            );
        }
    }
};
