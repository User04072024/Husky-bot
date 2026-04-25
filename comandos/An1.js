const axios = require('axios');

// Memoria temporal para almacenar los resultados de búsqueda por chat
const an1Sessions = {};

module.exports = {
    name: 'an1',
    alias: ['mod', 'apk', 'an'],
    async execute(client, msg, args) {
        const jid = msg.key.remoteJid;
        const input = args.join(' ').trim();

        if (!input) return client.sendMessage(jid, { text: "💡 *Uso:* `!an1 [nombre]` o `!an1 [número]`" });

        // --- FUNCIÓN DE TRADUCCIÓN ---
        const traducir = async (texto) => {
            try {
                const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(texto)}`);
                return res.data[0].map(item => item[0]).join('');
            } catch {
                return texto; // Si falla, devuelve el original
            }
        };

        // --- 1. LÓGICA DE SELECCIÓN POR NÚMERO (INFO EN ESPAÑOL) ---
        if (!isNaN(input) && an1Sessions[jid]) {
            const index = parseInt(input) - 1;
            const item = an1Sessions[jid][index];

            if (!item) return client.sendMessage(jid, { text: "❌ *Número inválido.*" });

            // Traducimos nombre y descripción
            const nombreEsp = await traducir(item.name);
            const descEsp = await traducir(item.description || "Sin descripción.");

            let info = `┏━━━━━━━━━━━━━━━━━━━━┓\n`;
            info += `┃   📦  *DETALLES DEL PAQUETE* \n`;
            info += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;
            info += `📝 *Nombre:* ${nombreEsp}\n`;
            info += `📊 *Versión:* ${item.version}\n`;
            info += `⚖️ *Tamaño:* ${item.size}\n`;
            info += `⭐ *Rating:* ${item.rating}\n`;
            info += `📱 *Sistema:* ${item.system}\n\n`;
            info += `📖 *Descripción:* _${descEsp.slice(0, 600)}${descEsp.length > 600 ? '...' : ''}_\n\n`;
            info += `🚀 *ENLACE DE DESCARGA:* \n${item.download}\n\n`;
            info += `🐾 *Husky-Bot V4.0*`;

            await client.sendMessage(jid, { 
                image: { url: item.image }, 
                caption: info 
            }, { quoted: msg });

            console.log(`[LOG] Ficha enviada (Traducida): ${item.name}`);
            return;
        }

        // --- 2. LÓGICA DE BÚSQUEDA ---
        try {
            const url = `https://api.delirius.store/search/ani1?query=${encodeURIComponent(input)}`;
            const response = await axios.get(url);
            const res = response.data;

            if (!res.status || !res.data || res.data.length === 0) {
                return client.sendMessage(jid, { text: `❌ No se encontraron resultados para "${input}".` });
            }

            an1Sessions[jid] = res.data;

            let menu = `┏━━━━━━━━━━━━━━━━━━━━┓\n`;
            menu += `┃   🎮  *AN1 DOWNLOADER* \n`;
            menu += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;
            menu += `🔍 *Resultados:* "${input}"\n`;
            menu += `📌 *Escribe:* \`!an1 [número]\` \n`;
            menu += `━━━━━━━━━━━━━━━━━━━━\n\n`;

            res.data.slice(0, 20).forEach((app, i) => {
                menu += `*${i + 1}.* ${app.name}\n`;
                menu += `   └ 📦 ${app.size} • ⭐ ${app.rating}\n\n`;
            });

            menu += `━━━━━━━━━━━━━━━━━━━━\n🐾 *Husky-Bot V4.0*`;

            await client.sendMessage(jid, { text: menu }, { quoted: msg });
            console.log(`[LOG] Menú enviado: ${input}`);

        } catch (e) {
            console.error(e);
            client.sendMessage(jid, { text: "⚠️ Error de conexión con el servidor." });
        }
    }
};

