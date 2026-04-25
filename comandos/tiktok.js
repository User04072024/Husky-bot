'use strict'

const axios = require('axios')

/* ───────── CONFIG ───────── */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const http = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': UA,
    Accept: '*/*',
  },
})

/* ───────── UTILS ───────── */

const fmt = n => (n ?? 0).toLocaleString('es')

function esMP4Valido(buf) {
  if (!buf || buf.length < 12) return false
  const h = buf.toString('ascii', 4, 8)
  return ['ftyp', 'moov', 'mdat'].includes(h) || buf.length > 50000
}

function extraerVideoId(input) {
  if (/^\d{15,25}$/.test(input)) return input
  return input.match(/\/video\/(\d+)/)?.[1] || null
}

async function resolverUrlCorta(url) {
  try {
    const r = await http.get(url, {
      maxRedirects: 0,
      validateStatus: s => s >= 300 && s < 400,
    })
    return r.headers.location?.match(/\/video\/(\d+)/)?.[1] || null
  } catch {
    return null
  }
}

/* ───────── TIKWM ───────── */

async function obtenerDatosTikWM(id) {
  const r = await http.get(
    `https://www.tikwm.com/api/?url=https://www.tiktok.com/@_/video/${id}`
  )

  const d = r.data?.data
  if (!d) return null

  return {
    /* VIDEO */
    id,
    descripcion: d.title || '',
    fecha: d.create_time
      ? new Date(d.create_time * 1000).toLocaleString('es')
      : '',
    duracion: d.duration || 0,
    region: d.region || 'N/A',

    /* ESTADÍSTICAS */
    vistas: d.play_count || 0,
    likes: d.digg_count || 0,
    comentarios: d.comment_count || 0,
    compartidos: d.share_count || 0,
    guardados: d.collect_count || 0,

    /* AUTOR (PERFIL REAL) */
    autor: d.author?.unique_id || 'N/A',
    nombre: d.author?.nickname || 'N/A',
    bio: d.author?.signature || '',
    verificado: Boolean(d.author?.verified),
    seguidores: d.author?.follower_count || 0,
    siguiendo: d.author?.following_count || 0,
    likes_autor: d.author?.heart_count || 0,
    videos_autor: d.author?.video_count || 0,

    /* DATOS TÉCNICOS */
    resolucion: d.width && d.height ? `${d.width}x${d.height}` : '',
    fps: d.fps || 'N/A',
    bitrate: d.bitrate ? `${Math.round(d.bitrate / 1000)} kbps` : 'N/A',
    calidad: d.definition || '',
    formato: 'MP4',

    /* TAGS */
    hashtags: Array.isArray(d.hashtags) ? d.hashtags.join(' ') : '',

    /* MÚSICA */
    musica: d.music || '',
    artista: d.music_info?.author || '',
    album: d.music_info?.album || '',
    duracion_musica: d.music_info?.duration
      ? `${d.music_info.duration}s`
      : 'N/A',

    play: d.hdplay || d.play,
  }
}

async function descargarVideo(url) {
  const r = await http.get(url, { responseType: 'arraybuffer' })
  const buf = Buffer.from(r.data)
  return esMP4Valido(buf) ? buf : null
}

async function tiktokDescargar(url) {
  let id = extraerVideoId(url)
  if (!id) id = await resolverUrlCorta(url)
  if (!id) throw new Error('No se pudo obtener el ID del video')

  const datos = await obtenerDatosTikWM(id)
  if (!datos) throw new Error('No se pudieron obtener los metadatos')

  const buffer = await descargarVideo(datos.play)
  if (!buffer) throw new Error('No se pudo descargar el video')

  datos.buffer = buffer
  return datos
}

/* ───────── HANDLER ───────── */

module.exports = {
  name: 'tk',
  alias: ['tiktok'],

  async execute(sock, m, args) {
    const chat = m.key.remoteJid

    if (!args[0]) {
      return sock.sendMessage(
        chat,
        { text: '📥 Uso:\n!tk <link de TikTok>' },
        { quoted: m }
      )
    }

    try {
      const r = await tiktokDescargar(args[0])
      const check = r.verificado ? ' ✅' : ''
      const dur = r.duracion ? `${r.duracion}s` : '—'

      const caption = [
        '╭━━ 🎬 *TIKTOK VIDEO* ━━╮',
        '',
        '📌 *TÍTULO / DESCRIPCIÓN*',
        `*${r.descripcion || 'Sin descripción'}*`,
        '',
        '🎥 *INFORMACIÓN GENERAL*',
        `• 🆔 ID: ${r.id}`,
        r.fecha ? `• 📅 Fecha: ${r.fecha}` : '',
        `• ⏱ Duración: ${dur}`,
        `• 🌍 Región: ${r.region}`,
        '',
        '📊 *ESTADÍSTICAS DEL VIDEO*',
        `• 👀 Vistas: ${fmt(r.vistas)}`,
        `• ❤️ Likes: ${fmt(r.likes)}`,
        `• 💬 Comentarios: ${fmt(r.comentarios)}`,
        `• 🔁 Compartidos: ${fmt(r.compartidos)}`,
        `• 🔖 Guardados: ${fmt(r.guardados)}`,
        '',
        '👤 *AUTOR DEL CONTENIDO*',
        `• 👤 Nombre: ${r.nombre}${check}`,
        `• 🆔 Usuario: @${r.autor}`,
        `• 👥 Seguidores: ${fmt(r.seguidores)}`,
        `• ➕ Siguiendo: ${fmt(r.siguiendo)}`,
        `• ❤️ Likes totales: ${fmt(r.likes_autor)}`,
        `• 🎬 Videos: ${fmt(r.videos_autor)}`,
        r.bio ? `• 📝 Bio: ${r.bio}` : '',
        '',
        '📐 *DATOS TÉCNICOS*',
        r.resolucion ? `• 📺 Resolución: ${r.resolucion}` : '',
        `• 🎞 FPS: ${r.fps}`,
        `• 📡 Bitrate: ${r.bitrate}`,
        r.calidad ? `• 🔷 Calidad: ${r.calidad}` : '',
        `• 📦 Formato: ${r.formato}`,
        `• 🐺 Fuente: Husky-Bot`,
        r.hashtags ? '' : '',
        r.hashtags ? `🏷️ *Tags:* ${r.hashtags}` : '',
        '',
        '🎵 *MÚSICA*',
        `• 🎶 Título: ${r.musica || 'N/A'}`,
        r.artista ? `• 🎤 Artista: ${r.artista}` : '',
        r.album ? `• 💿 Álbum: ${r.album}` : '',
        `• ⏱ Duración: ${r.duracion_musica}`,
        '',
        '🎧 *EXTRA*',
        '• Usa *.tkmp3* para descargar solo el audio',
        '',
        '╰━━ 🐺 *HUSKY-BOT* ━━━━━━━━━━━╯',
      ].filter(Boolean).join('\n')

      await sock.sendMessage(
        chat,
        {
          video: r.buffer,
          caption,
          mimetype: 'video/mp4',
          fileName: `tiktok_${r.id}.mp4`,
        },
        { quoted: m }
      )
    } catch (e) {
      console.error('[TIKTOK]', e)
      sock.sendMessage(
        chat,
        { text: '❌ Error al procesar el TikTok' },
        { quoted: m }
      )
    }
  },
}
