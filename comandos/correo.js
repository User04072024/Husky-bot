// comandos/correo.js
const fs = require("fs");
const axios = require("axios");
const path = require("path");

const dataPath = path.join(__dirname, "../lib/correo.json");
const rotPath = path.join(__dirname, "../lib/api_rotacion.json");

// Si no existe, se crea
if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, "[]");
if (!fs.existsSync(rotPath)) fs.writeFileSync(rotPath, JSON.stringify({ index: 0 }, null, 2));

module.exports = {
    name: "correo",
    alias: ["mail", "tempmail"],
    description: "Correo temporal con rotación de APIs y fallback",

    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;

        let data = JSON.parse(fs.readFileSync(dataPath));
        let rot = JSON.parse(fs.readFileSync(rotPath));

        if (!Array.isArray(data)) data = [];

        const user = data.find(u => u.id === chatId);

        // Autodelete 7 segundos
        const send = async (text) => {
            const msg = await sock.sendMessage(chatId, { text }, { quoted: m });
            setTimeout(() => sock.sendMessage(chatId, { delete: msg.key }), 7000);
            return msg;
        };

        const saveData = () => fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        const saveRot = () => fs.writeFileSync(rotPath, JSON.stringify(rot, null, 2));

        // Menú
        if (!args[0]) {
            return send(
`📧 *Correos Temporales – Multi API con Rotación*

Comandos:
- !correo crear → Generar correo
- !correo bandeja → Ver correos
- !correo borrar → Borrar correo
- !correo nuevo → Generar uno nuevo

⚙️ Usa 3 APIs en forma rotativa.
✔️ Si una falla, pasa a la siguiente.`
            );
        }

        // ----------------------------
        // APIS
        // ----------------------------
        const api_mailtm = async () => {
            try {
                const domainData = await axios.get("https://api.mail.tm/domains");
                const domain = domainData.data["hydra:member"][0].domain;
                const username = `user${Math.floor(Math.random() * 9999)}`;
                const password = Math.random().toString(36).substring(2, 10);

                await axios.post("https://api.mail.tm/accounts", {
                    address: `${username}@${domain}`,
                    password,
                });

                const token = (await axios.post("https://api.mail.tm/token", {
                    address: `${username}@${domain}`,
                    password,
                })).data.token;

                return {
                    api: "mailtm",
                    address: `${username}@${domain}`,
                    password,
                    token
                };
            } catch {
                return null;
            }
        };

        const api_1secmail = async () => {
            try {
                const domains = ["1secmail.com", "1secmail.net", "1secmail.org"];
                const domain = domains[Math.floor(Math.random() * domains.length)];
                const username = `user${Math.floor(Math.random() * 9999)}`;

                return {
                    api: "1secmail",
                    address: `${username}@${domain}`
                };
            } catch {
                return null;
            }
        };

        const api_mail7 = async () => {
            try {
                const domain = "mail7.io";
                const username = `user${Math.floor(Math.random() * 9999)}`;

                return {
                    api: "mail7",
                    address: `${username}@${domain}`
                };
            } catch {
                return null;
            }
        };

        // APIs en array (rotación)
        const apis = [api_mailtm, api_1secmail, api_mail7];

        // ----------------------------
        // CREAR CORREO
        // ----------------------------
        if (args[0] === "crear") {
            if (user) {
                return send(
`📩 Ya tienes un correo creado:

\`\`\`
${user.address}
\`\`\`

(Mantén pulsado para copiar)`
                );
            }

            let finalUser = null;

            // Orden rotativo
            for (let i = 0; i < apis.length; i++) {
                const idx = (rot.index + i) % apis.length;
                const fn = apis[idx];

                const result = await fn();
                if (result) {
                    finalUser = result;
                    rot.index = (idx + 1) % apis.length; // avanzar rotación
                    saveRot();
                    break;
                }
            }

            if (!finalUser)
                return send("❌ Todas las APIs fallaron. Intenta más tarde.");

            data.push({
                id: chatId,
                ...finalUser
            });

            saveData();

            return send(
`✅ *Correo generado con éxito*

\`\`\`
${finalUser.address}
\`\`\`

API usada: *${finalUser.api}*
Borrado automático: *7 segundos*`
            );
        }

        // ----------------------------
        // BANDEJA
        // ----------------------------
        if (args[0] === "bandeja") {
            if (!user) return send("❌ No tienes un correo creado aún.");

            if (user.api === "1secmail") {
                const [name, domain] = user.address.split("@");
                const url = `https://www.1secmail.com/api/v1/?action=getMessages&login=${name}&domain=${domain}`;

                try {
                    const res = await axios.get(url);
                    if (res.data.length === 0) return send("📭 No hay mensajes nuevos.");

                    let list = res.data.map(m => `• ${m.from} → ${m.subject}`).join("\n");
                    return send(`📥 *Bandeja de entrada*\n\n${list}`);
                } catch {
                    return send("❌ Error al obtener bandeja.");
                }
            }

            return send("⚠️ Esta API no soporta leer bandeja aún.");
        }

        // ----------------------------
        // BORRAR CORREO
        // ----------------------------
        if (args[0] === "borrar") {
            if (!user) return send("❌ No tienes un correo creado.");

            data = data.filter(u => u.id !== chatId);
            saveData();

            return send("🗑️ Correo eliminado correctamente.");
        }

        // ----------------------------
        // NUEVO CORREO
        // ----------------------------
        if (args[0] === "nuevo") {
            data = data.filter(u => u.id !== chatId);
            saveData();

            return this.execute(sock, m, ["crear"]);
        }
    }
};
