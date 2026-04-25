const axios = require("axios");
const fs = require("fs");
const path = require("path");

let spotifyBuffer = null;

async function getSpotifyImage() {                                                                                                                                                      if (!spotifyBuffer) {
        try {
            const res = await axios.get(
                "https://www.liderlogo.es/wp-content/uploads/2022/12/pasted-image-0-4.png",
                { responseType: "arraybuffer" }
            );
            spotifyBuffer = res.data;
        } catch (e) { spotifyBuffer = null; }
    }
    return spotifyBuffer;
}

module.exports = {
    name: "sp",
    alias: ["spotify"],

    async execute(sock, msg, args, from, sender) {
        const query = args.join(" ");
        if (!query) {
            return sock.sendMessage(from, { text: "❓ *¿Qué canción buscas?*" }, { quoted: msg });
        }

        console.log(`[ CMD ] Ejecutando !sp | Args: [${args}]`);

        try {
            const searchRes = await axios.get(`https://api.delirius.store/search/spotify?q=${encodeURIComponent(query)}&limit=5`);
            const results = searchRes.data?.data;

            if (!results || results.length === 0) {
                return sock.sendMessage(from, { text: "❌ Sin resultados." }, { quoted: msg });
            }

            const imageBuffer = await getSpotifyImage();

            // MENÚ INTERACTIVO
            await sock.sendMessage(from, {
                image: imageBuffer || { url: "https://via.placeholder.com/300" },
                caption: `🎧 *SPOTIFY EXPLORER*\n\n🔎 _${query}_\n\nSelecciona una canción 👇`,
                footer: "⚡ Powered by Huskydev - Alf",
                interactiveButtons: results.map((r, i) => ({
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: `🎵 ${r.title.slice(0, 20)}`,
                        id: `sp_dl_${i}`
                    })
                }))
            }, { quoted: msg });

            console.log(`[ OK ] Menú enviado. Esperando respuesta...`);

            // 🔥 MISMA LÓGICA QUE COPILOT (ARREGLADA)
            const buttonResponse = await waitForButtonReply(
                sock,
                from,
                msg.key.participant || from,
                60000
            );

            if (!buttonResponse) {
                console.log(`[ INFO ] Tiempo agotado`);
                return sock.sendMessage(from, { text: "⏰ Tiempo agotado." }, { quoted: msg });
            }

            const index = parseInt(buttonResponse.split("_")[2]);
            const track = results[index];

            if (!track) return;

            // MENSAJE DE DESCARGA
            await sock.sendMessage(from, {
                text: `📥 *Descargando:* _${track.title}_...`
            }, { quoted: msg });

            console.log(`[ CMD ] Descargando -> ${track.title}`);

            const tempFile = path.join(__dirname, `../tmp_${Date.now()}.mp3`);

            const resDl = await axios.get(`https://api.delirius.store/download/spotifydl?url=${encodeURIComponent(track.url)}`);
            const downloadUrl = resDl.data?.data?.download || resDl.data?.data?.link;

            const response = await axios({
                method: 'get',
                url: downloadUrl,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(tempFile);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            console.log(`[ BOT ] Enviando audio...`);

            await sock.sendMessage(from, {
                audio: fs.readFileSync(tempFile),
                mimetype: "audio/mp4",
                fileName: `${track.title}.mp3`
            }, { quoted: msg });

            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

            console.log(`[ OK ] Proceso completado.`);

        } catch (e) {
            console.log(`[ ERROR ] ${e.message}`);
            await sock.sendMessage(from, {
                text: "⚠️ Error al procesar la solicitud."
            }, { quoted: msg });
        }
    }
};

// 🔥 FUNCIÓN COPIADA Y ADAPTADA DE COPILOT
function waitForButtonReply(sock, from, senderJid, timeout = 60000) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            sock.ev.off("messages.upsert", handler);
            resolve(null);
        }, timeout);

        const handler = ({ messages }) => {
            for (const m of messages) {
                const isFromSender =
                    (m.key.participant || m.key.remoteJid) === senderJid &&
                    m.key.remoteJid === from &&
                    !m.key.fromMe;

                if (!isFromSender) continue;

                let buttonId = null;

                // INTERACTIVE
                const interactive = m.message?.interactiveResponseMessage;
                if (interactive) {
                    try {
                        const parsed = JSON.parse(interactive.nativeFlowResponseMessage?.paramsJson || "{}");
                        if (parsed?.id) buttonId = parsed.id;
                    } catch {}

                    if (!buttonId && interactive.selectedButtonId) {
                        buttonId = interactive.selectedButtonId;
                    }

                    if (!buttonId && interactive.nativeFlowResponseMessage?.name) {
                        buttonId = interactive.nativeFlowResponseMessage.name;
                    }
                }

                // BOTONES CLÁSICOS
                const buttons = m.message?.buttonsResponseMessage;
                if (!buttonId && buttons) {
                    buttonId = buttons.selectedButtonId || buttons.selectedDisplayText;
                }

                // TEMPLATE
                const template = m.message?.templateButtonReplyMessage;
                if (!buttonId && template) {
                    buttonId = template.selectedId || template.selectedDisplayText;
                }

                // TEXTO (fallback)
                const text = m.message?.conversation || m.message?.extendedTextMessage?.text;
                if (!buttonId && text && text.startsWith("sp_dl_")) {
                    buttonId = text.trim();
                }

                if (buttonId && buttonId.startsWith("sp_dl_")) {
     console.log(`[ OK ] Botón detectado: ${buttonId}`);
                    clearTimeout(timer);
                    sock.ev.off("messages.upsert", handler);
                    resolve(buttonId);
                }
            }
        };

        sock.ev.on("messages.upsert", handler);
    });
}


