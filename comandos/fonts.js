const fs = require('fs');
const path = require('path');

// Intentamos detectar la ruta raíz del proyecto para mayor precisión
const fontsPath = path.join(process.cwd(), 'lib/fonts.json');

const getFonts = () => {
    try {
        console.log(`\n[DEBUG] Intentando leer: ${fontsPath}`);
        
        if (!fs.existsSync(fontsPath)) {
            console.error(`[ERROR] El archivo no existe en: ${fontsPath}`);
            return {};
        }

        const rawData = fs.readFileSync(fontsPath, 'utf-8');
        const data = JSON.parse(rawData);
        
        console.log(`[SUCCESS] fonts.json cargado. Estilos encontrados: ${Object.keys(data).length}`);
        return data;
    } catch (e) {
        console.error(`[FATAL] Error leyendo fonts.json: ${e.message}`);
        return {};
    }
};

const saveFonts = (data) => {
    try {
        fs.writeFileSync(fontsPath, JSON.stringify(data, null, 2));
        console.log(`[SUCCESS] fonts.json actualizado correctamente.`);
    } catch (e) {
        console.error(`[ERROR] No se pudo guardar fonts.json: ${e.message}`);
    }
};

/**
 * Aplica el estilo al texto
 */
const applyStyle = (text, key, data, intensity = 1, dirs = []) => {
    const font = data[key];
    if (!font) {
        console.warn(`[WARN] ID de fuente "${key}" no encontrado en el JSON.`);
        return text;
    }

    // Si es una decoración que apunta a otra fuente (propiedad "f")
    const target = font.f ? data[font.f] : font;
    if (!target) {
        console.warn(`[WARN] La fuente de referencia "${font.f}" no existe.`);
        return text;
    }

    const getPart = (part) => Array.isArray(part) ? part.join('') : (part || '');

    // --- LÓGICA DE GLITCH ---
    if (target.type === "glitch_master") {
        let pool = "";
        if (dirs.length === 0) {
            pool = getPart(target.up) + getPart(target.down) + getPart(target.mid);
        } else {
            if (dirs.includes('n')) pool += getPart(target.up);
            if (dirs.includes('s')) pool += getPart(target.down);
            if (dirs.includes('i') || dirs.includes('d')) pool += getPart(target.mid);
        }

        if (!pool) return text;
        const poolArray = Array.from(pool);

        return Array.from(text).map(char => {
            let glitch = "";
            for (let i = 0; i < intensity; i++) {
                glitch += poolArray[Math.floor(Math.random() * poolArray.length)];
                if (i % 5 === 0) glitch += "\u034f";
            }
            return char + glitch;
        }).join('');
    }

    // --- LÓGICA DE MAPEO ESTÁNDAR ---
    if (target.m && target.c) {
        const charBase = Array.from(target.c);
        const mappedFull = Array.from(target.m);

        // Calculamos cuántos caracteres Unicode componen un solo bloque visual
        const blockSize = Math.floor(mappedFull.length / charBase.length);
        const mapArr = [];

        for (let i = 0; i < charBase.length; i++) {
            mapArr.push(mappedFull.slice(i * blockSize, (i * blockSize) + blockSize).join(''));
        }

        let result = Array.from(text).map(char => {
            const i = charBase.indexOf(char);
            return i !== -1 ? mapArr[i] : char;
        }).join('');

        // Aplicar decoraciones si existen (IDs 41+)
        if (font.deco) {
            result = `${font.deco[0]}${result}${font.deco[1]}`;
        }
        return result;
    }

    // --- LÓGICA DE COMBINACIÓN SIMPLE ---
    if (target.type === "combine") {
        const zone = getPart(target.char).repeat(intensity);
        let result = Array.from(text).map(char => char + zone).join('');
        if (font.deco) result = `${font.deco[0]}${result}${font.deco[1]}`;
        return result;
    }

    return text;
};

module.exports = {
    name: 'font',
    alias: ['fuente', 'estilo'],
    async execute(client, msg, args) {
        const jid = msg.key.remoteJid;
        console.log(`\n[EJECUCIÓN] Comando font invocado por: ${jid}`);
        
        let fontData = getFonts();

        // Subcomando: add
        if (args[0] === 'add') {
            const targetId = args[1];
            const name = args[2];
            const abc = args[3];
            const mapped = args[4];

            if (!targetId || !name || !abc || !mapped) {
                return client.sendMessage(jid, { text: "✕ *Uso:* `!font add [ID] [Nombre] [abc] [mapped]`" });
            }

            fontData[targetId] = { n: name, c: abc, m: mapped };
            saveFonts(fontData);
            return client.sendMessage(jid, { text: `✔ Estilo *${name}* guardado en ID ${targetId}.` });
        }

        const index = args[0];

        // Mostrar Menú si no hay ID o el ID no existe
        if (!index || !fontData[index]) {
            console.log(`[INFO] Generando menú de fuentes...`);
            const allIds = Object.keys(fontData).sort((a, b) => parseInt(a) - parseInt(b));

            let help = "┏━━━〔 🎭 *HUSKY FONTS PRO* 〕━━━┓\n┃\n";
            help += "┃ 📝 *Uso:* `!font [id] [texto]`\n";
            help += "┃ ⚙️ *Avanzado:* `[nivel] [dir]`\n";
            help += "┃\n";
            help += "┣━━〔 *LISTA DE ESTILOS* 〕━━\n";

            allIds.forEach(id => {
                const preview = applyStyle("Husky", id, fontData, 1).slice(0, 30);
                help += `┃ 🆔 *${id.toString().padEnd(3)}* ⮕ ${preview}\n`;
            });

            help += "┃\n";
            help += "┗━━━━━━━━━━━━━━━━━━━━━━━┛\n";
            help += "🐾 *Husky-Bot Neon Update*";

            return client.sendMessage(jid, { text: help }, { quoted: msg });
        }

        // Procesar Texto
        const argsRaw = args.slice(1);
        const validDirs = ['n', 's', 'i', 'd'];
        const directions = argsRaw.filter(a => validDirs.includes(a.toLowerCase()));

        let intensity = 1;
        const intensityIndex = argsRaw.findIndex(a => !isNaN(a) && (a.length <= 2));
        if (intensityIndex !== -1) {
            intensity = Math.max(1, Math.min(parseInt(argsRaw[intensityIndex]), 50));
        }

        const textToChange = argsRaw.filter((arg, idx) => {
            return !validDirs.includes(arg.toLowerCase()) && idx !== intensityIndex;
        }).join(' ');

        if (!textToChange) {
            return client.sendMessage(jid, { text: "❕ Escribe el texto que quieres transformar después del ID." });
        }

        try {
            console.log(`[TRANSFORM] ID: ${index} | Texto: "${textToChange}" | Intensidad: ${intensity}`);
            const formatted = applyStyle(textToChange, index, fontData, intensity, directions);
            await client.sendMessage(jid, { text: formatted }, { quoted: msg });
        } catch (e) {
            console.error(`[ERROR EXEC] ${e.message}`);
            client.sendMessage(jid, { text: "❌ Error al procesar la fuente." });
        }
    }
};

