const axios = require("axios");
const FormData = require("form-data");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const CATBOX_API = "https://catbox.moe/user/api.php";
const NANO_API = "https://api-faa.my.id/faa/nano-banana";
const CATBOX_USERHASH = process.env.CATBOX_USERHASH || "";

function log(...args) {
  console.log(new Date().toISOString(), "[IMG]", ...args);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extFromMime(mime = "") {
  mime = mime.toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "jpg";
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function unwrapMessageContainer(message = {}) {
  if (message.ephemeralMessage?.message) return unwrapMessageContainer(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return unwrapMessageContainer(message.viewOnceMessage.message);
  if (message.viewOnceMessageV2?.message) return unwrapMessageContainer(message.viewOnceMessageV2.message);
  if (message.viewOnceMessageV2Extension?.message) return unwrapMessageContainer(message.viewOnceMessageV2Extension.message);
  return message;
}

function getQuotedMessage(msg) {
  const message = unwrapMessageContainer(msg.message || {});
  const type = Object.keys(message)[0];
  if (!type) return null;

  const contextInfo = message[type]?.contextInfo;
  if (!contextInfo?.quotedMessage) return null;

  return unwrapMessageContainer(contextInfo.quotedMessage);
}

function getImageSource(msg) {
  const message = unwrapMessageContainer(msg.message || {});

  // Caso 1: el usuario envía una imagen con el comando en el caption
  if (message.imageMessage) {
    return {
      source: "direct",
      imageMessage: message.imageMessage,
      mimeType: message.imageMessage.mimetype || "image/jpeg",
    };
  }

  // Caso 2: el usuario responde a una imagen con !img ...
  const quoted = getQuotedMessage(msg);
  if (quoted?.imageMessage) {
    return {
      source: "quoted",
      imageMessage: quoted.imageMessage,
      mimeType: quoted.imageMessage.mimetype || "image/jpeg",
    };
  }

  return null;
}

async function downloadImageBuffer(imageMessage) {
  log("Descargando imagen desde WhatsApp...");
  const stream = await downloadContentFromMessage(imageMessage, "image");
  const buffer = await streamToBuffer(stream);
  log("Imagen descargada. Bytes:", buffer.length);
  return buffer;
}

async function uploadToCatbox(buffer, mimeType) {
  log("Subiendo a Catbox...");

  const form = new FormData();
  form.append("reqtype", "fileupload");
  if (CATBOX_USERHASH) form.append("userhash", CATBOX_USERHASH);
  form.append("fileToUpload", buffer, {
    filename: `img_${Date.now()}.${extFromMime(mimeType)}`,
    contentType: mimeType || "image/jpeg",
  });

  const res = await axios.post(CATBOX_API, form, {
    headers: form.getHeaders(),
    timeout: 120000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    responseType: "text",
    validateStatus: () => true,
  });

  const text = String(res.data || "").trim();

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Catbox HTTP ${res.status}: ${text.slice(0, 250)}`);
  }

  if (!/^https?:\/\//i.test(text)) {
    throw new Error(`Respuesta inesperada de Catbox: ${text.slice(0, 250)}`);
  }

  log("Subida exitosa:", text);
  return text;
}

async function deleteFromCatbox(fileUrl) {
  try {
    if (!CATBOX_USERHASH) {
      log("Sin CATBOX_USERHASH, omitiendo borrado remoto.");
      return false;
    }

    const fileName = String(fileUrl).split("/").pop();
    if (!fileName) return false;

    log("Borrando archivo remoto:", fileName);

    const form = new FormData();
    form.append("reqtype", "deletefiles");
    form.append("userhash", CATBOX_USERHASH);
    form.append("files", fileName);

    const res = await axios.post(CATBOX_API, form, {
      headers: form.getHeaders(),
      timeout: 60000,
      responseType: "text",
      validateStatus: () => true,
    });

    log("Respuesta borrado Catbox:", String(res.data || "").trim());
    return res.status >= 200 && res.status < 300;
  } catch (err) {
    log("Error borrando Catbox:", err.message);
    return false;
  }
}

async function downloadResultFromUrl(url) {
  log("Descargando resultado desde URL:", url);

  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 300000,
    validateStatus: () => true,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`No pude descargar el resultado final: HTTP ${res.status}`);
  }

  return Buffer.from(res.data);
}

async function processWithNanoBanana(imageUrl, prompt) {
  log("Enviando a Nano Banana...");
  log("Prompt:", prompt);

  const res = await axios.get(NANO_API, {
    params: {
      url: imageUrl,
      prompt,
    },
    responseType: "arraybuffer",
    timeout: 10 * 60 * 1000,
    validateStatus: () => true,
  });

  const contentType = String(res.headers["content-type"] || "").toLowerCase();

  if (res.status < 200 || res.status >= 300) {
    const errText = Buffer.from(res.data).toString("utf8");
    throw new Error(`Nano Banana HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  // Si la API devuelve la imagen directo
  if (contentType.startsWith("image/")) {
    log("La API devolvió imagen directa.");
    return Buffer.from(res.data);
  }

  const rawText = Buffer.from(res.data).toString("utf8").trim();
  log("Respuesta no binaria:", rawText.slice(0, 300));

  let json = null;
  try {
    json = JSON.parse(rawText);
  } catch (_) {}

  const possibleUrl =
    json?.url ||
    json?.data?.url ||
    json?.result?.url ||
    json?.image?.url ||
    json?.image ||
    json?.output?.url ||
    json?.output?.[0]?.url;

  if (possibleUrl && /^https?:\/\//i.test(possibleUrl)) {
    return await downloadResultFromUrl(possibleUrl);
  }

  const possibleBase64 =
    json?.base64 ||
    json?.data?.base64 ||
    json?.result?.base64 ||
    json?.image?.base64 ||
    json?.output?.[0]?.base64;

  if (possibleBase64) {
    log("La API devolvió base64.");
    const clean = String(possibleBase64).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    return Buffer.from(clean, "base64");
  }

  if (/^https?:\/\//i.test(rawText)) {
    return await downloadResultFromUrl(rawText);
  }

  throw new Error("La API no devolvió una imagen válida.");
}

module.exports = {
  name: "img",
  alias: ["nanoimg", "editimg", "bananaimg"],
  desc: "Edita una imagen a partir de un prompt",

  async execute(sock, msg, args, from) {
    let uploadedUrl = null;

    try {
      if (!args || !args.length) {
        await sock.sendMessage(
          from,
          {
            text: "❌ Escribe un prompt.\n\n📌 Ejemplo: !img cambia el color de cabello a blanco"
          },
          { quoted: msg }
        );
        return;
      }

      const prompt = args.join(" ").trim();

      log("========== NUEVA EJECUCIÓN !img ==========");
      log("Chat:", from);
      log("Prompt:", prompt);
      log("Tipos raíz:", Object.keys(msg.message || {}));

      const imageSource = getImageSource(msg);

      if (!imageSource) {
        const quoted = getQuotedMessage(msg);
        log("No se detectó imagen.");
        log("Tipos quoted:", quoted ? Object.keys(quoted) : "sin quoted");

        await sock.sendMessage(
          from,
          {
            text:
              "❌ Debes responder a una imagen o enviar una imagen con el comando en el pie.\n\n📌 Ejemplo:\n!img conviértela en estilo anime"
          },
          { quoted: msg }
        );
        return;
      }

      log("Imagen detectada desde:", imageSource.source);
      log("Mime:", imageSource.mimeType);

      await sock.sendMessage(
        from,
        {
          text:
            "🖼️ Procesando tu imagen...\n⏳ El proceso puede tardar desde algunos segundos hasta unos minutos."
        },
        { quoted: msg }
      );

      const inputBuffer = await downloadImageBuffer(imageSource.imageMessage);
      uploadedUrl = await uploadToCatbox(inputBuffer, imageSource.mimeType);

      const outputBuffer = await processWithNanoBanana(uploadedUrl, prompt);

      await sock.sendMessage(
        from,
        { image: outputBuffer },
        { quoted: msg }
      );

      await sleep(500);

      await sock.sendMessage(
        from,
        { text: "✅ Imagen procesada con éxito." },
        { quoted: msg }
      );

      log("Resultado enviado correctamente.");
    } catch (err) {
      console.error("❌ Error en !img:", err);
      log("Fallo:", err.message);

      await sock.sendMessage(
        from,
        {
          text: `⚠️ Ocurrió un error al procesar la imagen.\n\nDetalle: ${err.message}`
        },
        { quoted: msg }
      );
    } finally {
      if (uploadedUrl) {
        await deleteFromCatbox(uploadedUrl);
      }
      log("Limpieza final completada.");
      log("========== FIN !img ==========");
    }
  },
};
