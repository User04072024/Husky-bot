const axios = require('axios');

module.exports = {
    name: 'bandera',
    alias: ['flag', 'pais', 'info'],
    async execute(client, msg, args) {
        const jid = msg.key.remoteJid;
        const query = args.join(' ');

        if (!query) return client.sendMessage(jid, { text: "📍 *Uso correcto:* `!bandera colombia`" });

        try {
            const response = await axios.get(`https://api.delirius.store/tools/flaginfo?query=${encodeURIComponent(query)}`);
            const res = response.data;

            if (!res.status || !res.data) {
                return client.sendMessage(jid, { text: "❌ *Error:* No se encontró información para ese país." });
            }

            const d = res.data;

            // --- FUNCIÓN DE TRADUCCIÓN AUTOMÁTICA (Google Translate API) ---
            const traducirAIngles = async (texto) => {
                try {
                    const tRes = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(texto)}`);
                    return tRes.data[0].map(item => item[0]).join('');
                } catch {
                    return texto; // Si falla, devuelve el original
                }
            };

            // Traducimos el resumen histórico
            const resumenEspañol = await traducirAIngles(d.description);

            // Traducciones manuales de etiquetas
            const traducirManual = (t) => {
                if (!t) return "No disponible";
                return t.replace(/Republic of /g, 'República de ')
                        .replace(/South America/g, 'Sudamérica')
                        .replace(/North America/g, 'Norteamérica')
                        .replace(/Europe/g, 'Europa')
                        .replace(/Asia/g, 'Asia')
                        .replace(/Africa/g, 'África')
                        .replace(/Oceania/g, 'Oceanía')
                        .replace(/Colombian peso/g, 'Peso Colombiano')
                        .replace(/World Bank/g, 'Banco Mundial');
            };

            const puntoMasAlto = d.highestPoint ? d.highestPoint.replace(/\(|\)/g, ' - ') : "No disponible";

            // --- DISEÑO FINAL ---
            let caption = `┏━━━━━━━━━━━━━━━━━━━━┓\n`;
            caption += `┃  🗺️  *INFORMACIÓN GEOPOLÍTICA* \n`;
            caption += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;
            
            caption += `📂 *DATOS GENERALES*\n`;
            caption += `┌ 🏷️ *Nombre:* ${traducirManual(d.officialName)}\n`;
            caption += `│ 🏛️ *Capital:* ${d.capitalCity}\n`;
            caption += `│ 🌍 *Continente:* ${traducirManual(d.continent)}\n`;
            caption += `└ 🚩 *Soberano:* ${d.sovereignState === 'Yes' ? 'Sí' : 'No'}\n\n`;

            caption += `📊 *ESTADÍSTICAS*\n`;
            caption += `┌ 👥 *Población:* ${d.population}\n`;
            caption += `│ 📐 *Superficie:* ${d.area}\n`;
            caption += `│ 💰 *PIB per Cápita:* ${traducirManual(d.gdpPerCapita)}\n`;
            caption += `└ ⛰️ *Punto más alto:* ${puntoMasAlto}\n\n`;

            caption += `📞 *CONECTIVIDAD*\n`;
            caption += `┌ 🪙 *Moneda:* ${traducirManual(d.currency)}\n`;
            caption += `│ ☎️ *Prefijo:* ${d.callingCode}\n`;
            caption += `│ 🌐 *Dominio:* ${d.internetTld}\n`;
            caption += `└ 🆔 *ISO:* ${d.countryCodes}\n\n`;

            caption += `📖 *RESUMEN HISTÓRICO*\n`;
            caption += `> _${resumenEspañol}_\n\n`;
            
            caption += `🐾 *HUSKY BOT - EXPLORADOR*`;

            await client.sendMessage(jid, {
                image: { url: d.image },
                caption: caption
            }, { quoted: msg });

            // --- LIMPIEZA DE TERMUX ---
            setTimeout(() => {
                console.clear();
                process.stdout.write('\x1B[2J\x1B[0f'); // Limpieza profunda de buffer
                console.log('✅ Comando ejecutado y caché de Termux limpiado.');
            }, 2000);

        } catch (e) {
            console.error(e);
            client.sendMessage(jid, { text: "⚠️ *Error técnico:* No se pudo procesar la solicitud." });
        }
    }
};

