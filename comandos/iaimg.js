const axios = require('axios');

module.exports = {
    name: "iaimg",
    alias: ["imagen", "genimg"],
    description: "Genera una imagen con IA desde texto (Pollinations)",
    async execute(sock, m, args) {
        try {
            // prompt desde args o mensaje citado
            let prompt = args.join(" ");
            if (!prompt) {
                if (m.quoted && m.quoted.text) {
                    prompt = m.quoted.text;
                } else {
                    return await sock.sendMessage(m.key.remoteJid, { text: "✍️ *Escribe un prompt.*\nEj: `!iaimg un lobo futurista`" }, { quoted: m });
                }
            }

            await sock.sendMessage(m.key.remoteJid, { text: "🎨 Generando imagen… espera ⚡" }, { quoted: m });

            // Endpoint Pollinations (sin API key)
            const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

            // Descargar imagen como buffer
            const { data } = await axios.get(imgUrl, { responseType: "arraybuffer" });

            await sock.sendMessage(
                m.key.remoteJid,
                {
                    image: Buffer.from(data),
                    caption: `🖼️ *Imagen generada con IA*\n\n🎯 Prompt:\n_${prompt}_`
                },
                { quoted: m }
            );

        } catch (e) {
            console.log("❌ Error en IAIMG:", e);
            await sock.sendMessage(m.key.remoteJid, { text: "⚠️ Error generando imagen, intenta más tarde." }, { quoted: m });
        }
    }
};
