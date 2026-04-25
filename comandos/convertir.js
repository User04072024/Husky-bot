const fs = require("fs");
const path = require("path");
const Jimp = require("jimp");
const axios = require("axios");
const { exec } = require("child_process");
const { promisify } = require("util");
const execPromise = promisify(exec);
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

// Función de utilidad para limpiar archivos
const cleanupFiles = (files) => {
    if (Array.isArray(files)) {
        files.forEach(file => { if (fs.existsSync(file)) fs.unlinkSync(file); });
    }
};

// Mime types
const getMimeType = (type, ext) => {
    const map = {
        'img': { 'jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png','bmp':'image/bmp','gif':'image/gif','webp':'image/webp','ico':'image/x-icon' },
        'audio': { 'mp3':'audio/mpeg','wav':'audio/wav','flac':'audio/flac','ogg':'audio/ogg','aac':'audio/aac' },
        'video': { 'mp4':'video/mp4','mkv':'video/x-matroska','avi':'video/avi','mov':'video/quicktime' },
        'doc': { 'pdf':'application/pdf','docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','doc':'application/msword' }
    };
    return map[type]?.[ext] || (type !== 'doc' ? `${type}/${ext}` : `application/${ext}`);
};

// Descargar media
async function downloadMedia(msgMedia) {
    let mime = msgMedia.mimetype || '';
    let type = mime.startsWith('image') ? 'image' :
               mime.startsWith('video') ? 'video' :
               mime.startsWith('audio') ? 'audio' :
               'document';
    const stream = await downloadContentFromMessage(msgMedia, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

module.exports = {
    name: "convertir",
    alias: ["convert"],
    desc: "Convierte archivos: img, audio, video y doc",
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;

        // --- Mensaje de ayuda ---
        if (args.length !== 4 || args[2].toLowerCase() !== 'a') {
            await sock.sendMessage(from, { text: 
`🔄 *Uso de !convertir*

Convierte archivos entre distintos formatos.  

🖼 *Imagen (img)*:
  Formatos: jpg, jpeg, png, bmp, gif, webp, ico
  Ejemplo: !convertir img jpeg a png

📄 *Documento (doc)*:
  Formatos: doc, docx → pdf
  Ejemplo: !convertir doc docx a pdf

🎵 *Audio (audio)*:
  Formatos: mp3, wav, flac, ogg, aac
  Ejemplo: !convertir audio mp3 a wav

🎬 *Video (video)*:
  Formatos: mp4, mkv, avi, mov
  Ejemplo: !convertir video mkv a mp4

📌 Sintaxis:
!convertir <tipo> <formato_actual> a <formato_deseado>

⚠️ Primero envía el comando, luego envía el archivo.`}, { quoted: msg });
            return;
        }

        const tipo = args[0].toLowerCase();
        const actual = args[1].toLowerCase();
        const destino = args[3].toLowerCase();

        if (!['img','audio','video','doc'].includes(tipo)) {
            await sock.sendMessage(from, { text: "⚠️ Tipo no soportado. Usa: img, audio, video, doc" });
            return;
        }

        await sock.sendMessage(from, { text: `📤 Envía ahora tu archivo tipo *${tipo}* en formato *${actual}* para convertir a *${destino}*` }, { quoted: msg });

        // --- Listener temporal ---
        let timeoutId;
        const timeout = 60000; 
        let filesToCleanup = [];

        const removeListener = () => {
            sock.ev.off("messages.upsert", listener);
            if(timeoutId) clearTimeout(timeoutId);
        };

        timeoutId = setTimeout(async () => {
            removeListener();
            await sock.sendMessage(from, { text: "⏰ Tiempo agotado. No se recibió archivo." });
        }, timeout);

        const listener = async (m) => {
            const userMsg = m.messages[0];
            if (!userMsg.message || userMsg.key.remoteJid !== from) return;

            // Solo archivos válidos
            const mediaObj = userMsg.message.imageMessage || userMsg.message.documentMessage || userMsg.message.audioMessage || userMsg.message.videoMessage;
            if (!mediaObj) return;

            removeListener();
            try {
                await sock.sendMessage(from, { text: `⬇️ Descargando archivo...` });
                const buffer = await downloadMedia(mediaObj);
                if(!buffer || buffer.length===0) throw new Error("Archivo vacío o descarga fallida.");
                
                let outputName, finalBuffer, mimeType;
                filesToCleanup = [];

                if(tipo==='img'){
                    const image = await Jimp.read(buffer);
                    outputName = `converted_${Date.now()}.${destino}`;
                    await image.writeAsync(outputName);
                    finalBuffer = fs.readFileSync(outputName);
                    mimeType = getMimeType('img', destino);
                    filesToCleanup.push(outputName);
                }
                else if(tipo==='doc'){
                    // SOLO doc/docx → pdf usando FreeConvert API
                    if(!['doc','docx'].includes(actual) || destino!=='pdf'){
                        await sock.sendMessage(from,{text:"⚠️ Solo se puede convertir doc/docx → pdf con esta función."});
                        return;
                    }

                    outputName = `converted_${Date.now()}.pdf`;
                    const formData = new FormData();
                    formData.append("file", buffer, { filename:`file.${actual}` });

                    // Cambia {access-token} por tu token real
                    const res = await axios.post("https://api.freeconvert.com/v1/convert", formData, {
                        headers: { 
                            ...formData.getHeaders(),
                            "Authorization":"Bearer {access-token}"
                        },
                        responseType:"arraybuffer"
                    });

                    finalBuffer = Buffer.from(res.data);
                    mimeType = getMimeType('doc','pdf');
                }
                else if(tipo==='audio' || tipo==='video'){
                    const inputFile = `input_${Date.now()}.${actual}`;
                    outputName = `converted_${Date.now()}.${destino}`;
                    fs.writeFileSync(inputFile, buffer);
                    filesToCleanup.push(inputFile, outputName);

                    await execPromise(`ffmpeg -i ${inputFile} ${outputName}`);
                    finalBuffer = fs.readFileSync(outputName);
                    mimeType = getMimeType(tipo,destino);
                }

                if(finalBuffer){
                    await sock.sendMessage(from, {
                        document: finalBuffer,
                        mimetype: mimeType,
                        fileName: outputName
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text:"⚠️ No se pudo generar archivo convertido." });
                }

            } catch(err){
                console.error("❌ Error en conversión:", err);
                await sock.sendMessage(from, { text:`⚠️ Error al procesar archivo: ${err.message}` });
            } finally {
                cleanupFiles(filesToCleanup);
            }
        };

        sock.ev.on("messages.upsert", listener);
    }
};
