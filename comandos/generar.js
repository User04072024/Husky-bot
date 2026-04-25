const axios = require("axios");
const fs = require("fs");
const path = require("path");

// --- LISTA DE USER AGENTS PARA BYPASS ---
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15",
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.64 Mobile Safari/537.36",
  "Mozilla/5.0 (iPad; CPU OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1"
];

// --- OBJETO MAESTRO DE ESTILOS ---
const DATA_ESTILOS = {
  "Anime": {
    "anime": "anime style, high quality",
    "manga": "manga style, black and white lines",
    "waifu": "waifu style, cute anime girl aesthetic",
    "ghibli": "studio ghibli style, lush landscapes",
    "vintage-anime": "vintage anime style, retro 90s"
  },
  "Arte": {
    "digital": "digital painting, high resolution, artstation",
    "oil": "oil painting style, textured brush strokes",
    "watercolor": "watercolor style, soft artistic bleeds",
    "sketch": "pencil sketch, hand drawn, graphite",
    "fantasy": "fantasy painting style, epic lighting"
  },
  "3D": {
    "disney": "3d disney character style, pixar aesthetic",
    "pokemon": "3d pokemon style, nintendo render",
    "claymation": "claymation, plasticine handmade style",
    "pixel": "pixel art style, 8-bit, retro game"
  },
  "Realismo": {
    "cinematic": "cinematic lighting, dramatic, movie shot",
    "photo": "professional photo, sharp focus, dslr",
    "realista": "photorealistic, ultra detailed, raw photo"
  }
};

module.exports = {
  name: "generar",
  alias: ["gen", "ia"],
  desc: "Generador Husky IA con Rotación de Agentes",

  async execute(sock, msg, args, from) {
    if (!args || args.length === 0) {
      let menuDinamico = `🎨 *GENERADOR IA - GUÍA DE ESTILOS* 🎨\n\n`;
      menuDinamico += `*Uso:* !generar [texto] --[estilo] --[formato]\n\n`;
      for (const [categoria, comandos] of Object.entries(DATA_ESTILOS)) {
        const listaComandos = Object.keys(comandos).map(cmd => `--${cmd}`).join(", ");
        menuDinamico += `*🎭 ${categoria}:*\n• ${listaComandos}\n\n`;
      }
      menuDinamico += `*📐 Formatos (Shape):*\n• --square, --portrait, --landscape\n\n`;
      menuDinamico += `*Ejemplo:* !generar gato volando --anime --landscape`;
      return await sock.sendMessage(from, { text: menuDinamico }, { quoted: msg });
    }

    let tempPath = null;
    try {
      let inputPrompt = args.join(" ");
      let aspect = "1:1";
      if (inputPrompt.includes("--portrait")) { aspect = "2:3"; inputPrompt = inputPrompt.replace("--portrait", ""); }
      else if (inputPrompt.includes("--landscape")) { aspect = "3:2"; inputPrompt = inputPrompt.replace("--landscape", ""); }
      else if (inputPrompt.includes("--square")) { aspect = "1:1"; inputPrompt = inputPrompt.replace("--square", ""); }

      let estiloNombre = "Ninguno";
      let estiloParaIA = "";
      for (const categoria in DATA_ESTILOS) {
        for (const [comando, promptIA] of Object.entries(DATA_ESTILOS[categoria])) {
          if (inputPrompt.includes(`--${comando}`)) {
            estiloNombre = comando.charAt(0).toUpperCase() + comando.slice(1);
            estiloParaIA = promptIA;
            inputPrompt = inputPrompt.replace(`--${comando}`, "").trim();
            break;
          }
        }
      }

      const promptFinal = estiloParaIA ? `${inputPrompt}, ${estiloParaIA}` : inputPrompt;
      const seed = Math.floor(Math.random() * 999999999);

      // --- SELECCIÓN ALEATORIA DE USER AGENT ---
      const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      console.log(`[DEBUG] Usando User-Agent: ${randomUA}`);

      await sock.sendMessage(from, { text: "⏳ *Husky Bot* está generando tu imagen..." }, { quoted: msg });

      const response = await axios({
        method: 'post',
        url: 'https://aifreeforever.com/api/generate-image',
        data: {
          prompt: promptFinal,
          negative_prompt: "nsfw, nudity, blurry, bad anatomy",
          model: "stable-diffusion-xl",
          aspect_ratio: aspect,
          seed: seed
        },
        headers: {
          'Origin': 'https://aifreeforever.com',
          'Referer': 'https://aifreeforever.com/image-generators',
          'User-Agent': randomUA,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 150000
      });

      const imageData = response.data.imageUrl || (response.data.images && response.data.images[0]);
      if (!imageData) throw new Error("Servidor ocupado.");

      tempPath = path.join(__dirname, `../temp_husky_${Date.now()}.png`);
      const imgRes = await axios.get(imageData, { responseType: 'arraybuffer' });
      fs.writeFileSync(tempPath, imgRes.data);

      // --- MENSAJE FINAL ESTILO PERCHANCE ---
      const captionText = `✅ *Imagen Lista*

📝 *Prompt:* ${inputPrompt}
🎭 *Estilo:* ${estiloNombre}
📐 *Formato:* ${aspect}
🌱 *Seed:* ${seed}`;

      await sock.sendMessage(from, { 
        image: fs.readFileSync(tempPath),
        caption: captionText
      }, { quoted: msg });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, { text: "⚠️ Error al conectar con Husky IA. Intenta de nuevo." });
    } finally {
      if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  },
};

