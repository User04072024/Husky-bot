const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');
const yts = require('yt-search');

require('events').EventEmitter.defaultMaxListeners = 20;

// ================= CONFIG =================

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// FLAGS PARA MÁXIMA CALIDAD EN FACEBOOK
const FACEBOOK_FLAGS = [
  '-f "bestvideo+bestaudio/best"', // Descarga lo mejor de video y audio por separado y los une
  '--merge-output-format mp4',     // Asegura que el resultado final sea MP4
  '--no-playlist',
  '--no-check-certificate',
  '--impersonate "chrome"'
].join(' ');

const YOUTUBE_FLAGS = [
  '-f "best[ext=mp4][height<=720]/bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best"',
  '--merge-output-format mp4',
  '--no-playlist'
].join(' ');

// ================= MAIN =================

async function handleDownload(input, msg, sock, from) {
  const tempDir = path.join(__dirname, '../temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const id = Date.now().toString();
  const out = path.join(tempDir, `${id}.%(ext)s`);

  const statusMsg = await sock.sendMessage(from, { text: '> 🔍 _Buscando contenido en alta calidad..._' }, { quoted: msg });
  const actualizar = async (txt) => sock.sendMessage(from, { text: `> ${txt}`, edit: statusMsg.key });

  try {
    let finalUrl = input.trim();
    const esFB = /facebook\.com|fb\.watch/i.test(finalUrl);
    const esYT = /youtube\.com|youtu\.be/i.test(finalUrl);

    let command;

    if (esFB) {
      command = `yt-dlp ${FACEBOOK_FLAGS} --user-agent "${DESKTOP_UA}" -o "${out}" "${finalUrl}"`;
    } else if (esYT) {
      command = `yt-dlp ${YOUTUBE_FLAGS} --user-agent "${DESKTOP_UA}" -o "${out}" "${finalUrl}"`;
    } else {
      const search = await yts(finalUrl);
      if (!search.videos.length) return await actualizar("❌ No se encontraron resultados.");
      finalUrl = search.videos[0].url;
      command = `yt-dlp ${YOUTUBE_FLAGS} --user-agent "${DESKTOP_UA}" -o "${out}" "${finalUrl}"`;
    }

    // --- FASE 2: DESCARGA ---
    await actualizar('📥 _Descargando video en máxima calidad..._');
    
    try {
        await execPromise(command, { maxBuffer: 1024 * 1024 * 150 }); // Buffer aumentado para videos 4K/HD
    } catch (e) {
        if (esFB) {
            await actualizar('🔄 _Calidad máxima no disponible, intentando calidad estándar..._');
            const fallbackCmd = `yt-dlp -f "best" --no-check-certificate -o "${out}" "${finalUrl}"`;
            await execPromise(fallbackCmd, { maxBuffer: 1024 * 1024 * 100 });
        } else {
            throw e;
        }
    }

    const files = fs.readdirSync(tempDir);
    const fileName = files.find(f => f.startsWith(id));

    if (!fileName) throw new Error('NO_FILE');
    const filePath = path.join(tempDir, fileName);

    // --- FASE 3: ENVÍO DEL VIDEO ---
    await actualizar('📤 _Enviando video..._');

    await sock.sendMessage(from, {
        video: fs.readFileSync(filePath),
        mimetype: 'video/mp4'
    }, { quoted: msg });

    // --- FASE 4: LIMPIEZA ---
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await actualizar('✅ _Proceso completado_');

  } catch (e) {
    console.error('❌ Error Final:', e);
    await actualizar('❌ _Error al procesar el video. Puede que sea demasiado pesado para WhatsApp._');
  }
}

// ================= EXPORT =================

module.exports = {
  name: 'vid',
  async execute(sock, msg, args, from) {
    const input = args.join(' ').trim();
    if (!input) return sock.sendMessage(from, { text: '📎 *Uso:* !vid <link o búsqueda>' }, { quoted: msg });
    await handleDownload(input, msg, sock, from);
  }
};

