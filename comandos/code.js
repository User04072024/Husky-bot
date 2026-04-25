// ── ~/whatsapp-bot-new/comandos/code.js ──────────────────────────────────────

const { proto, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const { randomUUID }                           = require('crypto');
const { buildCodeBlocksFromString,
        mapHighlightTypeToUnified }            = require('../lib/token');

const BOT_JIDS = [
  '15550199631@s.whatsapp.net',
  '15550199631@c.us',
  '867051314767696@bot',
  '0@bot',
];

function log(tag, ...args) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}][CODE:${tag}]`, ...args);
}
function logJSON(tag, obj) {
  try { log(tag, JSON.stringify(obj, null, 2)); }
  catch { log(tag, '(no serializable)'); }
}

function getBotJid(sock) {
  const raw =
    sock.user?.jid ||
    sock.user?.id  ||
    sock.authState?.creds?.me?.id ||
    null;
  if (!raw) { log('WARN', 'userJid no encontrado'); return undefined; }
  return raw.includes(':') ? raw.split(':')[0] + '@s.whatsapp.net' : raw;
}

// ─────────────────────────────────────────────────────────────────────────────
async function sendRichMessage(sock, jid, data = {}, quoted) {
  const userJid = getBotJid(sock);
  log('START', `jid=${jid} | userJid=${userJid} | lang=${data.code?.language}`);

  const submessages = [];
  const sections    = [];
  const sources     = [];

  // ── Texto ────────────────────────────────────────────────────────────────
  if (data.text) {
    submessages.push({ messageType: 2, messageText: data.text });
    sections.push({
      view_model: {
        primitive: { text: data.text, __typename: 'GenAIMarkdownTextUXPrimitive' },
        __typename: 'GenAISingleLayoutViewModel',
      },
    });
    log('TEXT', `OK`);
  }

  // ── Tabla ────────────────────────────────────────────────────────────────
  if (data.table) {
    const tableRows = [
      { items: data.table.headers, isHeading: true },
      ...data.table.rows.map(r => ({ items: r.map(String) })),
    ];
    submessages.push({
      messageType: 4,
      tableMetadata: { title: data.table.title || '', rows: tableRows },
    });
    sections.push({
      view_model: {
        primitive: { title: data.table.title || '', rows: tableRows, __typename: 'GenAITableUXPrimitive' },
        __typename: 'GenAISingleLayoutViewModel',
      },
    });
    log('TABLE', `OK rows=${tableRows.length}`);
  }

  // ── Código ───────────────────────────────────────────────────────────────
  if (data.code) {
    const rawBlocks = buildCodeBlocksFromString(data.code.code);

    // ✅ Proto usa: { codeContent, highlightType }  (nombres del schema .proto)
    const protoBlocks = rawBlocks.map(b => ({
      codeContent:   String(b.codeContent || ''),
      highlightType: b.highlightType ?? 0,
    }));

    // ✅ JSON (sections/unified) usa: { content, type }
    const jsonBlocks = rawBlocks.map(b => ({
      content: String(b.codeContent || ''),
      type:    mapHighlightTypeToUnified(b.highlightType),
    }));

    log('CODE', `tokens=${rawBlocks.length} lang=${data.code.language}`);
    logJSON('CODE:PROTO_BLOCKS', protoBlocks.slice(0, 5));
    logJSON('CODE:JSON_BLOCKS',  jsonBlocks.slice(0, 5));

    submessages.push({
      messageType: 5,
      codeMetadata: {
        codeLanguage: data.code.language,
        codeBlocks:   protoBlocks,   // ← proto field names
      },
    });

    sections.push({
      view_model: {
        primitive: {
          language:    data.code.language,
          code_blocks: jsonBlocks,   // ← json field names
          __typename:  'GenAICodeUXPrimitive',
        },
        __typename: 'GenAISingleLayoutViewModel',
      },
    });
    log('CODE', `OK`);
  }

  const unified     = { response_id: randomUUID(), sections };
  // ✅ unifiedResponse.data es bytes en el proto → Buffer, no string
  const unifiedBuf  = Buffer.from(JSON.stringify(unified));
  log('UNIFIED', `sections=${sections.length} | buf size=${unifiedBuf.length} bytes`);

  // ── Intentar con botForwardedMessage (proto B) ───────────────────────────
  for (const botJid of BOT_JIDS) {
    log('TRY', `botJid=${botJid}`);
    try {
      const content = proto.Message.create({
        messageContextInfo: {
          deviceListMetadata:        {},
          deviceListMetadataVersion: 2,
          botMetadata: {
            pluginMetadata:              {},
            richResponseSourcesMetadata: { sources },
          },
        },
        botForwardedMessage: {
          message: {
            richResponseMessage: {
              messageType: 1,
              submessages,
              unifiedResponse: { data: unifiedBuf },  // ← Buffer
              contextInfo: {
                forwardingScore:           1,
                isForwarded:               true,
                forwardedAiBotMessageInfo: { botJid },
                forwardOrigin:             4,
              },
            },
          },
        },
      });

      const msgId   = 'RICH_' + Date.now();
      const fullMsg = generateWAMessageFromContent(jid, content, {
        userJid,
        quoted,
        messageId: msgId,
      });

      log('RELAY', `msgId=${msgId} | msg keys=${Object.keys(fullMsg.message || {}).join(',')}`);
      logJSON('RELAY:SUBMESSAGES', fullMsg.message?.botForwardedMessage?.message?.richResponseMessage?.submessages);

      const result = await sock.relayMessage(jid, fullMsg.message, { messageId: msgId });
      log('OK', `✅ botJid=${botJid}`);
      return result;

    } catch (err) {
      log('FAIL', `❌ botJid=${botJid} | ${err.message}`);
      console.error(err.stack);
    }
  }

  throw new Error('[code] Todos los intentos fallaron');
}

// ─────────────────────────────────────────────────────────────────────────────
const HELP_TEXT =
  `⌬ *HUSKY – BOT · Code*\n▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n\n` +
  `✦ *Uso:* !code <lenguaje> <código>\n\n` +
  `📌 !code python print("Hola mundo")\n` +
  `📌 !code javascript const x = 42;`;

module.exports = {
  name:  'code',
  alias: ['richcode', 'codeblock'],
  desc:  'Envía código con formato Meta AI (Rich Message)',

  async execute(sock, msg, args, from) {
    log('CMD', `args=${JSON.stringify(args)} | from=${from}`);

    if (!args.length) {
      return sock.sendMessage(from, { text: HELP_TEXT }, { quoted: msg });
    }

    const language = args[0].toLowerCase();
    const code     = args.slice(1).join(' ').replace(/\\n/g, '\n').trim();
    log('CMD', `lang=${language} | code="${code}"`);

    if (!code) {
      return sock.sendMessage(from, {
        text: `📍 Escribe el código después del lenguaje.\n✦ Ejemplo: !code python print("Hola")`
      }, { quoted: msg });
    }

    try {
      await msg.react?.('⏳');
      await sendRichMessage(sock, from, {
        text: `Código en *${language}*`,
        code: { language, code },
      }, msg);
      await msg.react?.('✅');

    } catch (err) {
      log('CMD:ERROR', err.message);
      console.error(err.stack);
      await msg.react?.('❌');
      await sock.sendMessage(from, {
        text: `\`\`\`\n${code}\n\`\`\``
      }, { quoted: msg });
    }
  },
};

