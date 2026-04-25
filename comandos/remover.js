/**
 * 🐺 HUSKY-BOT V 1.5 - MODULO REMOVE BG (CREARTIVE API)
 * Ruta: /whatsapp-bot-new/comandos/remover.js
 */

const axios = require('axios');

module.exports = {
    name: 'remover',
    alias: ['rbg', 'quitarfondo', 'nobg'],
    category: 'herramientas',
    async execute(client, msg, args) {
        const remoteJid = msg.key.remoteJid;
        let buffer;

        // 1. Validar si es imagen o responde a una imagen
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const isImage = msg.message?.imageMessage;
        const isQuotedImage = quoted?.imageMessage;

        if (!isImage && !isQuotedImage) {
            return await client.sendMessage(remoteJid, { 
                text: "✨ *𝐇𝐔𝐒𝐊𝐘-𝐁𝐎𝐓 𝐑𝐄𝐌𝐎𝐕𝐄* ✨\n\n❌ Responde a una imagen con `!remover` para quitarle el fondo." 
            }, { quoted: msg });
        }

        try {
            await client.sendMessage(remoteJid, { text: "⏳ *Procesando...* Husky-Bot está recortando la imagen." }, { quoted: msg });

            // 2. Descargar la imagen de los servidores de WhatsApp
            const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
            const target = isImage ? msg.message.imageMessage : quoted.imageMessage;
            const stream = await downloadContentFromMessage(target, 'image');
            
            let chunks = [];
            for await (const chunk of stream) { chunks.push(chunk); }
            buffer = Buffer.concat(chunks);

            // 3. Petición al endpoint de Creartive (vía Base64)
            // Este endpoint suele devolver el buffer de la imagen directamente
            const response = await axios.post('https://api.creartive.my.id/api/tools/removebg', {
                image: `data:image/jpeg;base64,${buffer.toString('base64')}`
            }, { 
                responseType: 'arraybuffer',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // 4. Enviar el resultado al chat
            // Usamos image/png para asegurar que la transparencia se mantenga
            await client.sendMessage(remoteJid, { 
                image: Buffer.from(response.data), 
                caption: "🐺 *¡Listo!* Fondo eliminado con éxito.\n_Powered by Husky-Bot V 1.5_",
                mimetype: 'image/png'
            }, { quoted: msg });

        } catch (error) {
            console.error("❌ Error en RemoveBG:", error.message);
            
            let errorMsg = "⚠️ El servidor de recorte no respondió.";
            if (error.response?.status === 404) errorMsg = "🚫 El servicio de recorte está temporalmente fuera de línea.";
            if (error.response?.status === 413) errorMsg = "📂 La imagen es demasiado pesada para el servidor.";

            await client.sendMessage(remoteJid, { text: errorMsg }, { quoted: msg });
        }
    }
};

