const fs = require("fs");
const axios = require("axios");
const { exec } = require("child_process");
const FormData = require("form-data");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

/* 🔹 LOG SEGURO */
function logger(...args) {
    console.log("[QC]", ...args);
}

async function getAvatar(sock, jid) {
    try {
        // Para LIDs y JIDs, Baileys suele resolver mejor el profilePictureUrl si el JID está limpio
        const cleanJid = jid.split(":")[0];
        return await sock.profilePictureUrl(cleanJid, "image");
    } catch {
        return "https://ui-avatars.com/api/?background=1c1c1c&color=ffffff&name=+";
    }
}

module.exports = {
    name: "qc",
    alias: ["q", "quote"],

    async execute(sock, m, args) {
        try {
            logger("Comando ejecutado");

            const ctx = m.message?.extendedTextMessage?.contextInfo ||
                        m.message?.imageMessage?.contextInfo ||
                        m.message?.videoMessage?.contextInfo ||
                        m.message?.stickerMessage?.contextInfo;

            const isQuoted = !!ctx?.quotedMessage;
            const quoted = ctx?.quotedMessage;

            if (!args.length && !isQuoted) {
                return sock.sendMessage(m.key.remoteJid, {
                    text: "*〔 QUOTE CREATOR 〕*\n\n> Uso: !qc [texto]\n> Responder: !qc"
                }, { quoted: m });
            }

            let text = "";
            let customName = null;

            if (isQuoted) {
                text = quoted.conversation ||
                       quoted.extendedTextMessage?.text ||
                       quoted.imageMessage?.caption ||
                       quoted.videoMessage?.caption || "";
            } else {
                if (args.length > 1) customName = args.shift();
                text = args.join(" ");
            }

            if (!text && !quoted?.stickerMessage) return;

            /* ─────────── IDENTIFICACIÓN DE USUARIO ─────────── */
            // Obtenemos el JID real de quien envió el mensaje (o del citado)
            let targetJid = isQuoted ? ctx.participant : (m.key.participant || m.key.remoteJid);
            let cleanTarget = targetJid.split("@")[0].split(":")[0]; // Solo los números
            
            let name = "Soporte"; // Default

            if (customName) {
                name = customName;
            } else {
                try {
                    const db = JSON.parse(fs.readFileSync("./data2.0.json", "utf-8"));
                    
                    // 1. Intentar obtener el LID desde el lidmap usando el número
                    const userLid = db.lidmap?.[cleanTarget];
                    let userData = null;

                    if (userLid && db.usuarios?.[userLid]) {
                        // Buscamos directamente por LID (más rápido y preciso)
                        userData = db.usuarios[userLid];
                        logger("Usuario encontrado por LID map");
                    } else if (db.usuarios?.[targetJid]) {
                        // Buscamos por JID completo (por si acaso)
                        userData = db.usuarios[targetJid];
                        logger("Usuario encontrado por JID directo");
                    } else {
                        // 2. Búsqueda exhaustiva por número en el objeto usuarios
                        userData = Object.values(db.usuarios || {}).find(u => 
                            u.jid?.includes(cleanTarget) || (u.name && cleanTarget.length > 5 && cleanTarget.includes(u.jid?.split('@')[0]))
                        );
                    }

                    if (userData?.name) {
                        name = userData.name.replace(/\n/g, " ").trim();
                    } else {
                        name = (isQuoted ? ctx.pushName : m.pushName) || "Soporte";
                    }
                } catch (e) {
                    logger("Error DB:", e.message);
                    name = (isQuoted ? ctx.pushName : m.pushName) || "Soporte";
                }
            }

            const avatar = await getAvatar(sock, targetJid);
            logger("Nombre final:", name, "| Avatar:", avatar);

            /* ─────────── MEDIA ─────────── */
            let mediaUrl = null;
            if (isQuoted && (quoted.imageMessage || quoted.stickerMessage)) {
                try {
                    const buffer = await downloadMediaMessage(
                        { message: quoted },
                        "buffer",
                        {},
                        { logger }
                    );

                    const form = new FormData();
                    form.append("file", buffer, { filename: "file.png", contentType: "image/png" });

                    const up = await axios.post("https://telegra.ph/upload", form, {
                        headers: form.getHeaders()
                    });
                    mediaUrl = "https://telegra.ph" + up.data[0].src;
                } catch (e) {
                    logger("Error media:", e.message);
                }
            }

            /* 🎨 COLORES Y PAYLOAD */
            const nameColors = ["#00a884", "#53bdeb", "#ffd166", "#ef476f", "#06d6a0"];
            const nameColor = nameColors[Math.floor(Math.random() * nameColors.length)];

            const payload = {
                type: "quote",
                format: "png",
                backgroundColor: "#0b141a",
                width: 512,
                height: 768,
                scale: 2,
                messages: [{
                    avatar: true,
                    from: {
                        id: 1,
                        name: name,
                        photo: { url: avatar },
                        color: nameColor
                    },
                    text,
                    textColor: "#ffffff",
                    media: mediaUrl ? { url: mediaUrl } : undefined,
                    replyMessage: {}
                }]
            };

            const res = await axios.post("https://bot.lyo.su/quote/generate", payload);

            if (!res.data || !res.data.ok) return logger("Error API QC");

            const imgBuffer = Buffer.from(res.data.result.image, "base64");
            const temp = `./temp_${Date.now()}.webp`;

            // FFMPEG corregido para stickers transparentes
            const ff = exec(`ffmpeg -y -i pipe:0 -vcodec libwebp -filter:v "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0" "${temp}"`);

            ff.stdin.write(imgBuffer);
            ff.stdin.end();

            ff.on("close", async () => {
                if (fs.existsSync(temp)) {
                    await sock.sendMessage(m.key.remoteJid, { sticker: fs.readFileSync(temp) }, { quoted: m });
                    fs.unlinkSync(temp);
                    logger("Sticker enviado");
                }
            });

        } catch (e) {
            logger("ERROR GLOBAL:", e);
            sock.sendMessage(m.key.remoteJid, { text: "⚠️ Error en QC." }, { quoted: m });
        }
    }
};

