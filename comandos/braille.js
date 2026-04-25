const path = require("path");
const fs = require("fs");
const Jimp = require("jimp");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");


// -------------------------------------------
// ⠿ FUNCIÓN CENTRAL: CONVERSIÓN A BRAILLE
// -------------------------------------------
function toBraille(image, aspectFactor) {
    // 💥 Configuración específica para Braille
    const maxWidth = 80;
    const aspect = image.bitmap.height / image.bitmap.width;

    // Aplicamos el factor de aspecto
    const height = Math.round(maxWidth * aspect * aspectFactor);

    // Braille requiere resolución 2x4 para mapear los 8 puntos
    image.resize(maxWidth * 2, height * 4);

    const brailleBase = 0x2800;
    let result = "";
    // Puntos de Braille (columna, fila)
    const dots = [
        [0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3]
    ];

    for (let y = 0; y < image.bitmap.height; y += 4) {
        let line = "";
        for (let x = 0; x < image.bitmap.width; x += 2) {
            let char = 0;
            dots.forEach((d, i) => {
                const px = image.getPixelColor(x + d[0], y + d[1]);
                const { r } = Jimp.intToRGBA(px);
                if (r < 128) char |= (1 << i);
            });
            line += String.fromCharCode(brailleBase + char);
        }
        result += line + "\n";
    }
    return result;
}
// -------------------------------------------


module.exports = {
    name: "braille",
    alias: ["braillefy"],
    desc: "Convierte una imagen en arte Braille (texto o imagen)",
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const mode = (args[0] || "").toLowerCase();

        // --- FACTORES DE ASPECTO INDEPENDIENTES ---
        const ASPECT_TEXT = 0.55;
        const ASPECT_IMAGE = 0.65;
        // -------------------------------------------

        // --- CAMBIO CLAVE: Cargar la fuente Braille personalizada ---
        const FONT_PATH = path.join(__dirname, "../fonts/dejavufont.fnt");
        // -------------------------------------------------------------

        const BRAILLE_COLUMNS = 80;

        const hasImage = msg.message?.imageMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

        if (!hasImage) {
             return sock.sendMessage(from, {
                text:
`⠿ *Uso del comando !braille*
Convierte una imagen a arte Braille (basado en texto).

*Braille (texto)* • !braille
*Braille (imagen)* • !braille img`
            }, { quoted: msg });
        }

        let imageMessage;
        if (msg.message?.imageMessage) {
            imageMessage = msg.message.imageMessage;
        } else {
            imageMessage = msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
        }

        try {
            await sock.sendMessage(from, { text: `🎨 Procesando Braille...` }, { quoted: msg });

            const stream = await downloadContentFromMessage(imageMessage, "image");
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            const img = await Jimp.read(buffer);

            const currentFactor = (mode === "img") ? ASPECT_IMAGE : ASPECT_TEXT;

            // Usamos el factor de aspecto adecuado
            let finalText = toBraille(img.clone(), currentFactor);
            let caption = `✨ Arte Braille generado (Factor: ${currentFactor}).`;

            // -------------------------------------------
            // ENTREGA
            // -------------------------------------------
            if (mode !== "img") {
                // MODO !braille (TXT)
                const temp = path.join(__dirname, `braille_${Date.now()}.txt`);
                fs.writeFileSync(temp, finalText);

                await sock.sendMessage(from, {
                    document: fs.readFileSync(temp),
                    fileName: "braille.txt",
                    mimetype: "text/plain",
                    caption: caption + " (Texto)"
                }, { quoted: msg });

                fs.unlinkSync(temp);
            } else {
                // MODO !braille img (IMAGEN PNG) - Renderizado Carácter a Carácter

                const font = await Jimp.loadFont(FONT_PATH); // ¡Carga la fuente Dejavu!
                const lines = finalText.split('\n').filter(line => line.trim() !== '');

                if (lines.length === 0) {
                    return sock.sendMessage(from, { text: `❌ La imagen resultó en arte Braille vacío.` }, { quoted: msg });
                }

                // Cálculo de dimensiones para simular Monospaced
                // Usamos el Braille Base (puntos vacíos) para medir el tamaño.
                const brailleChar = String.fromCharCode(0x2800);
                const lineHeight = Jimp.measureTextHeight(font, brailleChar, 100);
                const charWidth = Jimp.measureText(font, brailleChar);

                const padding = 10;
                const imgW = (BRAILLE_COLUMNS * charWidth) + padding;
                const imgH = (lines.length * lineHeight) + padding;

                // Crear la imagen con fondo negro (0x000000FF)
                const outImg = new Jimp(imgW, imgH, 0x000000FF);

                // Renderizado Carácter por Carácter
                lines.forEach((l, i) => {
                    for (let j = 0; j < BRAILLE_COLUMNS; j++) {
                        const char = l.charAt(j);
                        if (char) {
                            const x = padding / 2 + j * charWidth;
                            const y = padding / 2 + i * lineHeight;

                            outImg.print(font, x, y, char, charWidth, lineHeight);
                        }
                    }
                });

                // Guardar y enviar la imagen
                const tempImg = path.join(__dirname, `braille_img_${Date.now()}.png`);
                await outImg.writeAsync(tempImg);

                await sock.sendMessage(from, {
                    image: fs.readFileSync(tempImg),
                    caption: caption + " (Imagen PNG, fondo negro)"
                }, { quoted: msg });

                fs.unlinkSync(tempImg);
            }

        } catch (err) {
            console.error(err);
            sock.sendMessage(from, { text: `❌ Error inesperado durante la ejecución: ${err.message}.`}, { quoted: msg });
        }
    }
};

