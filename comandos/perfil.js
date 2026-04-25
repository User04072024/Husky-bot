const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const Jimp = require('jimp');

const DB_PATH = path.join(__dirname, '../data2.0.json');
const FONT_PATH = path.join(__dirname, '../assets/fonts/open-sans-64-white.fnt');

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { usuarios: {}, lidmap: {} };
  }
}

async function generateAvatar(name) {
  const colors = [
    0xe94560ff, 0x533483ff, 0x52b788ff,
    0xf48c06ff, 0x7b2d8bff, 0x0096c7ff,
    0xe63946ff, 0x2a9d8fff, 0xe9c46aff,
    0x457b9dff, 0xc77dffff, 0xff6b6bff,
  ];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = 300;
  const image = new Jimp(size, size, color);
  try {
    const font = await Jimp.loadFont(FONT_PATH);
    const initial = (name || '?').charAt(0).toUpperCase();
    const textWidth  = Jimp.measureText(font, initial);
    const textHeight = Jimp.measureTextHeight(font, initial, size);
    const x = Math.floor((size - textWidth) / 2);
    const y = Math.floor((size - textHeight) / 2);
    image.print(font, x, y, initial);
  } catch (e) {
    console.error('⚠️ Error fuente avatar:', e.message);
  }
  return await image.getBufferAsync(Jimp.MIME_PNG);
}

// 🔍 Buscar usuario usando lidmap
function buscarUsuario(db, rawNum) {
  const lidmap = db.lidmap || {};

  // 1. Directo por @s.whatsapp.net
  if (db.usuarios?.[`${rawNum}@s.whatsapp.net`])
    return { u: db.usuarios[`${rawNum}@s.whatsapp.net`], jidReal: `${rawNum}@s.whatsapp.net` };

  // 2. Directo por @lid
  if (db.usuarios?.[`${rawNum}@lid`])
    return { u: db.usuarios[`${rawNum}@lid`], jidReal: `${rawNum}@lid` };

  // 3. lidmap número → lid
  const lidFromMap = lidmap[rawNum];
  if (lidFromMap && db.usuarios?.[lidFromMap])
    return { u: db.usuarios[lidFromMap], jidReal: lidFromMap };

  // 4. lidmap al revés lid → número
  const entryInversa = Object.entries(lidmap).find(
    ([, lid]) => lid === `${rawNum}@lid` || lid.split('@')[0] === rawNum
  );
  if (entryInversa) {
    const jid = `${entryInversa[0]}@s.whatsapp.net`;
    if (db.usuarios?.[jid]) return { u: db.usuarios[jid], jidReal: jid };
  }

  // 5. Búsqueda dentro de objetos usuario
  const encontrado = Object.entries(db.usuarios || {}).find(([key, usr]) => {
    const jidNum = (usr.jid || key).split('@')[0].split(':')[0];
    return jidNum === rawNum;
  });
  if (encontrado) return { u: encontrado[1], jidReal: encontrado[0] };

  return { u: null, jidReal: null };
}

// 🏅 Rango por nivel
function getRango(nivel) {
  if (nivel >= 50) return '👑 Leyenda';
  if (nivel >= 30) return '💎 Diamante';
  if (nivel >= 20) return '🏆 Platino';
  if (nivel >= 10) return '🥇 Oro';
  if (nivel >= 5)  return '🥈 Plata';
  return                  '🥉 Bronce';
}

// 🎨 Barra de XP
function xpBar(progreso, total = 12) {
  const filled = Math.round((progreso / 100) * total);
  return '▰'.repeat(filled) + '▱'.repeat(total - filled);
}

