const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

module.exports = {
  name: "link",
  alias: ["extract", "links"],
  desc: "Extrae todos los enlaces de una página web y los envía en un mensaje de WhatsApp",
  async execute(sock, msg, args, from) {
    try {
      // 1. Validar si hay argumentos
      if (!args || args.length === 0) {
        console.log("❌ No se proporcionó una URL.");
        await sock.sendMessage(from, {
          text: "❌ Ingresa la URL de la página web para extraer los enlaces.\n\n📌 *Ejemplo:* !link https://example.com"
        }, { quoted: msg });
        return;
      }

      let url = args[0].trim();
      console.log(`URL proporcionada: ${url}`);

      // 2. Añadir esquema por defecto si no se proporciona
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
        console.log(`Esquema añadido: ${url}`);
      }

      // 3. Obtener los datos de la página web
      console.log(`Obteniendo datos de la página web: ${url}`);
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      console.log("Datos de la página web obtenidos con éxito.");

      // 4. Extraer todos los enlaces de la página
      const links = [];
      const files = [];

      // Extraer enlaces y archivos
      console.log("Extrayendo enlaces y archivos...");
      $('a, img').each((index, element) => {
        const src = $(element).attr('src') || $(element).attr('href');
        if (src && /\.json|\.jpg|\.png|\.gif|\.webp$/i.test(src)) {
          links.push(src);
        }
      });
      console.log(`Encontrados ${links.length} archivos para descargar.`);
      console.log("Archivos a descargar:", links);

      // Descargar y enviar archivos
      for (const link of links) {
        try {
          const fileName = path.basename(new URL(link).pathname);
          const filePath = path.join(__dirname, fileName);
          const writer = fs.createWriteStream(filePath);

          console.log(`Descargando archivo: ${link}`);
          const response = await axios({
            url: link,
            method: 'GET',
            responseType: 'stream'
          });

          response.data.pipe(writer);

          return new Promise((resolve, reject) => {
            writer.on('finish', async () => {
              files.push(filePath);
              console.log(`Archivo descargado y guardado en: ${filePath}`);
              resolve();
            });
            writer.on('error', reject);
          });
        } catch (error) {
          console.error(`Error al descargar ${link}:`, error);
        }
      }

      // Enviar archivos por WhatsApp
      for (const file of files) {
        console.log(`Enviando archivo por WhatsApp: ${file}`);
        try {
          await sock.sendMessage(from, { document: fs.readFileSync(file), mimetype: 'application/octet-stream', filename: path.basename(file) }, { quoted: msg });
          console.log(`Archivo enviado: ${file}`);
        } catch (error) {
          console.error(`Error al enviar archivo ${file}:`, error);
        }
        fs.unlinkSync(file); // Eliminar el archivo después de enviarlo
        console.log(`Archivo eliminado de la carpeta: ${file}`);
      }

      if (links.length > 0) {
        const linksMessage = "Extracted Links:\n" + links.join('\n');
        console.log("Enviando lista de enlaces extraídos.");
        await sock.sendMessage(from, { text: linksMessage }, { quoted: msg });
      } else {
        console.log("No se encontraron enlaces en la página web.");
        await sock.sendMessage(from, { text: "No se encontraron enlaces en la página web." }, { quoted: msg });
      }

    } catch (err) {
      console.error("❌ Error en !link:", err);
      await sock.sendMessage(from, { text: "⚠️ Ocurrió un error al extraer los enlaces de la página web." }, { quoted: msg });
    }
  },
};
