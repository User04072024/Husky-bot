const { exec } = require("child_process")
const fs = require("fs")
const axios = require("axios")
const { Image } = require("node-webpmux")
const { downloadMediaMessage } = require("@whiskeysockets/baileys")
const { Exif } = require("./exif")

const searchCache = new Map()

const STK_PACK = "👑 𝐇𝐔𝐒𝐊𝐘-𝐁𝐎𝐓 👑\n"
const STK_AUTHOR = "🄷🅄🅂🄺🅈 🅂🅃🄸🄲🄺🄴🅁\n✧･ﾟ ρσωҽρҽԃ Ⴆყ Alfﾟ･✧"

const vfImage =
  "scale=512:512:force_original_aspect_ratio=decrease," +
  "pad=512:512:(512-iw)/2:(512-ih)/2:color=0x00000000," +
  "format=rgba"

const vfVideo =
  "fps=15," +
  "scale=512:512:force_original_aspect_ratio=decrease," +
  "pad=512:512:(512-iw)/2:(512-ih)/2:color=0x00000000," +
  "format=rgba"

async function addExifToWebp(buffer) {
  const img = new Image()
  await img.load(buffer)

  const exif = new Exif({
    packname: STK_PACK,
    author: STK_AUTHOR,
    categories: "Alegria",
    gmail: "huskyvps@gmail.com",
    webSite: "https://www.huskyvps.store",
    appstore: "https://www.huskyvps.store",
    playStore: "https://www.huskyvps.store"
  }).create()

  img.exif = exif
  return await img.save(null)
}

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message))
      resolve(stdout)
    })
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function safeUnlink(file) {
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file)
  } catch {}
}

function cleanupBase(base) {
  try {
    fs.readdirSync(process.cwd())
      .filter(f => f.startsWith(base))
      .forEach(f => safeUnlink(f))
  } catch {}
}

function logAxiosError(prefix, err) {
  console.error(`\n[${prefix}]`)
  console.error("message:", err?.message)
  console.error("code:", err?.code)

  if (err?.response) {
    console.error("status:", err.response.status)
    console.error("data:", err.response.data)
  } else if (err?.request) {
    console.error("No hubo respuesta del servidor")
  } else {
    console.error(err)
  }
}

function detectBufferExt(buf) {
  if (!buf || buf.length < 12) return "bin"

  const isWebp =
    buf.slice(0, 4).toString() === "RIFF" &&
    buf.slice(8, 12).toString() === "WEBP"

  const isGif = buf.slice(0, 3).toString() === "GIF"

  const isPng = buf
    .slice(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))

  const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff

  if (isWebp) return "webp"
  if (isGif) return "gif"
  if (isPng) return "png"
  if (isJpg) return "jpg"

  return "bin"
}

async function buildWebpFromFile(input, output, isVideo = false) {
  const vf = isVideo ? vfVideo : vfImage
  const extra = isVideo ? "-t 8 -an" : ""
  await run(`ffmpeg -y -i "${input}" ${extra} -vf "${vf}" -loop 0 "${output}"`)
}

function normalizeSearchResults(payload) {
  const raw =
    payload?.datos ||
    payload?.data ||
    payload?.results ||
    []

  if (!Array.isArray(raw)) return []

  return raw
    .map(item => ({
      name: item?.name || item?.nombre || "Sin nombre",
      author: item?.author || item?.autor || item?.autora || item?.username || "?",
      url: item?.url || item?.link || item?.enlace || item?.share || item?.compartir || null
    }))
    .filter(item => item.url && /^https?:\/\/sticker\.ly\/s\//i.test(item.url))
}

function normalizePack(payload) {
  const raw = payload?.datos || payload?.data || payload || {}

  let stickers = []

  if (Array.isArray(raw?.pegatinas)) {
    stickers = raw.pegatinas
  } else if (Array.isArray(raw?.stickers)) {
    stickers = raw.stickers
      .map(s => typeof s === "string" ? s : (s?.url || s?.src || s?.image || null))
      .filter(Boolean)
  }

  return {
    name: raw?.nombre || raw?.name || "Pack sin nombre",
    author: raw?.autora || raw?.author || raw?.autor || raw?.username || "?",
    stickers
  }
}

async function downloadBuffer(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 20000,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  })

  return Buffer.from(res.data)
}

