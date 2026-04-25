const axios = require("axios")
const https = require("https")
const fs = require("fs")
const path = require("path")
const { exec } = require("child_process")

const agent = new https.Agent({ rejectUnauthorized: false })

const TMP = path.join(__dirname, "../tmp")
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP)

function reply(conn, from, m, text) {
    return conn.sendMessage(from, { text }, { quoted: m })
}

/* ───────────── SISTEMA AUTO-UPDATE ───────────── */

const API_STATUS_FILE = path.join(__dirname, "../api_status.json")
let apiStatus = fs.existsSync(API_STATUS_FILE)
    ? JSON.parse(fs.readFileSync(API_STATUS_FILE))
    : {}

function markFail(name) {
    apiStatus[name] = (apiStatus[name] || 0) + 1
    fs.writeFileSync(API_STATUS_FILE, JSON.stringify(apiStatus, null, 2))
}

function isBlocked(name) {
    return apiStatus[name] >= 3
}

/* ───────────── LUMA REAL (JOB_ID) ───────────── */
/*
⚠️ NECESITAS TOKEN REAL
Ejemplo (NO inventes):
process.env.LUMA_TOKEN = "Bearer eyJhbGciOi..."
*/

async function lumaGenerate(prompt) {
    const API = "https://api.lumalabs.ai/dream-machine/v1/generations"
    const HEADERS = {
        Authorization: process.env.LUMA_TOKEN,
        "Content-Type": "application/json"
    }

    if (!process.env.LUMA_TOKEN) {
        console.log("[LUMA] ❌ Sin token")
        return null
    }

    try {
        console.log("[LUMA] Enviando job…")
        const create = await axios.post(API, {
            prompt,
            aspect_ratio: "16:9",
            loop: false
        }, { headers: HEADERS, httpsAgent: agent })

        const id = create.data?.id
        if (!id) return null

        console.log(`[LUMA] Job creado → ${id}`)

        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 5000))

            const status = await axios.get(`${API}/${id}`, {
                headers: HEADERS,
                httpsAgent: agent
            })

            const s = status.data
            console.log(`[LUMA] Estado: ${s.state}`)

            if (s.state === "completed") {
                return s.assets?.video || null
            }

            if (s.state === "failed") return null
        }

    } catch (e) {
        console.log("[LUMA] ERROR:", e.message)
    }

    return null
}

/* ───────────── VIDEO FAKE (SIEMPRE FUNCIONA) ───────────── */

async function fakeVideoFromImage(prompt) {
    const imgPath = path.join(TMP, `img_${Date.now()}.jpg`)
    const videoPath = path.join(TMP, `video_${Date.now()}.mp4`)

    try {
        console.log("[FAKE] Generando imagen…")
        const img = await axios.get(
            `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&width=1024&height=1024`,
            { responseType: "arraybuffer", httpsAgent: agent }
        )

        fs.writeFileSync(imgPath, img.data)

        console.log("[FAKE] Creando video (ffmpeg)…")
        await new Promise((res, rej) => {
            exec(
                `ffmpeg -y -loop 1 -i "${imgPath}" -vf "zoompan=z='min(zoom+0.0015,1.2)':d=150" -t 6 -pix_fmt yuv420p "${videoPath}"`,
                (err) => err ? rej(err) : res()
            )
        })

        return videoPath

    } catch (e) {
        console.log("[FAKE] ERROR:", e.message)
        return null
    }
}

/* ───────────── COMANDO ───────────── */

module.exports = {
    name: "sora",
    alias: ["iavideo", "txt2video", "ia"],
    description: "Video IA real (Luma) + respaldo inteligente",

    async execute(conn, m, args, from) {
        console.log("[SORA] Comando ejecutado")

        const quoted =
            m.message?.extendedTextMessage?.contextInfo?.quotedMessage
        const quotedText =
            quoted?.conversation ||
            quoted?.extendedTextMessage?.text ||
            ""

        const prompt = args.join(" ").trim() || quotedText.trim()
        if (!prompt) {
            return reply(conn, from, m, "❌ Escribe un prompt.")
        }

        await reply(conn, from, m, "⏳ Generando video IA…")

        /* 1️⃣ LUMA REAL */
        if (!isBlocked("luma")) {
            const lumaVideo = await lumaGenerate(prompt)
            if (lumaVideo) {
                return conn.sendMessage(
                    from,
                    {
                        video: { url: lumaVideo },
                        mimetype: "video/mp4",
                        caption: `🎬 *Video IA (Luma)*\n\n📝 ${prompt}`
                    },
                    { quoted: m }
                )
            }
            markFail("luma")
        }

        /* 2️⃣ VIDEO FAKE */
        console.log("[SORA] Usando video fake")
        const fake = await fakeVideoFromImage(prompt)
        if (fake && fs.existsSync(fake)) {
            return conn.sendMessage(
                from,
                {
                    video: fs.readFileSync(fake),
                    mimetype: "video/mp4",
                    caption: `🎥 *Video IA (modo alternativo)*\n\n📝 ${prompt}`
                },
                { quoted: m }
            )
        }

        /* 3️⃣ IMAGEN FINAL */
        console.log("[SORA] Imagen final")
        return conn.sendMessage(
            from,
            {
                image: { url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` },
                caption: `🖼️ *Imagen IA*\n\n📝 ${prompt}`
            },
            { quoted: m }
        )
    }
}
