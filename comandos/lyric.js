const axios = require("axios");

// Función de mapeo estilo "Times New Roman" (Serif Bold)
function mapToSerif(text) {
    const m = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    // Fuente Serif Bold: 𝐀𝐁𝐂𝐃... 𝐚𝐛𝐜𝐝...
    const c = "𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗";
    
    const cArray = Array.from(c);
    return text.split('').map(char => {
        const index = m.indexOf(char);
        return index > -1 ? cArray[index] : char;
    }).join('');
}

module.exports = {
  name: "lyric",
  alias: ["letra"],
  desc: "Busca letras con fuente estilo Serif (Times)",

  async execute(sock, msg, args, from, sender) {
    const query = args.join(" ").trim();
    if (!query) return sock.sendMessage(from, { text: "❌ Escribe el nombre de una canción." }, { quoted: msg });

    await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } });

    try {
      // 1. Búsqueda de la canción
      const search = await axios.get(`https://api.delirius.store/search/genius?q=${encodeURIComponent(query)}`);
      if (!search.data.status || !search.data.data[0]) {
        return sock.sendMessage(from, { text: "❌ Canción no encontrada." }, { quoted: msg });
      }

      const song = search.data.data[0];
      
      // 2. Obtención de la letra
      const lyricsRes = await axios.get(`https://api.delirius.store/search/geniuslyrics?url=${encodeURIComponent(song.url)}&parse=false`);
      if (!lyricsRes.data.status) {
        return sock.sendMessage(from, { text: "❌ No se pudo extraer la letra." }, { quoted: msg });
      }

      // 3. Procesamiento de texto
      const titulo = mapToSerif(song.title.toUpperCase());
      const artista = mapToSerif(song.artist.name.toUpperCase());
      const letra = mapToSerif(lyricsRes.data.data.lyrics);

      // Formato final limpio
      const mensaje = `🎵 *${titulo}*\n👤 *${artista}*\n\n${letra}`;

      await sock.sendMessage(from, {
        image: { url: song.image },
        caption: mensaje
      }, { quoted: msg });

      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, { text: "⚠️ Error al procesar la solicitud." }, { quoted: msg });
    }
  }
};

