const axios = require('axios');

module.exports = {
    name: "acortalink",
    alias: ["shortlink", "link"],
    desc: "Acorta enlaces para compartir fácilmente",
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;

        if (!args[0]) {
            return sock.sendMessage(from, {
                text: `⚠️ *Uso:* !acortalink <enlace>\nEj: !acortalink https://youtube.com/...`
            }, { quoted: msg });
        }

        const originalLink = args[0];

        // Validar URL mínima
        if (!/^https?:\/\//i.test(originalLink)) {
            return sock.sendMessage(from, {
                text: "⚠️ Ese no parece un enlace válido.\nDebe incluir http:// o https://"
            }, { quoted: msg });
        }

        await sock.sendMessage(from, { text: "⏳ Acortando enlace..." }, { quoted: msg });

        // Función para probar acortadores
        const acortadores = [
            (url) => axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`),
            (url) => axios.get(`https://v.gd/create.php?format=simple&url=${encodeURIComponent(url)}`),
            (url) => axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`)
        ];

        let shortLink = null;

        for (const acortar of acortadores) {
            try {
                const response = await acortar(originalLink);
                if (response.data && !response.data.includes("tinyurl.com/")) {
                    shortLink = response.data;
                    break;
                }
            } catch (error) {
                continue; // intenta con el siguiente
            }
        }

        if (!shortLink) {
            return sock.sendMessage(from, {
                text: "❌ No se pudo acortar el enlace. Intenta con otro."
            }, { quoted: msg });
        }

        const texto = `🌐 *Enlace Acortado*

🔗 *Original:*
${originalLink}

✂️ *Acortado:*
${shortLink}

👍 Copia y comparte tu enlace sin problemas.`;

        await sock.sendMessage(from, { text: texto }, { quoted: msg });
    }
};
