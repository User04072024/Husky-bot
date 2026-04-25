const axios = require("axios");

module.exports = {
    name: "ip",
    alias: ["ipscan", "huskyip", "scanip"],
    description: "Escaneo avanzado de IP (HUSKY IP SCAN)",

    async execute(sock, msg, args) {
        console.log("[HUSKY] IP Scan iniciado");

        const remoteJid = msg.key.remoteJid;
        const ip = args[0];

        if (!ip) {
            return sock.sendMessage(
                remoteJid,
                {
                    text:
                        "🐶 *HUSKY IP SCAN*\n\n" +
                        "Uso correcto:\n" +
                        "`!ip <dirección IP>`\n\n" +
                        "Ejemplo:\n" +
                        "`!ip 8.8.8.8`"
                },
                { quoted: msg }
            );
        }

        const headers = {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept":
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9",
            "Connection": "keep-alive"
        };

        let result = null;

        /* ========= API 1 ========= */
        try {
            const r1 = await axios.get(`https://ipwho.is/${ip}`, {
                headers,
                timeout: 10000
            });

            if (r1.data && r1.data.success !== false) {
                result = {
                    ip: r1.data.ip,
                    country: r1.data.country,
                    city: r1.data.city,
                    isp: r1.data.connection?.isp || "No disponible",
                    org: r1.data.connection?.org || "No disponible",
                    proxy: r1.data.proxy,
                    vpn: r1.data.vpn,
                    tor: r1.data.tor
                };
            }
        } catch {
            console.log("[HUSKY] API 1 falló");
        }

        /* ========= API 2 ========= */
        if (!result) {
            try {
                const r2 = await axios.get(
                    `http://ip-api.com/json/${ip}?fields=status,country,city,isp,org,query,proxy`,
                    { headers, timeout: 10000 }
                );

                if (r2.data && r2.data.status === "success") {
                    result = {
                        ip: r2.data.query,
                        country: r2.data.country,
                        city: r2.data.city,
                        isp: r2.data.isp,
                        org: r2.data.org,
                        proxy: r2.data.proxy,
                        vpn: false,
                        tor: false
                    };
                }
            } catch {
                console.log("[HUSKY] API 2 falló");
            }
        }

        if (!result) {
            return sock.sendMessage(
                remoteJid,
                {
                    text:
                        "🐶 *HUSKY IP SCAN*\n\n" +
                        "❌ No fue posible analizar la IP.\n" +
                        "🔒 Bloqueo o rechazo del objetivo."
                },
                { quoted: msg }
            );
        }

        /* ========= DETECCIÓN DE HOSTING ========= */
        const textoProveedor = `${result.isp} ${result.org}`.toLowerCase();

        const esDatacenter = [
            "hosting",
            "cloud",
            "server",
            "datacenter",
            "vps",
            "ltd",
            "gmbh",
            "b.v.",
            "llc",
            "inc"
        ].some(p => textoProveedor.includes(p));

        /* ========= PUNTAJE ========= */
        let score = 10;

        if (esDatacenter) score += 30;
        if (result.proxy) score += 40;
        if (result.vpn) score += 30;
        if (result.tor) score += 50;

        if (score > 100) score = 100;

        /* ========= RIESGO & CLASIFICACIÓN ========= */
        let riesgo = "BAJO 🟢";
        let clasificacion = "Residencial";

        if (score >= 50) {
            riesgo = "ALTO 🔴";
            clasificacion = "Sospechosa";
        } else if (score >= 20) {
            riesgo = "MEDIO 🟡";
            clasificacion = "Hosting / Datacenter";
        }

        /* ========= MENSAJE FINAL ========= */
        const mensaje =
            "🐶 *HUSKY IP SCAN*\n" +
            "━━━━━━━━━━━━━━━━━━\n" +
            "📌 *Identificación*\n" +
            `• IP: ${result.ip}\n` +
            `• País: ${result.country || "N/A"}\n` +
            `• Ciudad: ${result.city || "N/A"}\n\n` +
            "🖧 *Proveedor*\n" +
            `• ISP: ${result.isp}\n` +
            `• Organización: ${result.org}\n\n` +
            "🛡️ *Seguridad*\n" +
            `• Proxy: ${result.proxy ? "Sí" : "No"}\n` +
            `• VPN: ${result.vpn ? "Sí" : "No"}\n` +
            `• TOR: ${result.tor ? "Sí" : "No"}\n\n` +
            `📊 *Puntaje de Riesgo:* ${score}/100\n` +
            `⚠️ *Nivel de Riesgo:* ${riesgo}\n` +
            `🏷️ *Clasificación:* ${clasificacion}\n` +
            "━━━━━━━━━━━━━━━━━━\n" +
            "✔ Escaneo completado";

        console.log("[HUSKY] Resultado enviado");

        await sock.sendMessage(
            remoteJid,
            { text: mensaje },
            { quoted: msg }
        );
    }
};
