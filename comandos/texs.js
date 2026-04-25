const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

module.exports = {
    name: 'texs',
    description: 'Crea un sticker de texto',
    async execute(sock, m, args) {
        const text = args.join(' ') || (m.quoted && m.quoted.text);
        if (!text) return sock.sendMessage(m.key.remoteJid, { text: '❌ Ingresa un texto para el sticker.' }, { quoted: m });

        try {
            if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');

            const inputPath = './temp/input.png';
            const outputPath = './temp/output.webp';

            // Descargar imagen de la API
            const res = await axios.get('https://skyzxu-brat.hf.space/brat', { params: { text }, responseType: 'arraybuffer' });
            fs.writeFileSync(inputPath, res.data);

            // Convertir a WebP usando ffmpeg
            const ffmpegCmd = `ffmpeg -y -i ${inputPath} -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0.0" -f webp ${outputPath}`;
            await execPromise(ffmpegCmd);

            // Leer buffer y enviar sticker
            const buffer = fs.readFileSync(outputPath);
            await sock.sendMessage(m.key.remoteJid, { sticker: buffer }, { quoted: m });

            // Limpiar archivos
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);

        } catch (e) {
            console.error(e);
            sock.sendMessage(m.key.remoteJid, { text: `⚠️ Error: ${e.message}` }, { quoted: m });
        }
    }
};
