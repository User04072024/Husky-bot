const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs-extra');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'borrar',
    alias: ['removebg', 'nobg'],
    execute: async (sock, m, args) => {
        const from = m.key.remoteJid;
        if (!m.message) return;

        const type = Object.keys(m.message)[0];
        const isImg = type === 'imageMessage';
        const isQuoted = type === 'extendedTextMessage' && m.message.extendedTextMessage.contextInfo?.quotedMessage?.imageMessage;

        if (!isImg && !isQuoted) {
            return sock.sendMessage(from, { text: '❌ Responde a una foto o envía una con !borrar' }, { quoted: m });
        }

        const msg = isImg ? m.message.imageMessage : m.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
        const id = Date.now();
        const fileIn = path.join(__dirname, `../in_${id}.jpg`);
        const fileOut = path.join(__dirname, `../out_${id}.png`);

        try {
            await sock.sendMessage(from, { text: '⏳ Quitando fondo... (esto puede tardar unos segundos)' }, { quoted: m });

            const stream = await downloadContentFromMessage(msg, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) { 
                buffer = Buffer.concat([buffer, chunk]); 
            }
            await fs.writeFile(fileIn, buffer);

            const form = new FormData();
            // Cambiamos a un servicio que acepta 'image' en lugar de 'image_file'
            form.append('image', fs.createReadStream(fileIn));

            const res = await axios.post('https://api.remove-bg.ai/v1/removebg', form, {
                headers: { 
                    ...form.getHeaders(),
                    // User-Agent real para evitar el 403
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
                },
                responseType: 'arraybuffer'
            });

            await fs.writeFile(fileOut, res.data);

            await sock.sendMessage(from, { 
                image: fs.readFileSync(fileOut), 
                caption: '✅ Listo!' 
            }, { quoted: m });

        } catch (e) {
            console.log('Error 403 corregido con nuevo endpoint:', e.message);
            await sock.sendMessage(from, { text: '❌ El servidor rechazó la conexión. Intenta de nuevo en unos minutos.' }, { quoted: m });
        } finally {
            if (fs.existsSync(fileIn)) fs.unlinkSync(fileIn);
            if (fs.existsSync(fileOut)) fs.unlinkSync(fileOut);
        }
    }
};