module.exports = {
  name: "s",
  alias: ["sticker"],

  async execute(sock, m, args) {
    const jid = m.key.remoteJid
    const query = args.join(" ").trim()

    try {
      const quoted =
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
        m.message?.imageMessage?.contextInfo?.quotedMessage ||
        m.message?.videoMessage?.contextInfo?.quotedMessage

      const isQuotedImage = !!quoted?.imageMessage
      const isQuotedVideo = !!quoted?.videoMessage
      const isQuotedSticker = !!quoted?.stickerMessage

      if (isQuotedImage || isQuotedVideo || isQuotedSticker) {
        await sock.sendMessage(jid, { text: "🪄 *Generando sticker...*" }, { quoted: m })

        const buffer = await downloadMediaMessage(
          { message: quoted },
          "buffer",
          {},
          { reuploadRequest: sock.updateMediaMessage }
        )

        if (isQuotedSticker) {
          const finalSticker = await addExifToWebp(buffer)
          await sock.sendMessage(jid, { sticker: finalSticker }, { quoted: m })
          return
        }

        const base = `stk_${Date.now()}`
        const ext = isQuotedImage ? "jpg" : isQuotedVideo ? "mp4" : "bin"
        const input = `${base}.${ext}`
        const output = `${base}.webp`

        try {
          fs.writeFileSync(input, buffer)
          await buildWebpFromFile(input, output, isQuotedVideo)
          const finalSticker = await addExifToWebp(fs.readFileSync(output))
          await sock.sendMessage(jid, { sticker: finalSticker }, { quoted: m })
        } finally {
          cleanupBase(base)
        }

        return
      }

      if (searchCache.has(jid) && query) {
        const packs = searchCache.get(jid)
        const n = Number(query)

        let selected = null

        if (!Number.isNaN(n) && Number.isInteger(n) && n > 0) {
          selected = packs[n - 1]
        } else {
          selected = packs.find(p =>
            (p.name || "").toLowerCase().includes(query.toLowerCase())
          )
        }

        if (selected) {
          console.log("Pack seleccionado:", selected)

          const ok = await processPack(sock, jid, m, selected)

          if (ok) {
            searchCache.delete(jid)
          }

          return
        }
      }

      if (!query) {
        await sock.sendMessage(
          jid,
          { text: "💡 *Uso:* !s <nombre> o responde a imagen/video/sticker" },
          { quoted: m }
        )
        return
      }

      await sock.sendMessage(
        jid,
        { text: `🔎 *Buscando:* _${query}_...` },
        { quoted: m }
      )

      const searchUrl = `https://api.delirius.store/search/stickerly?query=${encodeURIComponent(query)}`
      const resp = await axios.get(searchUrl, {
        timeout: 20000,
        headers: {
          "User-Agent": "Mozilla/5.0"
        },
        validateStatus: () => true
      })

      if (resp.status !== 200) {
        console.error("search/stickerly fallo:", resp.status, resp.data)
        await sock.sendMessage(
          jid,
          { text: "❌ La API de búsqueda falló." },
          { quoted: m }
        )
        return
      }

      const results = normalizeSearchResults(resp.data)

      if (!results.length) {
        await sock.sendMessage(
          jid,
          { text: "❌ *No se encontraron resultados válidos.*" },
          { quoted: m }
        )
        return
      }

      const top = results.slice(0, 7)
      searchCache.set(jid, top)

      let msg = "✨ *RESULTADOS* ✨\n━━━━━━━━━━━━━━━━━━━━\n\n"
      top.forEach((p, i) => {
        msg += `${i + 1}️⃣ *${p.name}*\n╰ 👤 _${p.author}_\n\n`
      })
      msg += "━━━━━━━━━━━━━━━━━━━━\n✍️ Usa `!s número`"

      await sock.sendMessage(jid, { text: msg }, { quoted: m })
    } catch (e) {
      logAxiosError("execute", e)
      await sock.sendMessage(
        jid,
        { text: "❌ Error al procesar el comando sticker." },
        { quoted: m }
      )
    }
  }
}

