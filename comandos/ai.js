const axios = require("axios");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

module.exports = {
  name: "ai",
  alias: ["ia", "chatgpt"],
  desc: "Pregunta a la inteligencia artificial (soporta imágenes)",
  async execute(sock, msg, args, from) {
    let mensajeEspera;
    
    try {
      const text = args.join(" ");
      const q = msg.quoted ? msg.quoted : msg;
      
      // LOGS PARA TERMUX: Ver qué recibe el bot
      console.log("--- DEBUG AI ---");
      console.log("Tipo de mensaje (mtype):", msg.mtype);
      console.log("¿Tiene mensaje citado?:", !!msg.quoted);
      if (msg.quoted) console.log("mtype del citado:", msg.quoted.mtype);
      
      // Intentar extraer el mensaje de varias formas posibles en Baileys
      const rawMessage = msg.quoted ? msg.quoted.message : msg.message;
      const mime = (q.msg || q).mimetype || '';
      
      // Detección ultra-agresiva
      const isImage = /image/.test(mime) || 
                      !!(rawMessage?.imageMessage || 
                         rawMessage?.viewOnceMessageV2?.message?.imageMessage || 
                         rawMessage?.documentMessage?.mimetype?.includes('image'));

      console.log("Mimetype detectado:", mime);
      console.log("¿Es imagen?:", isImage);

      if (!text && !isImage) {
        return await sock.sendMessage(from, { 
            text: "❌ *No detecto ninguna imagen o texto.*\n\nResponde a una foto con el comando *!ai* o escribe una pregunta." 
        }, { quoted: msg });
      }

      // Fix Base64 para el header
      const fixAccept = Buffer.from('YXBwbGljYXRpb24vanNvbiwgdGV4dC9wbGFpbiwgKi8q', 'base64').toString('utf-8');
      const API_URL = 'https://aifreeforever.com/api/generate-ai-answer';
      const HEADERS = {
        'accept': fixAccept,
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        'origin': 'https://aifreeforever.com',
        'referer': 'https://aifreeforever.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };

      if (isImage) {
        // Mensaje de estado en WhatsApp
        mensajeEspera = await sock.sendMessage(from, { text: "🔍 *Analizando multimedia...*" }, { quoted: msg });
        
        console.log("Iniciando descarga de imagen...");
        
        const imgBuffer = await downloadMediaMessage(
            q,
            'buffer',
            {},
            { 
                logger: console,
                reuploadRequest: sock.updateMediaMessage 
            }
        ).catch(err => {
            console.error("Error dentro de downloadMediaMessage:", err);
            return null;
        });

        if (!imgBuffer) {
            if (mensajeEspera) await sock.sendMessage(from, { delete: mensajeEspera.key });
            return await sock.sendMessage(from, { text: "❌ Error al descargar la imagen de los servidores de WhatsApp." });
        }

        console.log("Descarga exitosa. Tamaño del buffer:", imgBuffer.length);
        
        // Actualizamos mensaje a "Procesando"
        await sock.sendMessage(from, { edit: mensajeEspera.key, text: "⚙️ *Procesando con IA...*" });

        const payload = {
          question: text || "¿Qué ves en esta imagen?",
          tone: "friendly",
          format: "paragraph",
          file: {
            data: imgBuffer.toString('base64'),
            type: mime || "image/png",
            name: "image.png"
          },
          conversationHistory: []
        };

        const response = await axios.post(API_URL, payload, { headers: HEADERS, timeout: 120000 });
        const result = response.data.answer || response.data;

        await sock.sendMessage(from, { text: result }, { quoted: msg });

        // Borrar el mensaje de proceso
        if (mensajeEspera) await sock.sendMessage(from, { delete: mensajeEspera.key });

      } else {
        // MODO TEXTO
        await sock.sendMessage(from, { text: "🤖 *Escribiendo...*" }, { quoted: msg });
        
        const payload = {
          question: text,
          tone: "friendly",
          format: "paragraph",
          file: null,
          conversationHistory: []
        };
        const response = await axios.post(API_URL, payload, { headers: HEADERS, timeout: 60000 });
        const result = response.data.answer || response.data;
        await sock.sendMessage(from, { text: result }, { quoted: msg });
      }

    } catch (err) {
      console.error("--- ERROR CRÍTICO AI ---");
      console.error(err);
      if (mensajeEspera) await sock.sendMessage(from, { delete: mensajeEspera.key });
      await sock.sendMessage(from, { text: `⚠️ *Error:* ${err.message}` }, { quoted: msg });
    }
  },
};

