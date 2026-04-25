const axios = require('axios');

module.exports = {
  name: 'apk',
  description: 'Busca APKs y muestra información correcta',

  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;

    /* ─────────── MENÚ DE USO ─────────── */
    if (!args.length) {
      return sock.sendMessage(from, {
        text: `
╔═════*「 📦 APK SEARCH 」*═════
║
║ 📌 *Uso:*
║
║ 👉 !apk whatsapp
║ 👉 !apk capcut
║ 👉 !apk meme generator
║
║ 🔍 Busca APKs en AN1
║ ⚠️ No se descargan automáticamente
║
╚═════*「 𝑯𝑼𝑺𝑲𝒀 𝑩𝑶𝑻 」*═════
`
      }, { quoted: msg });
    }

    const query = args.join(' ').toLowerCase();

    try {
      /* ─────────── CONSULTA API ─────────── */
      const url = `https://api.delirius.store/search/ani1?query=${encodeURIComponent(query)}`;
      const res = await axios.get(url);
      const json = res.data;

      if (!json.status || !json.data?.length) {
        return sock.sendMessage(from, {
          text: `❌ No se encontraron APKs para *${query}*`
        }, { quoted: msg });
      }

      const results = json.data;

      /* ─────────── FILTRADO INTELIGENTE ─────────── */
      let apk =
        // 1️⃣ Coincidencia exacta
        results.find(a => a.name.toLowerCase() === query) ||

        // 2️⃣ Coincidencia parcial en nombre
        results.find(a => a.name.toLowerCase().includes(query)) ||

        // 3️⃣ Coincidencia en título
        results.find(a => a.title.toLowerCase().includes(query)) ||

        // 4️⃣ Fallback
        results[0];

      /* ─────────── TEXTO FINAL ─────────── */
      const texto = `
╔═════*「 📦 APK ENCONTRADO 」*═════
║
║ 📛 *Nombre:* ${apk.name}
║ 👨‍💻 *Desarrollador:* ${apk.developer}
║
║ 🧩 *Versión:* ${apk.version}
║ 📦 *Tamaño:* ${apk.size}
║ 📱 *Android:* ${apk.system}
║ ⭐ *Rating:* ${apk.rating} (${apk.vote} votos)
║
║ 📝 *Descripción:*
║ ${apk.description.substring(0, 350)}...
║
║ 🔗 *Página:* ${apk.link}
║ ⬇️ *Descarga:*
║ ${apk.download}
║
╚═════*「 𝑯𝑼𝑺𝑲𝒀 𝑩𝑶𝑻 」*═════
`;

      /* ─────────── ENVÍO ─────────── */
      if (apk.image) {
        await sock.sendMessage(from, {
          image: { url: apk.image },
          caption: texto
        }, { quoted: msg });
      } else {
        await sock.sendMessage(from, {
          text: texto
        }, { quoted: msg });
      }

    } catch (err) {
      console.error('❌ Error APK:', err);
      await sock.sendMessage(from, {
        text: '❌ Error al buscar el APK. Intenta más tarde.'
      }, { quoted: msg });
    }
  }
};