async function processPack(sock, jid, m, selected) {
  try {
    const url = `https://api.delirius.store/download/stickerly?url=${encodeURIComponent(selected.url)}`
    const resp = await axios.get(url, {
      timeout: 20000,
      headers: {
        "User-Agent": "Mozilla/5.0"
      },
      validateStatus: () => true
    })

    const apiFalse =
      resp?.data?.status === false ||
      resp?.data?.estado === false

    if (resp.status !== 200 || apiFalse) {
      console.error("download/stickerly fallo:", resp.status, resp.data)

      const apiMsg =
        resp?.data?.msg ||
        resp?.data?.mensaje ||
        "Error desconocido"

      if (/displayName/i.test(apiMsg)) {
        await sock.sendMessage(
          jid,
          {
            text: "❌ Ese pack está roto o no es compatible con la API.\n\nPrueba con otro número."
          },
          { quoted: m }
        )
      } else {
        await sock.sendMessage(
          jid,
          {
            text: "❌ La API devolvió error al descargar ese pack.\n\nPrueba con otro número."
          },
          { quoted: m }
        )
      }

      return false
    }

    const pack = normalizePack(resp.data)

    if (!Array.isArray(pack.stickers) || !pack.stickers.length) {
      console.error("Pack inválido:", resp.data)
      await sock.sendMessage(
        jid,
        {
          text: "❌ Ese pack no contiene stickers válidos.\n\nPrueba con otro número."
        },
        { quoted: m }
      )
      return false
    }

    await sock.sendMessage(
      jid,
      {
        text: `📦 *${pack.name}*\n👤 ${pack.author}\n📥 Enviando stickers...`
      },
      { quoted: m }
    )

    let sent = 0

    for (let i = 0; i < Math.min(10, pack.stickers.length); i++) {
      const base = `stk_${Date.now()}_${i}`
      const output = `${base}.webp`

      try {
        const stickerUrl = pack.stickers[i]
        const buf = await downloadBuffer(stickerUrl)
        const ext = detectBufferExt(buf)
        const input = `${base}.${ext}`

        if (ext === "webp") {
          const finalSticker = await addExifToWebp(buf)
          await sock.sendMessage(jid, { sticker: finalSticker }, { quoted: m })
          sent++
        } else if (ext === "png" || ext === "jpg" || ext === "gif") {
          fs.writeFileSync(input, buf)
          await buildWebpFromFile(input, output, ext === "gif")
          const finalSticker = await addExifToWebp(fs.readFileSync(output))
          await sock.sendMessage(jid, { sticker: finalSticker }, { quoted: m })
          sent++
        } else {
          console.error(`Formato no soportado en sticker ${i + 1}:`, ext, stickerUrl)
        }
      } catch (e) {
        logAxiosError(`Sticker falló ${i + 1}`, e)
      } finally {
        cleanupBase(base)
      }

      await sleep(900)
    }

    if (!sent) {
      await sock.sendMessage(
        jid,
        {
          text: "❌ No pude convertir los stickers de ese pack.\n\nPrueba con otro número."
        },
        { quoted: m }
      )
      return false
    }

    return true
  } catch (err) {
    logAxiosError("processPack", err)
    await sock.sendMessage(
      jid,
      {
        text: "❌ Error al descargar el pack desde la API.\n\nPrueba con otro número."
      },
      { quoted: m }
    )
    return false
  }
}
