const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const WebP = require("node-webpmux");
const { exec } = require("child_process");
const { promisify } = require("util");
const { downloadContentFromMessage } = require("baileys"); 

const execAsync = promisify(exec);

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function getQuotedSticker(msg) {
  const contextInfo = msg.message?.extendedTextMessage?.contextInfo || 
                      msg.message?.stickerMessage?.contextInfo || null;
  const quoted = contextInfo?.quotedMessage;
  return quoted?.stickerMessage || quoted?.viewOnceMessageV2?.message?.stickerMessage || null;
}

module.exports = {
  name: "convert",
  description: "Convierte stickers a imagen o video (v1.8)",

  async execute(sock, msg, args, from) {
    try {
      const command = (args[0] || "").toLowerCase();
      const sticker = getQuotedSticker(msg);

      if (!sticker) return sock.sendMessage(from, { text: "⚠️ Responde a un sticker." }, { quoted: msg });

      const stream = await downloadContentFromMessage(sticker, "sticker");
      const buffer = await streamToBuffer(stream);
      const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "husky-"));

      // --- MODO IMAGEN ---
      if (command === "img") {
        const inputPath = path.join(tempDir, "input.webp");
        const outputPath = path.join(tempDir, "output.png");
        await fsp.writeFile(inputPath, buffer);
        await execAsync(`ffmpeg -y -i ${inputPath} -frames:v 1 ${outputPath}`);
        const result = await fsp.readFile(outputPath);
        await fsp.rm(tempDir, { recursive: true, force: true });
        return sock.sendMessage(from, { image: result, caption: "✅ Imagen lista" }, { quoted: msg });
      }

      // --- MODO VIDEO ---
      if (command === "vid") {
        if (!sticker.isAnimated) {
          await fsp.rm(tempDir, { recursive: true, force: true });
          return sock.sendMessage(from, { text: "⚠️ Este sticker no es animado." }, { quoted: msg });
        }

        await sock.sendMessage(from, { text: "⏳ Procesando video... (Extrayendo frames)" }, { quoted: msg });

        const img = new WebP.Image();
        await img.load(buffer);

        // CORRECCIÓN AQUÍ: Acceso correcto a los frames en node-webpmux
        const frames = img.anim ? img.anim.frames : [];
        
        if (frames.length === 0) {
            throw new Error("No se encontraron frames animados en este sticker.");
        }

        for (let i = 0; i < frames.length; i++) {
          const frameBuffer = await img.getFrame(i);
          const framePath = path.join(tempDir, `f_${i.toString().padStart(3, "0")}.png`);
          // Convertimos el frame a PNG
          await execAsync(`ffmpeg -y -i pipe:0 ${framePath}`, { input: frameBuffer });
        }

        const fps = 1000 / (frames[0].delay || 100);
        const outPath = path.join(tempDir, "out.mp4");
        
        // Unir frames (usamos pix_fmt yuv420p para que sea compatible con todos los celulares)
        await execAsync(`ffmpeg -y -framerate ${fps} -i ${tempDir}/f_%03d.png -c:v libx264 -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -preset ultrafast ${outPath}`);
        
        const videoBuffer = await fsp.readFile(outPath);
        await fsp.rm(tempDir, { recursive: true, force: true });

        return sock.sendMessage(from, { 
            video: videoBuffer, 
            mimetype: "video/mp4", 
            caption: "✅ Video generado por Husky Bot v1.8" 
        }, { quoted: msg });
      }

    } catch (e) {
      console.error(e);
      return sock.sendMessage(from, { text: "❌ Error: " + e.message }, { quoted: msg });
    }
  }
};