module.exports = {
  name: 'perfil',
  alias: ['profile', 'whois', 'me'],

  async execute(sock, msg, args, from, sender, db, saveDB, isOwner, sendMessageSafe, isAdmin) {
    // Si se pasa db desde bot.js usarla, si no cargar del archivo
    const database = db || loadDB();
    const lidmap   = database.lidmap || {};

    /* ── RESOLVER USUARIO ── */
    let target;
    const contextInfo =
      msg.message?.extendedTextMessage?.contextInfo ||
      msg.message?.imageMessage?.contextInfo ||
      msg.message?.videoMessage?.contextInfo;

    if (contextInfo?.quotedMessage) {
      target = contextInfo.participant;
    } else if (contextInfo?.mentionedJid?.length) {
      target = contextInfo.mentionedJid[0];
    } else if (args.length && args.join('').replace(/\D/g, '').length >= 8) {
      target = args.join('').replace(/\D/g, '') + '@s.whatsapp.net';
    } else {
      target = sender || msg.key.participant || msg.key.remoteJid;
    }

    if (!target) return;

    /* ── LIMPIAR JID ── */
    const rawNum = target.split('@')[0].split(':')[0];

    // Si viene como LID buscar número real en lidmap
    let numeroReal = rawNum;
    const entryLid = Object.entries(lidmap).find(
      ([, lid]) => lid === `${rawNum}@lid` || lid.split('@')[0] === rawNum
    );
    if (entryLid) numeroReal = entryLid[0];

    /* ── BUSCAR USUARIO ── */
    const { u } = buscarUsuario(database, rawNum);

    if (!u) {
      await sock.sendMessage(
        from,
        {
          text: `❌ No encontré datos de @${numeroReal} en la base de datos.`,
          mentions: [`${numeroReal}@s.whatsapp.net`]
        },
        { quoted: msg }
      );
      return;
    }

    /* ── DATOS BÁSICOS ── */
    const nombre   = u.name   || 'Sin nombre';
    const nivel    = u.nivel  || 1;
    const xp       = u.xp    || 0;
    const dinero   = u.dinero || 0;
    const xpMax    = nivel * 500;
    const progreso = Math.min(100, Math.floor((xp / xpMax) * 100));
    const rango    = getRango(nivel);
    const bar      = xpBar(progreso);

    /* ── STATS GLOBALES (soporta estructura vieja y nueva) ── */
    const sg = u.stats_globales || u.stats || {};
    const mensajes  = sg.mensajes   || 0;
    const fotos     = sg.fotos      || 0;
    const videos    = sg.videos     || 0;
    const audios    = sg.audios     || 0;
    const stickers  = sg.stickers   || 0;
    const docs      = sg.documentos || 0;
    const respuestas = sg.respuestas || 0;

    /* ── STATS DEL GRUPO ACTUAL ── */
    const datosGrupo  = u.grupos?.[from];
    const statsGrupo  = datosGrupo?.stats || {};
    const lastSeen    = datosGrupo?.last_seen || u.last_seen || 'Desconocido';
    const enGrupos    = Object.keys(u.grupos || {}).length;

    /* ── ROL ── */
    let rol = '👤 Miembro';

    if (from.endsWith('@g.us')) {
      const esAdminDB = datosGrupo?.isAdmin === true;
      if (esAdminDB) rol = '🛡️ Administrador';

      try {
        const meta = await sock.groupMetadata(from);
        const participante = meta.participants.find(p => {
          const pNum   = p.id.split('@')[0].split(':')[0];
          const lidDeP = lidmap[pNum];
          return pNum === numeroReal ||
                 pNum === rawNum ||
                 (lidDeP && (
                   lidDeP.split('@')[0] === rawNum ||
                   lidDeP.split('@')[0] === numeroReal
                 ));
        });

        if (participante?.admin === 'superadmin')    rol = '👑 Propietario';
        else if (participante?.admin === 'admin')     rol = '🛡️ Administrador';
        else                                          rol = '👤 Miembro';

        // Actualizar DB si cambió
        if (datosGrupo && datosGrupo.isAdmin !== !!participante?.admin) {
          datosGrupo.isAdmin = !!participante?.admin;
          if (saveDB) saveDB();
        }
      } catch {
        if (esAdminDB) rol = '🛡️ Administrador';
      }
    }

    /* ── TIPO ── */
    const botNum = sock.user.id.split(':')[0].split('@')[0];
    const tipo   = numeroReal === botNum ? '🤖 Bot' : '👤 Humano';

    /* ── FOTO DE PERFIL ── */
    let fotoUrl    = null;
    let fotoBuffer = null;
    try {
      fotoUrl = await sock.profilePictureUrl(`${numeroReal}@s.whatsapp.net`, 'image');
    } catch {}
    if (!fotoUrl) fotoBuffer = await generateAvatar(nombre);

    /* ── FECHA Y HORA ── */
    const hora  = moment().tz('America/Bogota').format('HH:mm:ss');
    const fecha = moment().tz('America/Bogota').format('DD/MM/YYYY');

    /* ── TEXTO ── */
    const texto = `
◈━━━━━━━━━━━━━━━━━━━━◈
  ⬡  *𝙃𝙐𝙎𝙆𝙔 · 𝘽𝙊𝙏*  ·  𝙐𝙎𝙀𝙍 𝙋𝙍𝙊𝙁𝙄𝙇𝙀  ⬡
◈━━━━━━━━━━━━━━━━━━━━◈

  ✦ *${nombre}*
  ╰─ ${tipo}  ·  ${rol}

◌ ─────── 𝗜𝗗𝗘𝗡𝗧𝗜𝗗𝗔𝗗 ─────── ◌
  📡 *ID:* \`${numeroReal}\`
  🏅 *Rango:* ${rango}
  🌐 *Grupos:* ${enGrupos}
  🕒 *Visto:* ${lastSeen}

◌ ────── 𝗘𝗫𝗣𝗘𝗥𝗜𝗘𝗡𝗖𝗜𝗔 ────── ◌
  📶 *Nivel ${nivel}*  ›  ${xp} / ${xpMax} XP
  ${bar}  ${progreso}%

◌ ──── 𝗔𝗖𝗧𝗜𝗩𝗜𝗗𝗔𝗗 𝗚𝗟𝗢𝗕𝗔𝗟 ──── ◌
  💬 Mensajes   ›  *${mensajes}*
  📸 Fotos      ›  *${fotos}*
  🎬 Videos     ›  *${videos}*
  🎙️ Audios     ›  *${audios}*
  🎭 Stickers   ›  *${stickers}*
  📄 Documentos ›  *${docs}*
  ↩️ Respuestas ›  *${respuestas}*

◌ ──── 𝗘𝗡 𝗘𝗦𝗧𝗘 𝗚𝗥𝗨𝗣𝗢 ──── ◌
  💬 Mensajes   ›  *${statsGrupo.mensajes   || 0}*
  📸 Fotos      ›  *${statsGrupo.fotos      || 0}*
  🎬 Videos     ›  *${statsGrupo.videos     || 0}*
  🎙️ Audios     ›  *${statsGrupo.audios     || 0}*
  🎭 Stickers   ›  *${statsGrupo.stickers   || 0}*
  📄 Documentos ›  *${statsGrupo.documentos || 0}*

◌ ──────── 𝗘𝗖𝗢𝗡𝗢𝗠𝗜́𝗔 ──────── ◌
  💵 Cartera    ›  *$${dinero}*

◈━━━━━━━━━━━━━━━━━━━━◈
  🗓 ${fecha}   ⏱ ${hora}
◈━━━━━━━━━━━━━━━━━━━━◈`;

    /* ── ENVÍO ── */
    if (fotoUrl) {
      await sock.sendMessage(from, {
        image: { url: fotoUrl },
        caption: texto,
        mentions: [`${numeroReal}@s.whatsapp.net`]
      }, { quoted: msg });
    } else {
      await sock.sendMessage(from, {
        image: fotoBuffer,
        caption: texto,
        mentions: [`${numeroReal}@s.whatsapp.net`]
      }, { quoted: msg });
    }
  }
};
