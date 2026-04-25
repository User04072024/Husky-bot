const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// Función para ejecutar comandos de ImageMagick de forma asíncrona
function execShellCommand(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.warn(error);
                reject(error);
            }
            resolve(stdout ? stdout : stderr);
        });
    });
}

module.exports = {
  name: "pixel",
  alias: ["pixel"],
  desc: "Convierte una imagen en estilo pixelado usando comandos de Termux ◼️",
  async execute(sock, msg) { // Asumimos (sock, msg) como el orden correcto
    try {
      let bodyText = msg.body || ''; 
      let args = bodyText.trim().split(" ");
      args.shift(); // quitar !pixel
      let mode = args[0]?.toLowerCase();

      if (!["patrón", "pro", "borde"].includes(mode)) {
        return sock.sendMessage(msg.from, {
          text:
            "❌ *Modo inválido* 🟪\n\nUsa:\n• `!pixel patrón`\n• `!pixel pro`\n• `!pixel borde`"
        });
      }

      // 1. Determinar el mensaje que contiene la media
      const quoted = msg.quoted;
      let targetMessage = msg; 

      if (quoted) {
        targetMessage = quoted; 
      }
      
      const mediaContent = targetMessage.message?.imageMessage;
      
      if (!mediaContent)
        return sock.sendMessage(msg.from, {
          text: "📸 *Debes responder a una imagen* 🟥"
        });

      // 2. Descargar imagen
      // Usamos el buffer para guardar el archivo localmente
      const mediaBuffer = await sock.downloadMediaMessage(targetMessage); 

      // Carpeta temp y rutas de archivos
      const outputDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
      
      const inputPath = path.join(outputDir, `input_${Date.now()}.jpg`);
      const outputPath = path.join(outputDir, `pixel_${Date.now()}.jpg`);
      
      // Guardar el buffer al disco para que ImageMagick lo use
      fs.writeFileSync(inputPath, mediaBuffer);

      // 3. Configurar y Ejecutar Pixelado con ImageMagick (convert)
      let pixelSize = 20;

      if (mode === "patrón") {
        pixelSize = 18;
      } else if (mode === "pro") {
        pixelSize = 10;
      } else if (mode === "borde") {
        pixelSize = 16;
      }
      
      // Comando base de ImageMagick para pixelar
      // -scale 1/N: Reduce la imagen a 1/N de su tamaño.
      // -scale N: Devuelve la imagen a su tamaño original.
      let pixelCommand = `convert "${inputPath}" -scale 1/${pixelSize} -scale ${pixelSize}x "${outputPath}"`;
      
      // 4. Aplicar Borde (Mosaico) con ImageMagick
      if (mode === "borde") {
        // En lugar de escanear píxel por píxel (Jimp), usamos la técnica de *tile* o *modulate*
        // Esto es mucho más complejo de hacer solo con 'convert' sin sacrificar rendimiento.
        // Optaremos por el comando simple de pixelado y añadiremos un efecto de *posterize* para simular el look
        pixelCommand = `convert "${inputPath}" -scale 1/${pixelSize} -scale ${pixelSize}x -posterize 4 -quality 95 "${outputPath}"`;
        
        // Si quieres el efecto de cuadrícula exacto, necesitarías JIMP o un script shell avanzado.
        // Mantendremos el pixelado fuerte para el modo "borde".
      }

      // 5. Ejecutar el comando de Termux
      await execShellCommand(pixelCommand);

      // 6. Enviar resultado
      await sock.sendMessage(msg.from, {
        image: fs.readFileSync(outputPath),
        caption: `✨ Pixel hecho en modo *${mode}* 🟩`
      });

      // 7. Limpieza
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);

    } catch (err) {
      console.error(err);
      // Limpieza de emergencia por si algo falla antes de tiempo
      const files = [inputPath, outputPath].filter(p => p && fs.existsSync(p));
      files.forEach(p => fs.unlinkSync(p));
      
      return sock.sendMessage(msg.from, {
        text: "❌ Ocurrió un error procesando la imagen. Verifica si ImageMagick está instalado (pkg install imagemagick) 🟧."
      });
    }
  }
};

