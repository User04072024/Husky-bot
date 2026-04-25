const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// ================= CONFIGURACIÓN =================
const MI_NUMERO_REPORTE = 'tu-numero@s.whatsapp.net'; 
const IP_IMPRESORA = '192.168.100.2';
const PRECIO_BN = 500;
const PRECIO_COLOR = 1000;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    name: "imprimir",
    alias: ["p"],
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const cliente = msg.pushName || 'Cliente';
        
        // CORRECCIÓN: Extraer el primer argumento del array
        const seleccion = Array.isArray(args) ? args[0] : args; 

        // 1. MENÚ DE SELECCIÓN (Si no hay 1 o 2 en el primer argumento)
        if (!seleccion || !['1', '2'].includes(seleccion)) {
            console.log(`[!] Selección inválida recibida: ${seleccion}. Enviando menú.`);
            const menu = `🖨️ *CENTRO DE IMPRESIÓN RAW*\n\nResponde al PDF con:\n*!imprimir 1* — B/N ($${PRECIO_BN})\n*!imprimir 2* — Color ($${PRECIO_COLOR})`;
            return sock.sendMessage(from, { text: menu }, { quoted: msg });
        }

        try {
            // 2. DETECTAR SI ES RESPUESTA A UN PDF (QUOTED)
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const targetMsg = msg.message?.documentMessage ? msg.message : (quoted?.documentMessage ? quoted : null);

            if (!targetMsg) {
                return sock.sendMessage(from, { text: "⚠️ Debes *responder* a un archivo PDF con el comando." });
            }

            console.log(`\n[${new Date().toLocaleTimeString()}] 📥 Solicitud RAW de ${cliente} [Modo: ${seleccion}]`);
            
            // 3. DESCARGA DEL ARCHIVO
            const stream = await downloadContentFromMessage(targetMsg.documentMessage, 'document');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            const tempDir = path.join(__dirname, 'temp_print');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            
            const baseName = `job_${Date.now()}`;
            const tempPDF = path.join(tempDir, `${baseName}.pdf`);
            fs.writeFileSync(tempPDF, buffer);

            // 4. CONVERSIÓN A IMAGEN (Rasterizado para puerto 9100)
            console.log(`[>] Procesando PDF para envío vía Netcat...`);
            execSync(`pdftocairo -png -r 150 "${tempPDF}" "${path.join(tempDir, baseName)}"`);

            const files = fs.readdirSync(tempDir)
                .filter(f => f.startsWith(baseName) && f.endsWith('.png'))
                .sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));

            const totalPaginas = files.length;
            const esColor = seleccion === '2';
            const modoTexto = esColor ? "Color" : "B/N";
            const totalPagar = totalPaginas * (esColor ? PRECIO_COLOR : PRECIO_BN);

            await sock.sendMessage(from, { text: `⏳ *RAW Port 9100:* Enviando ${totalPaginas} pág(s) [${modoTexto}]...` });

            // 5. ENVÍO VÍA NETCAT (PUERTO 9100 RAW)
            for (let i = 0; i < files.length; i++) {
                const imgPath = path.join(tempDir, files[i]);
                
                console.log(`   -> Enviando pág ${i+1}/${totalPaginas} vía NC...`);
                try {
                    execSync(`nc ${IP_IMPRESORA} 9100 < "${imgPath}"`);
                } catch (ncErr) {
                    console.error("Error NC:", ncErr.message);
                }

                if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
                await delay(3000); 
            }

            if (fs.existsSync(tempPDF)) fs.unlinkSync(tempPDF);

            console.log(`[OK] Impresión finalizada.\n`);
            await sock.sendMessage(from, { text: `✅ *IMPRESIÓN ENVIADA*\n📑 Páginas: ${totalPaginas}\n💰 Total: $${totalPagar}` });
            await sock.sendMessage(MI_NUMERO_REPORTE, { text: `📊 REPORTE: ${cliente} | $${totalPagar}` });

        } catch (error) {
            console.error("[X] ERROR:", error);
            await sock.sendMessage(from, { text: "❌ Error al procesar o enviar el archivo vía RAW." });
        }
    }
};

