// comandos/texsv.js
const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

module.exports = {
    name: 'texsv',
    description: 'Crea un sticker animado de texto',
    async execute(sock, m, args) {
        const text = args.join(' ') || (m.quoted && m.quoted.text);
        if (!text)
            return sock.sendMessage(m.key.remoteJid, { text: '❌ Ingresa un texto para el sticker animado.' }, { quoted: m });

        try {
            if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');
            const inputPath = './temp/input_anim.mp4';
            const outputPath = './temp/output_anim.webp';

            // Descargar animación desde la API
            const res = await axios.get('https://skyzxu-brat.hf.space/brat-animated', {
                params: { text },
                responseType: 'arraybuffer'
            });
            fs.writeFileSync(inputPath, res.data);

            // Convertir a sticker animado WebP
            const ffmpegCmd = `ffmpeg -y -i ${inputPath} -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0.0" -loop 0 ${outputPath}`;
            await execPromise(ffmpegCmd);

            // Enviar sticker
            const buffer = fs.readFileSync(outputPath);
            await sock.sendMessage(m.key.remoteJid, { sticker: buffer }, { quoted: m });

            // Limpiar archivos
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);

        } catch (e) {
            console.error(e);
            await sock.sendMessage(m.key.remoteJid, { text: `⚠️ Error: ${e.message}` }, { quoted: m });
        }
    }
};
