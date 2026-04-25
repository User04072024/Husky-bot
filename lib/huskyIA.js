const fs = require("fs");
const path = require("path");
const axios = require("axios");

/**
 * 🐺 Genera una frase graciosa al estilo Husky-Bot
 * Si la IA falla, usa frases locales desde rpg.json
 * @param {string} category - nombre del grupo de frases (por ej. "play_buscando", "play_final")
 */
async function getFunnyResponse(category) {
  try {
    // 🧠 Generar con IA
    const prompt = `
Eres Husky-Bot 🐺, un asistente bromista con estilo gamer y sarcástico.
Responde con una frase corta, graciosa y con emojis relacionados al contexto.
Ejemplo:
- "📡 Conectando antenas imaginarias… esto puede tardar 0.00042 siglos."
- "🎶 ¡Listo el temazo! Pero si lo bailas feo, no es culpa del bot 😎"
- "🔥 ¡Hit descargado! Si no te gusta, devuélvelo con lágrimas 💧"
- "🎧 ¡Tu canción está más fresca que el WiFi del vecino! 💨"
- "💃 ¡A bailar! Pero sin mover tanto la silla gamer 🕺"

Contexto: ${category}.
Devuelve solo la frase, sin explicaciones.
`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: prompt }],
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 4000,
      }
    );

    const aiText = response.data?.choices?.[0]?.message?.content?.trim();
    if (aiText) return aiText;
  } catch (err) {
    console.warn("⚠️ IA no disponible, usando frases locales...");
  }

  // 🐺 Si la IA falla → usar frases del archivo local
  try {
    const filePath = path.join(__dirname, "rpg.json"); // ← 🔥 aquí se cambió el nombre
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const frases = data[category];
    if (!frases || frases.length === 0)
      return "🐺 Estoy sin ideas... ¡reinstálame el sentido del humor!";
    return frases[Math.floor(Math.random() * frases.length)];
  } catch (err) {
    console.error("Error leyendo frases locales:", err);
    return "⚙️ Error cargando mi sentido del humor, inténtalo otra vez.";
  }
}

module.exports = { obtenerFrase: getFunnyResponse };
