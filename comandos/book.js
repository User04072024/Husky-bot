const axios = require("axios");

module.exports = {
  name: "book",
  alias: ["cuaderno", "nota", "dls"],
  desc: "Genera una imagen de un cuaderno con texto personalizado",
  async execute(sock, msg, args, from) {
    try {
      // 1. Validar si hay argumentos
      if (!args || args.length === 0) {
        await sock.sendMessage(from, { 
          text: "❌ Ingresa el texto para el cuaderno.\n\n📌 *Ejemplo 1:* !book Hola Mundo\n📌 *Ejemplo 2:* !book Titulo | Contenido" 
        }, { quoted: msg });
        return;
      }

      // 2. Unir argumentos y separar Título de Contenido
      const fullText = args.join(" ");
      let titulo = "Husky-Bot"; // Título por defecto (footer en la API)
      let contenido = fullText;

      if (fullText.includes("|")) {
        const partes = fullText.split("|");
        titulo = partes[0].trim();
        contenido = partes[1].trim();
      }

      // 3. Construir URL de la API de Delirius
      const apiUrl = `https://api.delirius.store/canvas/book?text=${encodeURIComponent(contenido)}&footer=${encodeURIComponent(titulo)}`;

      // 4. Enviar la imagen del cuaderno
      await sock.sendMessage(from, { 
        image: { url: apiUrl },
        caption: `📝 *Cuaderno Generado*\n\n*Título:* ${titulo}\n*Texto:* ${contenido}`
      }, { quoted: msg });

      // 5. Pequeño delay opcional y mensaje de confirmación
      await new Promise(resolve => setTimeout(resolve, 500));
      await sock.sendMessage(from, { text: "✅ Imagen generada con éxito." });

    } catch (err) {
      console.error("❌ Error en !book:", err);
      await sock.sendMessage(from, { text: "⚠️ Ocurrió un error al conectar con la API de Delirius." }, { quoted: msg });
    }
  },
};

