const path = require("path");
const fs = require("fs");
const Jimp = require("jimp");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

// --- Paletas y Funciones Auxiliares (omitiendo código duplicado para brevedad) ---

const emojiPalette = [
    [255, 255, 255, '⬜️'], [0, 128, 0, '🟩'], [0, 0, 0, '⬛️'], 
    [255, 0, 0, '🟥'], [128, 0, 128, '🟪'], [139, 69, 19, '🟫'], 
    [0, 0, 255, '🟦'], [255, 165, 0, '🟧'], [255, 255, 0, '🟨']
].map(([r, g, b, emoji]) => ({ r, g, b, emoji }));

const bwEmojiPalette = [
    [255, 255, 255, '⬜️'], 
    [0, 0, 0, '⬛️']       
].map(([r, g, b, emoji]) => ({ r, g, b, emoji }));

function isGrayscale(image, threshold = 25, sampleSize = 100) { 
    const width = image.bitmap.width; const height = image.bitmap.height; const totalPixels = width * height;
    if (totalPixels === 0) return true; let maxDiff = 0;
    const stepX = Math.max(1, Math.floor(width / Math.sqrt(sampleSize)));
    const stepY = Math.max(1, Math.floor(height / Math.sqrt(sampleSize)));
    for (let y = 0; y < height; y += stepY) {
        for (let x = 0; x < width; x += stepX) {
            const { r, g, b } = Jimp.intToRGBA(image.getPixelColor(x, y));
            const diffRG = Math.abs(r - g); const diffRB = Math.abs(r - b); const diffGB = Math.abs(g - b);
            maxDiff = Math.max(maxDiff, diffRG, diffRB, diffGB);
            if (maxDiff > threshold) return false;
        }
    }
    return maxDiff <= threshold;
}

function rgbToEmojiText(r, g, b, currentPalette) {
    let best = null; let bestDist = 999999;
    for (const e of currentPalette) { 
        const dist = Math.sqrt((r - e.r) ** 2 + (g - e.g) ** 2 + (b - e.b) ** 2);
        if (dist < bestDist) { bestDist = dist; best = e; }
    }
    return best.emoji; 
}

function rgbToEmojiImg(r, g, b, colorEmojiMapImg) {
    let best = null; let bestDist = 999999;
    for (const e of colorEmojiMapImg) {
        const dist = Math.sqrt((r - e.r) ** 2 + (g - e.g) ** 2 + (b - e.b) ** 2);
        if (dist < bestDist) { bestDist = dist; best = e; }
    }
    return String.fromCharCode(best.char_id); 
}

async function loadColorPalette(atlasPath, numColors, startId, gliphSize) {
    const paletteImg = await Jimp.read(atlasPath);
    const colorEmojiMap = [];
    let colorIndex = 0;
    for (let y = 0; y < paletteImg.bitmap.height; y += gliphSize) {
        for (let x = 0; x < paletteImg.bitmap.width; x += gliphSize) {
            if (colorIndex >= numColors) break;
            const centerColor = paletteImg.getPixelColor(x + gliphSize / 2, y + gliphSize / 2);
            const { r, g, b } = Jimp.intToRGBA(centerColor);
            colorEmojiMap.push({ char_id: startId + colorIndex, r: r, g: g, b: b, });
            colorIndex++;
        }
    }
    return colorEmojiMap;
}
// ----------------------------------------------------------------------------------

// -------------------------------------------
// 🎨 FUNCIONES CENTRALES
// -------------------------------------------
function toColorEmojiText(image) { 
    // --- CAMBIO CLAVE AQUÍ: Límite de 55 columnas ---
    const TEXT_MAX_WIDTH = 55; // Límite para evitar el soft-wrap en el chat.
    // --- Factor de Aspecto Ajustado para 55 columnas ---
    // Aumentamos a 1.1 para contrarrestar la compresión vertical que ocurre al usar menos columnas.
    const TEXT_ASPECT_RATIO_FACTOR = 1.1; 
    // ---------------------------------------------------------------------------
    
    const width = TEXT_MAX_WIDTH; 
    const aspect = image.bitmap.height / image.bitmap.width;
    const height = Math.round(width * aspect * TEXT_ASPECT_RATIO_FACTOR); 
    
    image.resize(width, height, Jimp.RESIZE_NEAREST_NEIGHBOR);
    const useBWEmojis = isGrayscale(image.clone()); 
    const currentPalette = useBWEmojis ? bwEmojiPalette : emojiPalette;
    
    let caption = useBWEmojis ? 
        `✨ Arte generado (B/N, ${TEXT_MAX_WIDTH} columnas).` : 
        `✨ Arte generado (Color, ${TEXT_MAX_WIDTH} columnas).`;

    let out = "";
    for (let y = 0; y < image.bitmap.height; y++) {
        let line = "";
        for (let x = 0; x < image.bitmap.width; x++) {
            const { r, g, b } = Jimp.intToRGBA(image.getPixelColor(x, y));
            line += rgbToEmojiText(r, g, b, currentPalette); 
        }
        out += line + "\n"; 
    }
    return { text: out, caption: caption };
}

