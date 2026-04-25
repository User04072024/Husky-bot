const path = require("path");
const fs = require("fs");
const os = require("os");
const { File } = require("megajs");

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
    name: "mega",
    alias: ["mg"],
    desc: "Descarga archivos desde MEGA (temporal)",
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const text = args.join(" ");

        if (!text) {
            return sock.sendMessage(from, { text: `❌ Por favor, envía un link de MEGA válido para descargar el archivo.` }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `⬇️ Descargando archivo de MEGA...` }, { quoted: msg });

            const file = File.fromURL(text);
            await file.loadAttributes();

            let maxSize = 300 * 1024 * 1024;
            if (file.size >= maxSize) {
                return sock.sendMessage(from, { text: `⚠️ El archivo es demasiado grande (Peso máximo: 300MB).` }, { quoted: msg });
            }

            const infoMsg = `📥 *¡MEGA Downloader!* 📥

📄 *Nombre:* ${file.name}
💾 *Tamaño:* ${formatBytes(file.size)}
🔗 *URL:* ${text}`;

            await sock.sendMessage(from, { text: infoMsg }, { quoted: msg });

            // Crear carpeta temporal si no existe
            const tempDir = path.join(os.tmpdir(), "whatsapp-bot");
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            // Descargar archivo temporalmente
            const tempFilePath = path.join(tempDir, file.name);
            const buffer = await file.downloadBuffer();
            fs.writeFileSync(tempFilePath, buffer);

            const fileExtension = path.extname(file.name).toLowerCase();
            const mimeTypes = {
                ".mp4": "video/mp4",
                ".pdf": "application/pdf",
                ".zip": "application/zip",
                ".rar": "application/x-rar-compressed",
                ".7z": "application/x-7z-compressed",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
            };
            const mimetype = mimeTypes[fileExtension] || "application/octet-stream";

            await sock.sendMessage(from, {
                document: fs.readFileSync(tempFilePath),
                mimetype,
                fileName: file.name,
                caption: "✅ Archivo descargado con éxito!"
            }, { quoted: msg });

            // Borrar archivo temporal
            fs.unlinkSync(tempFilePath);

        } catch (e) {
            return sock.sendMessage(from, { text: `⚠️ Ocurrió un error al descargar el archivo.\n> Usa !report para informarlo.\n\nError: ${e.message}` }, { quoted: msg });
        }
    }
};
