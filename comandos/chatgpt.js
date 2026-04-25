const fs = require('fs')
const path = require('path')
const axios = require('axios')
const FormData = require('form-data')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')

/* =========================
   LAS 10 APIS DE RESPALDO
========================= */
const APIS = [
  { name: 'Siputzx_Gpt4', url: "https://api.siputzx.my.id/api/ai/gpt4o?query=" },
  { name: 'Axl_Smart', url: "https://api.axl.my.id/api/ai/gpt4?text=" },
  { name: 'Vreden_Vision', url: "https://api.vreden.my.id/api/ai/gemini?query=" },
  { name: 'Meitang_IA', url: "https://api.meitang.my.id/api/ai/chatgpt?q=" },
  { name: 'Luminai', url: "https://api.paxsenix.biz.id/ai/luminai?text=" },
  { name: 'Blackbox_New', url: "https://api.vreden.my.id/api/ai/blackbox?query=" },
  { name: 'Darkness_Vision', url: "https://api.darkness.my.id/api/ai/gemini?q=" },
  { name: 'Pika_Dev', url: "https://api.pikas.site/api/gpt4o?query=" },
  { name: 'Aoyo_Cloud', url: "https://api.aoyo.ai/v1/chat/completions?query=" },
  { name: 'Delirius_Fix', url: "https://api.delirius.store/ia/gptprompt?text=" }
]

const DB_PATH = path.join(process.cwd(), 'lib', 'chatgpt_db.json')
function loadDB() { try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) } catch { return {} } }
function saveDB(db) { try { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)) } catch {} }

async function uploadImage(buffer) {
  try {
    const form = new FormData()
    form.append('fileToUpload', buffer, { filename: 'image.jpg' })
    form.append('reqtype', 'fileupload')
    const res = await axios.post('https://catbox.moe/user/api.php', form, { timeout: 30000 })
    return res.data 
  } catch { return null }
}

module.exports = {
  name: 'chatgpt',
  alias: ['ia', 'gpt', 'chat'],

  async execute(sock, msg, args = [], from) {
    const react = async (emoji) => { await sock.sendMessage(from, { react: { text: emoji, key: msg.key } }) }
    const db = loadDB()
    const sender = msg.key.participant || msg.remoteJid
    const text = args.join(' ').trim()

    // LÓGICA DE UN SOLO PÁRRAFO
    const necesitaLargo = /ensayo|redacta|articulo|cuento|historia/i.test(text)
    const constraint = necesitaLargo 
      ? "Responde de forma extensa y detallada." 
      : "Responde en UN SOLO PÁRRAFO corto y directo. PROHIBIDO dar sugerencias, consejos finales o preguntas al terminar."
    
    const sysPrompt = `Actúa como asistente alegre. ${constraint} PROHIBIDO anime y nombres como Delirius/Darlingg. Responde en español.`

    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      const isImage = msg.message?.imageMessage || quoted?.imageMessage

      let queryFinal = ""
      if (isImage) {
        await react('🕒')
        const target = msg.message?.imageMessage ? msg : { message: quoted }
        const buffer = await downloadMediaMessage(target, 'buffer', {}, { logger: console })
        const imageUrl = await uploadImage(buffer)
        if (!imageUrl) return sock.sendMessage(from, { text: "Catbox no funciona, como tu paciencia." }, { quoted: msg })
        queryFinal = `${sysPrompt} Analiza esta foto: ${imageUrl}. Describe qué ves en un solo párrafo. Pregunta: ${text || '¿Qué es?'}`
      } else {
        if (!text) return sock.sendMessage(from, { text: "¿Me vas a decir algo o solo ocupas espacio?" }, { quoted: msg })
        await react('🕒')
        if (!db[sender]) db[sender] = []
        const historial = db[sender].slice(-2).map(m => `${m.role === 'user' ? 'U' : 'B'}: ${m.content}`).join('\n')
        queryFinal = `${sysPrompt}\n${historial}\nU: ${text}\nB:`
      }

      let respuestaIA = null
      for (const api of APIS) {
        try {
          const res = await axios.get(`${api.url}${encodeURIComponent(queryFinal)}`, { timeout: 10000 })
          let rawRes = res.data.result || res.data.data || res.data.response || res.data.message || res.data.choices?.[0]?.message?.content
          
          if (rawRes && typeof rawRes === 'string' && rawRes.length > 2) {
            if (isImage && /anime|chica|rubia/i.test(rawRes)) continue
            
            // Limpieza y forzado de un solo párrafo por si la IA ignora el prompt
            respuestaIA = rawRes
              .split('\n')[0] // Nos quedamos solo con la primera línea/párrafo real
              .replace(/Delirius|Darlingg|Siputzx/gi, "el bot que te aguanta")
              .trim()
            break 
          }
        } catch { continue }
      }

      if (!respuestaIA) throw new Error("Muerte total.")
      if (!isImage) {
        db[sender].push({ role: 'user', content: text }); db[sender].push({ role: 'bot', content: respuestaIA })
        saveDB(db)
      }

      await react('✔️')
      await sock.sendMessage(from, { text: respuestaIA }, { quoted: msg })

    } catch (err) {
      await react('✖️')
      await sock.sendMessage(from, { text: "Todo explotó. Seguramente fue tu culpa por preguntar cosas raras." }, { quoted: msg })
    }
  }
}

