const { exec } = require("child_process")
const fs = require("fs")
const { Image } = require("node-webpmux")
const { downloadMediaMessage } = require("@whiskeysockets/baileys")
const { Exif } = require("./exif")

const STK_PACK = "👑 𝐇𝐔𝐒𝐊𝐘-𝐁𝐎𝐓 👑\n"
const STK_AUTHOR = "🄷🅄🅂🄺🅈 🅂🅃🄸🄲🄺🄴🅁\n✧･ﾟ ρσωҽρҽԃ Ⴆყ Alfﾟ･✧"

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

async function buildBlurWebp(input, output) {
  // 1. scale=20:20        → quita resolución, pierde detalle
  // 2. scale=512:512 neighbor → amplía con bloques visibles
  // 3. gblur=sigma=8      → suaviza bordes de bloques (efecto foto borrosa real)
  const vf = [
    "scale=20:20",
    "scale=512:512:flags=neighbor",
    "gblur=sigma=8",
    "pad=512:512:(512-iw)/2:(512-ih)/2:color=0x00000000",
    "format=rgba"
  ].join(",")

  await run(
    `ffmpeg -y -i "${input}" -vf "${vf}" -c:v libwebp -quality 10 -preset icon -loop 0 "${output}"`
  )
}

module.exports = {
  name: "sb",
  alias: ["sb", "blurs", "stickerb"],

  async execute(sock, m, args) {
    const jid = m.key.remoteJid

    const quoted =
      m.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
      m.message?.imageMessage?.contextInfo?.quotedMessage ||
      m.message?.stickerMessage?.contextInfo?.quotedMessage ||
      m.message

    const isQuotedImage   = !!quoted?.imageMessage
    const isQuotedSticker = !!quoted?.stickerMessage
    const isDirectImage   = !!m.message?.imageMessage
    const isDirectSticker = !!m.message?.stickerMessage

    const isImage   = isQuotedImage   || isDirectImage
    const isSticker = isQuotedSticker || isDirectSticker

    if (!isImage && !isSticker) {
      await sock.sendMessage(
        jid,
        { text: "❌ Responde a una *imagen* o *sticker* con !sb." },
        { quoted: m }
      )
      return
    }

    const ext    = isSticker ? "webp" : "jpg"
    const base   = `sb_${Date.now()}`
    const input  = `${base}.${ext}`
    const output = `${base}_out.webp`

    try {
      const msgSource = isSticker
        ? (isQuotedSticker ? quoted : m.message)
        : (isQuotedImage   ? quoted : m.message)

      const buffer = await downloadMediaMessage(
        { message: msgSource },
        "buffer",
        {},
        { reuploadRequest: sock.updateMediaMessage }
      )

      fs.writeFileSync(input, buffer)
      await buildBlurWebp(input, output)

      const finalSticker = await addExifToWebp(fs.readFileSync(output))
      await sock.sendMessage(jid, { sticker: finalSticker }, { quoted: m })

    } catch (e) {
      console.error("[stickerborroso] Error:", e?.message || e)
      await sock.sendMessage(
        jid,
        { text: "❌ Error al generar el sticker." },
        { quoted: m }
      )
    } finally {
      cleanupBase(base)
    }
  }
}

