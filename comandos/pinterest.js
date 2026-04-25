const axios = require("axios");
const https = require("https");

module.exports = {
  name: "pint",
  alias: [],
  desc: "Busca imágenes en Pinterest o descarga un pin por URL",
  async execute(sock, msg, args, from) {
    try {
      if (!args || args.length === 0) {
        await sock.sendMessage(
          from,
          {
            text:
`╔════════════════════╗
║     𝑷𝒊𝒏𝒕𝒆𝒓𝒆𝒔𝒕      ║
╚════════════════════╝

✧ 𝘽𝙪𝙨𝙘𝙖 𝙞𝙢𝙖́𝙜𝙚𝙣𝙚𝙨
• !pint gatos
• !pint anime
• !pint flores

✧ 𝙐𝙨𝙖 𝙪𝙣 𝙚𝙣𝙡𝙖𝙘𝙚
• !pint https://pin.it/2Vflx5O

✧ 𝙍𝙚𝙨𝙪𝙡𝙩𝙖𝙙𝙤
• texto → 4 imágenes
• link → descarga el pin`
          },
          { quoted: msg }
        );
        return;
      }

      const input = args.join(" ").trim();
      const isPinUrl = /pin\.it|pinterest\.(com|es|mx|co)/i.test(input);
      const agent = new https.Agent({ rejectUnauthorized: false });

      if (isPinUrl) {
        let pinUrl = input;
        if (!/^https?:\/\//i.test(pinUrl)) {
          pinUrl = "https://" + pinUrl;
        }

        const apiUrl = `https://api.delirius.store/download/pinterestdl?url=${encodeURIComponent(pinUrl)}`;

        const res = await axios.get(apiUrl, {
          timeout: 30000,
          validateStatus: false,
          httpsAgent: agent,
          headers: {
            "User-Agent": "Mozilla/5.0"
          }
        });

        const data = res.data;

        if (!data || !data.status || !data.data || !data.data.download || !data.data.download.url) {
          await sock.sendMessage(
            from,
            { text: "⚠️ No se pudo obtener el contenido del pin." },
            { quoted: msg }
          );
          return;
        }

        const media = data.data.download;
        const caption = data.data.title || "Pinterest";

        if (media.type === "video") {
          await sock.sendMessage(
            from,
            {
              video: { url: media.url },
              caption
            },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            from,
            {
              image: { url: media.url },
              caption
            },
            { quoted: msg }
          );
        }

        return;
      }

      const apiUrl = `https://api.delirius.store/search/pinterest?text=${encodeURIComponent(input)}`;

      const res = await axios.get(apiUrl, {
        timeout: 30000,
        validateStatus: false,
        httpsAgent: agent,
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });

      const data = res.data;

      if (!data || !data.status || !Array.isArray(data.results) || data.results.length === 0) {
        await sock.sendMessage(
          from,
          { text: "⚠️ No se encontraron resultados." },
          { quoted: msg }
        );
        return;
      }

      const validImages = data.results.filter(url =>
        /\.(jpg|jpeg|png|webp)$/i.test(url)
      );

      const results = validImages.length ? validImages : data.results;
      const shuffled = [...results].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 4);

      for (const imageUrl of selected) {
        await sock.sendMessage(
          from,
          { image: { url: imageUrl } },
          { quoted: msg }
        );
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (err) {
      console.error("❌ Error en !pint:", err);
      await sock.sendMessage(
        from,
        { text: "⚠️ Ocurrió un error al buscar en Pinterest." },
        { quoted: msg }
      );
    }
  },
};
