/**
 * 🐺 HUSKY-BOT V 1.5 - MODULO FAKE QUOTE (ULTRA-ELEGANT)
 * Ruta: /whatsapp-bot-new/comandos/quote.js
 */

const axios = require('axios');
const fs = require('fs');

function logger(...args) {
    console.log("[QUOTE]", ...args);
}

module.exports = {
    name: 'quote',
    alias: ['q', 'frase'],
    category: 'diversion',
    async execute(client, msg, args) {
        const remoteJid = msg.key.remoteJid;

        const ctx = msg.message?.extendedTextMessage?.contextInfo ||
                    msg.message?.imageMessage?.contextInfo ||
                    msg.message?.videoMessage?.contextInfo;

        const isQuoted = !!ctx?.quotedMessage;
        const quoted = ctx?.quotedMessage;

        const quotedText = quoted?.conversation ||
                           quoted?.extendedTextMessage?.text ||
                           quoted?.imageMessage?.caption ||
                           quoted?.videoMessage?.caption;

        const text = quotedText || args.join(' ');

        if (!text) {
            return await client.sendMessage(remoteJid, {
                text: "❌ Responde a un mensaje con `!quote` o escribe un texto."
            }, { quoted: msg });
        }

        // ─────────── IDENTIFICACIÓN DE USUARIO ───────────
        let targetJid = isQuoted ? ctx.participant : (msg.key.participant || msg.key.remoteJid);
        let cleanTarget = targetJid.split("@")[0].split(":")[0];

        let name = "Soporte";

        try {
            const db = JSON.parse(fs.readFileSync("./data2.0.json", "utf-8"));

            const userLid = db.lidmap?.[cleanTarget];
            let userData = null;

            if (userLid && db.usuarios?.[userLid]) {
                userData = db.usuarios[userLid];
                logger("Usuario encontrado por LID map");
            } else if (db.usuarios?.[targetJid]) {
                userData = db.usuarios[targetJid];
                logger("Usuario encontrado por JID directo");
            } else {
                userData = Object.values(db.usuarios || {}).find(u =>
                    u.jid?.includes(cleanTarget) || (u.name && cleanTarget.length > 5 && cleanTarget.includes(u.jid?.split('@')[0]))
                );
            }

            if (userData?.name) {
                name = userData.name.replace(/\n/g, " ").trim();
            } else {
                name = (isQuoted ? ctx.pushName : msg.pushName) || "Soporte";
            }
        } catch (e) {
            logger("Error DB:", e.message);
            name = (isQuoted ? ctx.pushName : msg.pushName) || "Soporte";
        }

        // ─────────── AVATAR ───────────
        let ppUrl;
        try {
            const cleanJid = targetJid.split(":")[0];
            ppUrl = await client.profilePictureUrl(cleanJid, 'image');
        } catch {
            ppUrl = 'https://ui-avatars.com/api/?background=1c1c1c&color=ffffff&name=+';
        }

        logger("Nombre final:", name, "| Avatar:", ppUrl);

        try {
            // ─────────── COLORES Y PAYLOAD ───────────
            const nameColors = ["#00a884", "#53bdeb", "#ffd166", "#ef476f", "#06d6a0"];
            const nameColor = nameColors[Math.floor(Math.random() * nameColors.length)];

            const obj = {
                type: "quote",
                format: "png",
                backgroundColor: "#0b141a",
                width: 512,
                height: 768,
                scale: 2,
                messages: [{
                    entities: [],
                    avatar: true,
                    from: {
                        id: 1,
                        name: name,
                        photo: { url: ppUrl },
                        color: nameColor
                    },
                    text: text,
                    textColor: "#ffffff",
                    replyMessage: {}
                }]
            };

            const response = await axios.post('https://bot.lyo.su/quote/generate', obj, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.data || !response.data.ok) {
                logger("Error API Quote");
                return await client.sendMessage(remoteJid, { text: "⚠️ Error al generar la quote." }, { quoted: msg });
            }

            const buffer = Buffer.from(response.data.result.image, 'base64');

            // ─────────── ENVIAR SOLO LA IMAGEN ───────────
            await client.sendMessage(remoteJid, {
                image: buffer,
                mimetype: 'image/png'
            }, { quoted: msg });

        } catch (error) {
            logger("❌ Error en Quote:", error.message);
            await client.sendMessage(remoteJid, { text: "⚠️ El servidor de diseño está ocupado. Intenta de nuevo." }, { quoted: msg });
        }
    }
};