function toColorEmojiImg(image, colorEmojiMapImg) { 
    // MODO IMAGEN: Mantenemos la alta resolución de 250 columnas y el factor para Jimp.
    const width = 250; 
    const IMG_ASPECT_RATIO_FACTOR = 0.8; 
    const aspect = image.bitmap.height / image.bitmap.width;
    const height = Math.round(width * aspect * IMG_ASPECT_RATIO_FACTOR); 
    
    image.resize(width, height);

    let out = "";
    for (let y = 0; y < image.bitmap.height; y++) {
        let line = "";
        for (let x = 0; x < image.bitmap.width; x++) {
            const { r, g, b } = Jimp.intToRGBA(image.getPixelColor(x, y));
            line += rgbToEmojiImg(r, g, b, colorEmojiMapImg); 
        }
        out += line + "\n";
    }
    return out;
}
// -------------------------------------------


module.exports = {
    name: "color",
    alias: ["coloremji"],
    desc: "Convierte una imagen en Emoji Color (texto o imagen)",
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const mode = (args[0] || "").toLowerCase(); 

        // 🚨 Configuración Jimp/FNT
        const atlasImagePath = path.join(__dirname, "../fonts/atlas16000_structured.png");
        const fontImagePath = path.join(__dirname, "../fonts/atlas16000_structured.fnt");
        const COLOR_COUNT = 16384; 
        const FNT_START_ID = 0;      
        const GLIPH_SIZE = 32;       
        
        const colorEmojiMapImg = await loadColorPalette(atlasImagePath, COLOR_COUNT, FNT_START_ID, GLIPH_SIZE);
        
        const hasImage = msg.message?.imageMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

        if (!hasImage) {
             return sock.sendMessage(from, {
                text:
`🎨 *Uso del comando !color*
Convierte una imagen a arte Emoji Color.

*Emoji Color (texto)* • !color
*Emoji Color (imagen)* • !color img`
            }, { quoted: msg });
        }
        
        let imageMessage;
        if (msg.message?.imageMessage) {
            imageMessage = msg.message.imageMessage;
        } else {
            imageMessage = msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
        }

        try {
            await sock.sendMessage(from, { text: `🎨 Procesando Emoji Color...` }, { quoted: msg });

            const stream = await downloadContentFromMessage(imageMessage, "image");
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            const img = await Jimp.read(buffer);

            
            let finalText;
            let caption;

            // -------------------------------------------
            // SELECCIÓN DEL MODO
            // -------------------------------------------
            if (mode === "img") {
                finalText = toColorEmojiImg(img.clone(), colorEmojiMapImg);
                caption = "🎨 Arte Color de Alta Fidelidad (16,384 colores)";
            } else {
                const result = toColorEmojiText(img.clone());
                finalText = result.text;
                caption = result.caption;
            }

            // -------------------------------------------
            // ENTREGA
            // -------------------------------------------
            if (mode !== "img") {
                // MODO TEXTO: Envío como archivo TXT
                const temp = path.join(__dirname, `color_${Date.now()}.txt`);
                fs.writeFileSync(temp, finalText);
                await sock.sendMessage(from, {
                    document: fs.readFileSync(temp),
                    fileName: "color.txt",
                    mimetype: "text/plain",
                    caption: caption 
                }, { quoted: msg });
                fs.unlinkSync(temp);
            } else { // MODO IMAGEN
                // Lógica de Renderizado Jimp (sin cambios)
                const lines = finalText.split("\n");
                const font = await Jimp.loadFont(fontImagePath); 
                const lineHeight = GLIPH_SIZE; 
                const longestLine = lines.reduce((a,b)=> a.length>b.length ? a:b, "");
                let imgW = Jimp.measureText(font, longestLine);
                imgW += GLIPH_SIZE; 
                const imgH = lines.length * lineHeight;
                const outImg = new Jimp(imgW, imgH, 0x00000000); 
                lines.forEach((l,i)=>{ outImg.print(font, 0, i * lineHeight, l); });
                const tempImg = path.join(__dirname, `color_img_${Date.now()}.png`);
                await outImg.writeAsync(tempImg);
                await sock.sendMessage(from,{
                    image: fs.readFileSync(tempImg),
                    caption: caption 
                },{ quoted: msg });
                fs.unlinkSync(tempImg);
            }

        } catch (err) {
            console.error(err);
            sock.sendMessage(from, { text: `❌ Error durante la ejecución del modo Emoji Color. Error: ${err.message}` });
        }
    }
};

