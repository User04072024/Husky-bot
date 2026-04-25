const axios = require('axios');
const cheerio = require('cheerio');
const dns = require('dns').promises;
const { URL } = require('url');

module.exports = {
    name: "curl",
    alias: ["httpget", "fetch", "inspect"],
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        let query = args.join(" ");

        if (!query) return sock.sendMessage(from, { text: '❌ Indica una URL.' });
        
        // Evitamos las barras juntas para el resaltado de Nano
        const protocoloBase = 'https:' + '/' + '/'; 
        if (!query.startsWith('http')) query = protocoloBase + query;

        try {
            const urlObj = new URL(query);
            console.log(`\x1b[36m[CURL-LOG]\x1b[0m Analizando: ${query}`);

            const startPing = Date.now();
            
            // --- SOLUCIÓN PARA NANO ---
            // Separamos el '/' del '*' para que Nano no crea que inicia un comentario
            const parte1 = 'text/html,application/xhtml+xml,application/xml;q=0.9,';
            const parte2 = '/' + '*'; 
            const parte3 = ';' + 'q=0.8';
            const acceptHeader = parte1 + parte2 + parte2 + parte3;

            const response = await axios.get(query, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Termux)',
                    'Accept': acceptHeader
                },
                timeout: 12000,
                validateStatus: false 
            });

            const latency = Date.now() - startPing;
            const ip = await dns.lookup(urlObj.hostname).then(res => res.address).catch(() => 'No detectada');
            const $ = cheerio.load(response.data);

            console.log(`\x1b[32m[SUCCESS]\x1b[0m ${urlObj.hostname} | Ping: ${latency}ms`);

            // Icono según el estado HTTP
            const statusEmoji = response.status >= 200 && response.status < 300 ? '✅' : '⚠️';

            const infoTxt = `
┏━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🌐 *CURL INSPECTOR*
┃━━━━━━━━━━━━━━━━━━━━━━━━
┃ 📍 *Host:* ${urlObj.hostname}
┃ 🖥️ *IP:* ${ip}
┃ ${statusEmoji} *Status:* ${response.status} (${response.statusText})
┃ ⚡ *Ping:* ${latency}ms
┃ 🛠️ *Tipo:* ${response.headers['content-type'] || 'N/A'}
┃ 🛰️ *Server:* ${response.headers['server'] || 'Oculto'}
┣━━━━━━━━━━━━━━━━━━━━━━━━
┃ 📄 *TÍTULO:* ${$('title').text().trim() || 'Sin título'}
┣━━━━━━━━━━━━━━━━━━━━━━━━
┃ 📂 *HEADERS:*
┃ \`\`\`json
┃ ${JSON.stringify(response.headers, null, 2).substring(0, 600)}
┃ \`\`\`
┣━━━━━━━━━━━━━━━━━━━━━━━━
┃ 📝 *RAW DATA (Extracto):*
┃ \`\`\`html
┃ ${response.data.toString().substring(0, 800).replace(/`/g, "'")}
┃ \`\`\`
┗━━━━━━━━━━━━━━━━━━━━━━━━`.trim();

            await sock.sendMessage(from, { text: infoTxt }, { quoted: msg });

        } catch (err) {
            console.error(`\x1b[31m[CURL-ERROR]\x1b[0m`, err.message);
            await sock.sendMessage(from, { text: `❌ *Error:* ${err.message}` });
        }
    }
};

