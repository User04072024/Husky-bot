const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  }
});

/* ================== PAÍSES LATAM ================== */

const PAISES_LATAM = {
  mexico: { flag: '🇲🇽', name: 'México' },
  guatemala: { flag: '🇬🇹', name: 'Guatemala' },
  honduras: { flag: '🇭🇳', name: 'Honduras' },
  salvador: { flag: '🇸🇻', name: 'El Salvador' },
  nicaragua: { flag: '🇳🇮', name: 'Nicaragua' },
  costarica: { flag: '🇨🇷', name: 'Costa Rica' },
  panama: { flag: '🇵🇦', name: 'Panamá' },
  cuba: { flag: '🇨🇺', name: 'Cuba' },
  dominicana: { flag: '🇩🇴', name: 'República Dominicana' },
  puertorico: { flag: '🇵🇷', name: 'Puerto Rico' },
  colombia: { flag: '🇨🇴', name: 'Colombia' },
  venezuela: { flag: '🇻🇪', name: 'Venezuela' },
  ecuador: { flag: '🇪🇨', name: 'Ecuador' },
  peru: { flag: '🇵🇪', name: 'Perú' },
  bolivia: { flag: '🇧🇴', name: 'Bolivia' },
  paraguay: { flag: '🇵🇾', name: 'Paraguay' },
  brasil: { flag: '🇧🇷', name: 'Brasil', hl: 'pt-BR' },
  chile: { flag: '🇨🇱', name: 'Chile' },
  uruguay: { flag: '🇺🇾', name: 'Uruguay' },
  argentina: { flag: '🇦🇷', name: 'Argentina' }
};

/* ================== UTILIDADES ================== */

function rssBusqueda(query, hl = 'es-419') {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}`;
}

function filtrar24h(items = []) {
  const ahora = Date.now();
  return items.filter(i => {
    const fecha = new Date(i.pubDate || i.isoDate || 0).getTime();
    return ahora - fecha < 24 * 60 * 60 * 1000;
  });
}

function obtenerIcono(titulo = '') {
  const t = titulo.toLowerCase();
  if (/(econom|precio|d[oó]lar|inflaci|banco|pobreza)/.test(t)) return '💰';
  if (/(polit|gobiern|presidente|ley|congreso|votos)/.test(t)) return '🏛️';
  if (/(crimen|muerte|ataque|incendio|polic|asesin)/.test(t)) return '🚨';
  if (/(futbol|deporte|gol|mundial|liga|messi|james)/.test(t)) return '⚽';
  return '📰';
}

/* ================== COMANDO ================== */

module.exports = {
  name: 'noticias',
  async execute(sock, m, args) {
    const from = m.key.remoteJid;
    const search = (args[0] || '').toLowerCase();

    if (!search) {
      return sock.sendMessage(from, {
        text: '💡 Uso: `!noticias latam | argentina | mundo`'
      }, { quoted: m });
    }

    const fecha = new Date().toLocaleDateString('es-CO');
    const hora = new Date().toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit'
    });

    try {
      /* ============ LATAM ============ */
      if (search === 'latam') {
        const paises = Object.keys(PAISES_LATAM);

        const promesas = paises.map(async p => {
          try {
            const cfg = PAISES_LATAM[p];
            const feed = await parser.parseURL(
              rssBusqueda(cfg.name, cfg.hl)
            );
            const recientes = filtrar24h(feed.items);
            if (recientes.length) {
              const n = recientes[0];
              return `${cfg.flag} ${obtenerIcono(n.title)} *${n.title.trim()}*`;
            }
          } catch {
            return null;
          }
        });

        const noticias = (await Promise.all(promesas)).filter(Boolean);

        return sock.sendMessage(from, {
          text:
`┏━━ 🌎 *NOTICIAS LATAM* ━━┓
┃ 📅 ${fecha} | 🕒 ${hora}
┗━━━━━━━━━━━━━━━━━━━━━━┛

${noticias.join('\n\n')}

⚡ *Husky-Bot*`
        }, { quoted: m });
      }

      /* ============ MUNDO ============ */
      if (search === 'mundo') {
        const feed = await parser.parseURL(
          'https://news.google.com/rss?hl=es-419'
        );

        const noticias = filtrar24h(feed.items)
          .slice(0, 6)
          .map(n => `🌍 ${obtenerIcono(n.title)} *${n.title.trim()}*`)
          .join('\n\n');

        return sock.sendMessage(from, {
          text:
`┏━━ 🌍 *NOTICIAS MUNDIALES* ━━┓
┃ 📅 ${fecha} | 🕒 ${hora}
┗━━━━━━━━━━━━━━━━━━━━━━┛

${noticias}

⚡ *Husky-Bot*`
        }, { quoted: m });
      }

      /* ============ PAÍS O BÚSQUEDA LIBRE ============ */
      const pais = PAISES_LATAM[search];

      const rss = pais
        ? rssBusqueda(pais.name, pais.hl)
        : rssBusqueda(search);

      const flag = pais ? pais.flag : '🌍';
      const titulo = pais ? pais.name.toUpperCase() : search.toUpperCase();

      const feed = await parser.parseURL(rss);

      const noticias = filtrar24h(feed.items)
        .slice(0, 6)
        .map(n => `${flag} ${obtenerIcono(n.title)} *${n.title.trim()}*`)
        .join('\n\n');

      return sock.sendMessage(from, {
        text:
`┏━━ ${flag} *NOTICIAS: ${titulo}* ━━┓
┃ 📅 ${fecha} | 🕒 ${hora}
┗━━━━━━━━━━━━━━━━━━━━━━┛

${noticias}

⚡ *Husky-Bot*`
      }, { quoted: m });

    } catch (e) {
      console.log('❌ Noticias error:', e.message);
      await sock.sendMessage(from, {
        text: '⚠️ Error técnico al obtener noticias.'
      }, { quoted: m });
    }
  }
};
