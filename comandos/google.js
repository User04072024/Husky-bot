const axios = require("axios");
const cheerio = require("cheerio");

module.exports = {
  name: "google",
  alias: ["buscar", "g"],
  description: "Busca información educativa en Internet y devuelve un resumen organizado en español.",
  async execute(sock, msg, args, from) {
    try {
      const query = args.join(" ").trim();
      if (!query) {
        await sock.sendMessage(
          from,
          { text: "Por favor escribe algo para buscar.\n\nEjemplo:\n!google historia del internet" },
          { quoted: msg }
        );
        return;
      }

      await sock.sendMessage(from, { text: "Buscando información en español..." }, { quoted: msg });

      // Buscar en DuckDuckGo en español
      const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query + " lang:es")}&kl=es-es`;

      const { data } = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept-Language": "es-ES,es;q=0.9"
        }
      });

      const $ = cheerio.load(data);
      const results = [];
      const blacklist = ["comprar", "venta", "oferta", "promoción", "suscríbete", "publicidad", "anuncio", "pornografía", "porno"];

      $(".result").each((i, el) => {
        let snippet = $(el).find(".result__snippet").text().trim();

        // Solo agregar si no contiene palabras de la blacklist
        if (snippet && !blacklist.some(word => snippet.toLowerCase().includes(word))) {
          // Tomar solo 1-2 frases para evitar textos muy largos o repetitivos
          const sentences = snippet.match(/[^.!?]+[.!?]+/g); // divide en frases
          if (sentences && sentences.length > 0) {
            snippet = sentences.slice(0, 2).join(" ").trim();
            results.push(snippet);
          }
        }
      });

      if (results.length === 0) {
        await sock.sendMessage(
          from,
          { text: `No se encontró información relevante en español sobre: ${query}` },
          { quoted: msg }
        );
        return;
      }

      // Eliminar duplicados
      const uniqueResults = [];
      results.forEach(snippet => {
        if (!uniqueResults.includes(snippet)) uniqueResults.push(snippet);
      });

      // Tomar hasta 3 resultados
      const resumen = uniqueResults.slice(0, 3).join("\n\n");

      const mensaje = 
`*RESUMEN DE BÚSQUEDA DE: ${query.toUpperCase()}*

${resumen}

Información resumida automáticamente desde fuentes confiables en español.`;

      await sock.sendMessage(from, { text: mensaje }, { quoted: msg });

    } catch (error) {
      console.error("❌ Error en !google:", error);
      await sock.sendMessage(from, { text: "Hubo un error al obtener los resultados." }, { quoted: msg });
    }
  }
};
