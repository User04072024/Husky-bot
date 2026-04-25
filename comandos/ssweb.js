const axios = require("axios");
const https = require("https");

module.exports = {
  name: "ssweb",
  alias: ["webss", "screenshotweb", "capturaweb"],
  desc: "Toma una captura de una página web y la envía como imagen",
  async execute(sock, msg, args, from) {
    try {
      if (!args || !args.length) {
        return await sock.sendMessage(
          from,
          { text: "❌ URL requerida." },
          { quoted: msg }
        );
      }

      let targetUrl = args[0].trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = "https://" + targetUrl;
      }

      const apiUrl = `https://api.delirius.store/tools/ssweb?url=${encodeURIComponent(targetUrl)}`;

      const res = await axios.get(apiUrl, {
        timeout: 30000,
        validateStatus: false,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });

      const data = res.data;

      if (!data || data.status !== true || !data.data || !data.data.download) {
        return await sock.sendMessage(
          from,
          {
            text: `\`\`\`json\n${JSON.stringify(data || { error: "Respuesta inválida" }, null, 2)}\n\`\`\``
          },
          { quoted: msg }
        );
      }

      const imageUrl = data.data.download;

      await sock.sendMessage(
        from,
        {
          image: { url: imageUrl }
        },
        { quoted: msg }
      );

    } catch (err) {
      await sock.sendMessage(
        from,
        {
          text: `⚠️ Error: ${err.message}`
        },
        { quoted: msg }
      );
    }
  }
};
