const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  name: "ig",
  alias: ["instagram", "fb", "facebook"],
  desc: "Descarga con barra real (edit)",

  async execute(sock, msg, args, from) {
    try {
      if (!args || args.length === 0) {
        await sock.sendMessage(from, {
          text: "❌ Debes ingresar un enlace.\n\n📌 Ejemplo:\n!ig https://www.instagram.com/reel/xxxxx/"
        }, { quoted: msg });
        return;
      }

      const url = args[0].split("?")[0];
      const api = `https://api.delirius.store/download/instagram?url=${encodeURIComponent(url)}`;

      const res = await axios.get(api, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      const json = res.data;

      if (!json || !json.status || !json.data || !json.data.length) {
        await sock.sendMessage(from, {
          text: "❌ No se pudo obtener el contenido."
        }, { quoted: msg });
        return;
      }

      // 📩 Mensaje inicial
      let progressMsg = await sock.sendMessage(from, {
        text: "⏳ Iniciando descarga..."
      }, { quoted: msg });

      for (let i = 0; i < json.data.length; i++) {
        const media = json.data[i];

        try {
          const ext = media.type === "image" ? "jpg" : "mp4";
          const filePath = path.join(__dirname, `temp_${Date.now()}_${i}.${ext}`);

          const response = await axios({
            url: media.url,
            method: "GET",
            responseType: "stream"
          });

          const totalLength = response.headers['content-length'];
          let downloaded = 0;
          let lastPercent = 0;

          const writer = fs.createWriteStream(filePath);

          response.data.on("data", async (chunk) => {
            downloaded += chunk.length;

            if (totalLength) {
              const percent = Math.floor((downloaded / totalLength) * 100);

              // 🔄 Solo actualizar si cambia (evita spam)
              if (percent >= lastPercent + 10) {
                lastPercent = percent;

                const bar = "█".repeat(Math.floor(percent / 10)) + "░".repeat(10 - Math.floor(percent / 10));

                await sock.sendMessage(from, {
                  text: `📥 Descargando...\n[${bar}] ${percent}%`,
                  edit: progressMsg.key // 🔥 EDITA EL MISMO MENSAJE
                });
              }
            }
          });

          response.data.pipe(writer);

          await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
          });

          // 📤 Enviar archivo
          if (media.type === "image") {
            await sock.sendMessage(from, {
              image: fs.readFileSync(filePath),
              caption: "✅ Imagen lista."
            }, { quoted: msg });
          } else {
            await sock.sendMessage(from, {
              video: fs.readFileSync(filePath),
              caption: "✅ Video listo."
            }, { quoted: msg });
          }

          fs.unlinkSync(filePath);

        } catch (err) {
          console.log("Error media:", err.message);
        }
      }

      // ✅ Mensaje final (editado)
      await sock.sendMessage(from, {
        text: "🎉 Descarga completada.",
        edit: progressMsg.key
      });

    } catch (err) {
      console.error("❌ Error en !ig:", err);

      await sock.sendMessage(from, {
        text: "⚠️ Error general."
      }, { quoted: msg });
    }
  },
};
