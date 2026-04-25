const { GoogleGenAI } = require("@google/genai");

// Aquí pones tu clave literal
const ai = new GoogleGenAI({
  apiKey: "AIzaSyCfXV5r5xxjGZBcR91jiGY8OjGyDndiAmg"  // 🔑 reemplaza con tu clave
});

module.exports = {
  name: "ia",
  alias: ["gemini"],
  description: "Responde preguntas usando Google Gemini",

  async execute(sock, msg, args, from) {
    try {
      const pregunta = args.join(" ").trim();
      if (!pregunta) {
        await sock.sendMessage(
          from,
          { text: "Escribe tu pregunta después del comando.\n\nEjemplo:\n!ia ¿Qué es la inteligencia artificial?" },
          { quoted: msg }
        );
        return;
      }

      await sock.sendMessage(from, { text: "Consultando Gemini..." }, { quoted: msg });

      // ----------------------------------------------------
      // 🔁 FUNCIÓN PARA REINTENTAR SI DA ERROR 503
      // ----------------------------------------------------
      async function retryRequest(fn, retries = 3, delay = 1200) {
        try {
          return await fn();
        } catch (err) {
          if (err.status === 503 && retries > 0) {
            console.log(`⚠️ Gemini saturado, reintentando en ${delay}ms...`);
            await new Promise(res => setTimeout(res, delay));
            return retryRequest(fn, retries - 1, delay + 800);
          }
          throw err; // otros errores sí se lanzan
        }
      }

      // ----------------------------------------------------
      // 📡 Petición con reintentos
      // ----------------------------------------------------
      const response = await retryRequest(() =>
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: pregunta
        })
      );

      // ----------------------------------------------------
      // ✔ Texto correcto del modelo
      // ----------------------------------------------------
      const respuestaIA =
        response?.response?.text() ||
        response?.text ||
        "No se pudo obtener una respuesta";

      // ----------------------------------------------------
      // 📩 Enviar respuesta
      // ----------------------------------------------------
      await sock.sendMessage(from, { text: respuestaIA }, { quoted: msg });

    } catch (error) {
      console.error("❌ Error en !ia:", error);
      await sock.sendMessage(
        from,
        { text: "❌ Error al consultar Gemini.\n\n" + (error.message || "") },
        { quoted: msg }
      );
    }
  }
};
