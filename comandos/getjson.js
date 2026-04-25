const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");
const path = require("path");

module.exports = {
  name: "get",
  alias: ["extract", "webdata", "get"],
  desc: "Obtiene una URL y responde con archivo + JSON",
  async execute(sock, msg, args, from) {
    try {
      if (!args || !args.length) {
        return await sock.sendMessage(
          from,
          { text: JSON.stringify({ error: "URL requerida" }, null, 2) },
          { quoted: msg }
        );
      }

      const url = args[0].startsWith("http") ? args[0] : `https://${args[0]}`;

      const res = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0"
        },
        timeout: 30000,
        validateStatus: false,
        responseType: "arraybuffer",
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      });

      const headers = res.headers || {};
      const contentType = headers["content-type"] || "application/octet-stream";
      const buffer = Buffer.from(res.data || []);
      const isText =
        contentType.startsWith("text/") ||
        contentType.includes("json") ||
        contentType.includes("xml") ||
        contentType.includes("javascript");

      let fileName = "file";
      try {
        const pathname = new URL(url).pathname;
        const base = path.basename(pathname);
        if (base) fileName = base;
      } catch {}

      const disposition = headers["content-disposition"];
      if (disposition) {
        const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
        if (match && match[1]) {
          fileName = decodeURIComponent(match[1].replace(/"/g, ""));
        }
      }

      let body = null;
      let title = "";
      let meta = {};

      if (contentType.includes("application/json") || contentType.includes("text/json")) {
        try {
          body = JSON.parse(buffer.toString("utf8"));
        } catch {
          body = buffer.toString("utf8");
        }
      } else if (contentType.includes("text/html")) {
        try {
          const html = buffer.toString("utf8");
          const $ = cheerio.load(html);
          title = $("title").first().text().trim();

          $("meta").each((i, el) => {
            const n = $(el).attr("name") || $(el).attr("property");
            const c = $(el).attr("content");
            if (n && c) meta[n] = c;
          });
        } catch {}
      } else if (isText) {
        body = buffer.toString("utf8");
      }

      // Enviar archivo si la respuesta es binaria
      if (!isText && buffer.length > 0) {
        if (contentType.startsWith("image/")) {
          await sock.sendMessage(
            from,
            {
              image: buffer,
              mimetype: contentType
            },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            from,
            {
              document: buffer,
              mimetype: contentType,
              fileName
            },
            { quoted: msg }
          );
        }
      }

      const result = {
        url,
        status: res.status,
        contentType,
        contentLength: buffer.length,
        fileName: !isText ? fileName : null,
        server: {
          software: headers["server"] || null,
          poweredBy: headers["x-powered-by"] || null
        },
        page: title || Object.keys(meta).length ? { title, meta } : null,
        body
      };

      let jsonText = JSON.stringify(result, null, 2);

      if (jsonText.length <= 3500) {
        await sock.sendMessage(
          from,
          {
            text: `\`\`\`json\n${jsonText}\n\`\`\``
          },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(
          from,
          {
            document: Buffer.from(jsonText, "utf8"),
            mimetype: "application/json",
            fileName: "response.json"
          },
          { quoted: msg }
        );
      }
    } catch (err) {
      await sock.sendMessage(
        from,
        {
          text: `\`\`\`json\n${JSON.stringify({ error: err.message }, null, 2)}\n\`\`\``
        },
        { quoted: msg }
      );
    }
  }
};
