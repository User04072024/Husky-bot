const path = require("path");
const fs = require("fs");
const Jimp = require("jimp");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");


// -------------------------------------------
// Módulo de Comando ASCII
// -------------------------------------------
module.exports = {
    name: "ascii",
    alias: ["asciify"],
    desc: "Convierte una imagen en arte ASCII (texto o imagen)",
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const mode = (args[0] || "").toLowerCase(); 
        
        // Configuraciones compartidas
        const FONT_PATH = Jimp.FONT_SANS_8_WHITE; 
        const ASCII_COLUMNS = 100; 

        // --- FACTORES DE ASPECTO INDEPENDIENTES ---
        const ASPECT_TEXT = 0.5; // Ideal para la mayoría de clientes de chat (texto)
        const ASPECT_IMAGE = 0.7; // Ideal para la imagen PNG (te gustó)
        // -------------------------------------------

        const hasImage = msg.message?.imageMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

        if (!hasImage) {
             return sock.sendMessage(from, {
                text:
`🔤 *Uso del comando !ascii*
Convierte una imagen a arte ASCII (basado en texto).

*ASCII (texto)* • !ascii
*ASCII (imagen)* • !ascii img`
            }, { quoted: msg });
        }
        
        // ... (Lógica para obtener imageMessage y descargar/leer imagen) ...
        let imageMessage;
        if (msg.message?.imageMessage) {
            imageMessage = msg.message.imageMessage;
        } else {
            imageMessage = msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
        }

        try {
            await sock.sendMessage(from, { text: `🎨 Procesando ASCII...` }, { quoted: msg });

            const stream = await downloadContentFromMessage(imageMessage, "image");
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            const img = await Jimp.read(buffer);

            // 1. Determinar el factor a usar
            const currentFactor = (mode === "img") ? ASPECT_IMAGE : ASPECT_TEXT;
            
            // 2. Escalar y generar el texto ASCII (Lógica integrada)
            const imageClone = img.clone();
            const aspect = imageClone.bitmap.height / imageClone.bitmap.width;
            const newH = Math.round(ASCII_COLUMNS * aspect * currentFactor); 
            
            imageClone.resize(ASCII_COLUMNS, newH);

            const asciiChars = "@%#*+=-:. ";
            let finalText = "";
            
            for (let y = 0; y < imageClone.bitmap.height; y++) {
                let line = "";
                for (let x = 0; x < imageClone.bitmap.width; x++) {
                    const { r } = Jimp.intToRGBA(imageClone.getPixelColor(x, y));
                    const char = asciiChars[Math.floor((r / 255) * (asciiChars.length - 1))];
                    line += char;
                }
                finalText += line + "\n";
            }
            
            let caption = `✨ Arte generado (Factor: ${currentFactor}).`; 
            
            // -------------------------------------------
            // SELECCIÓN DE ENTREGA
            // -------------------------------------------
            if (mode !== "img") {
                // MODO !ascii (TXT)
                const temp = path.join(__dirname, `ascii_${Date.now()}.txt`);
                fs.writeFileSync(temp, finalText);

                await sock.sendMessage(from, {
                    document: fs.readFileSync(temp),
                    fileName: "ascii.txt",
                    mimetype: "text/plain",
                    caption: caption + " (Texto)"
                }, { quoted: msg });

                fs.unlinkSync(temp);
            } else {
                // MODO !ascii img (IMAGEN PNG) - Renderizado Carácter a Carácter
                
                const font = await Jimp.loadFont(FONT_PATH);
                const lines = finalText.split('\n').filter(line => line.trim() !== '');

                if (lines.length === 0) {
                    return sock.sendMessage(from, { text: `❌ La imagen resultó en arte ASCII vacío.` }, { quoted: msg });
                }

                // Cálculo de dimensiones para simular Monospaced
                const lineHeight = Jimp.measureTextHeight(font, "@", 100); 
                const charWidth = Jimp.measureText(font, "@"); 
                
                const padding = 10;
                const imgW = (ASCII_COLUMNS * charWidth) + padding; 
                const imgH = (lines.length * lineHeight) + padding; 

                // Crear la imagen con fondo negro
                const outImg = new Jimp(imgW, imgH, 0x000000FF); 

                // Renderizado Carácter por Carácter
                lines.forEach((l, i) => {
                    for (let j = 0; j < ASCII_COLUMNS; j++) {
                        const char = l.charAt(j);
                        if (char) {
                            const x = padding / 2 + j * charWidth;
                            const y = padding / 2 + i * lineHeight;

                            outImg.print(font, x, y, char, charWidth, lineHeight);
                        }
                    }
                });
                
                // Guardar y enviar la imagen
                const tempImg = path.join(__dirname, `ascii_img_${Date.now()}.png`);
                await outImg.writeAsync(tempImg);

                await sock.sendMessage(from, {
                    image: fs.readFileSync(tempImg),
                    caption: caption + " (Imagen PNG, fondo negro)"
                }, { quoted: msg });

                fs.unlinkSync(tempImg);
            }

        } catch (err) {
            console.error(err);
            sock.sendMessage(from, { text: `❌ Error durante la ejecución del modo ASCII. Error: ${err.message}` });
        }
    }
};

