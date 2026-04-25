const fs = require('fs');
const path = require('path');

module.exports = {
    name: "rankactivos",
    alias: ["rank", "top"],
    async execute(sock, m, args) { 
        console.log("--- SE ACTIVÓ EL COMANDO RANKACTIVOS ---");
        
        const from = m.key.remoteJid;
        const dbPath = path.join(__dirname, '../db.json');
        const videoPath = path.join(__dirname, '../media/rank.mp4');

        try {
            if (!fs.existsSync(dbPath)) {
                return sock.sendMessage(from, { text: "❌ No se encontró el archivo db.json" }, { quoted: m });
            }

            const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
            const grupoData = db.grupos && db.grupos[from];
            const usuariosData = grupoData ? grupoData.usuarios : null;

            if (!usuariosData) {
                return sock.sendMessage(from, { text: "❌ No hay datos para este grupo." }, { quoted: m });
            }

            const usuariosArray = Object.keys(usuariosData)
                .filter(key => !key.endsWith('@g.us')) 
                .map(key => ({
                    id: key,
                    mensajes: usuariosData[key].mensajes || 0
                }))
                .sort((a, b) => b.mensajes - a.mensajes);

            const top10 = usuariosArray.slice(0, 10);
            const mentions = top10.map(u => u.id);

            let texto = `╔═══════════════════════╗\n`;
            texto += `║ 🌟 *TOP 10 ACTIVOS* 🌟 ║\n`;
            texto += `╠═══════════════════════╣\n`;

            top10.forEach((user, i) => {
                const medalla = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🎖️";
                texto += `${medalla} *${i + 1}.* @${user.id.split('@')[0]}\n`;
                texto += `💬 Mensajes: *${user.mensajes}*\n`;
                if (i < top10.length - 1) texto += `╠───────────────────────╣\n`;
            });
            texto += `╚═══════════════════════╝`;

            if (fs.existsSync(videoPath)) {
                await sock.sendMessage(from, { 
                    video: { url: videoPath }, 
                    caption: texto,
                    gifPlayback: true,
                    mentions: mentions,
                    // --- AGREGADO PARA EVITAR RECORTE ---
                    mimetype: 'video/mp4',
                    width: 560,
                    height: 560,
                    jpegThumbnail: fs.readFileSync(videoPath) 
                    // ------------------------------------
                }, { quoted: m });
            } else {
                console.log("⚠️ No se encontró el video en: " + videoPath);
                await sock.sendMessage(from, { text: texto, mentions: mentions }, { quoted: m });
            }

        } catch (error) {
            console.log("Error detallado:", error);
            await sock.sendMessage(from, { text: "❌ Error interno al cargar el rank." }, { quoted: m });
        }
    }
}

