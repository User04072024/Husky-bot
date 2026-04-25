const fetch = require('node-fetch');
const cheerio = require('cheerio');
const axios = require('axios');
const { lookup } = require('mime-types');
const cliProgress = require('cli-progress'); // Librería para la barra

async function mediafireDL(url) {
    const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const $ = cheerio.load(data);
    
    const dlLink = $('#downloadButton').attr('href') || $('.download_link a').attr('href');
    let filename = ($('.dl-info .filename').text() || $('div.filename').text() || 'archivo').trim().split('\n')[0];
    
    // Extracción precisa de metadatos
    const uploadDate = $('.details li:contains("Uploaded:") span').text().trim() || 'No disponible';
    const filesize = $('.details li:contains("File size:") span').text().trim() || $('.filesize').first().text().trim() || 'Desconocido';
    const filetype = $('.filetype').first().text().trim() || 'Desconocido';

    if (!dlLink) throw new Error('No se pudo obtener el enlace de descarga.');

    return { filename, filesize, filetype, uploadDate, link: dlLink };
}

module.exports = {
    name: "mediafire",
    alias: ["mf"],
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(" ");
        if (!query) return sock.sendMessage(from, { text: '❌ Pega un enlace de MediaFire.' });

        try {
            const file = await mediafireDL(query);

            const infoTxt = `┏━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🚀 *MEDIAFIRE EXTRACTOR*
┃━━━━━━━━━━━━━━━━━━━━━━━━
┃ 📄 *Nombre:* ${file.filename}
┃ 📦 *Peso:* ${file.filesize}
┃ 🛠️ *Tipo:* ${file.filetype}
┃ 📅 *Subido:* ${file.uploadDate}
┗━━━━━━━━━━━━━━━━━━━━━━━━
⏳ _Descargando... el mensaje se borrará al terminar._`;

            const sentMsg = await sock.sendMessage(from, { text: infoTxt }, { quoted: msg });

            // --- INICIO DE DESCARGA CON BARRA DE PROGRESO ---
            console.log(`\x1b[33m[PROCESO]\x1b[0m Descargando: ${file.filename}`);
            
            const response = await fetch(file.link);
            const contentLength = response.headers.get('content-length');
            const totalSize = parseInt(contentLength, 10);

            // Configurar barra en consola
            const progressBar = new cliProgress.SingleBar({
                format: 'Descargando [' + '\x1b[32m{bar}\x1b[0m' + '] {percentage}% | {value}/{total} bytes',
                hideCursor: true
            }, cliProgress.Presets.shades_classic);

            progressBar.start(totalSize, 0);

            const chunks = [];
            let downloadedSize = 0;

            for await (const chunk of response.body) {
                chunks.push(chunk);
                downloadedSize += chunk.length;
                progressBar.update(downloadedSize); // Actualiza la barra en Termux
            }

            progressBar.stop();
            const buffer = Buffer.concat(chunks);
            // --- FIN DE DESCARGA ---

            const mimetype = lookup(file.filename.split('.').pop()) || 'application/octet-stream';

            console.log(`\x1b[32m[ENVIO]\x1b[0m Enviando a WhatsApp...`);
            await sock.sendMessage(from, { 
                document: buffer, 
                fileName: file.filename, 
                mimetype, 
                caption: `✅ *${file.filename}* enviado.` 
            }, { quoted: msg });

            // Borrar mensaje de espera y limpiar
            await sock.sendMessage(from, { delete: sentMsg.key });
            console.log(`\x1b[36m[OK]\x1b[0m Tarea finalizada.`);

        } catch (err) {
            console.error(err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` });
        }
    }
};

