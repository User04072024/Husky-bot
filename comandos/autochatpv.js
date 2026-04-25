const axios = require('axios');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../lib/memoria_autochatpv.json');
const statePath = path.join(__dirname, '../lib/state_autochatpv.json');

const HUSKY_API_URL = 'https://api.huskydev.space/ai/venice';

/*
  Puedes poner uno o varios destinos para los recados.
  Ejemplos:
  const OWNER_FORWARD_TARGETS = ['264317270257735@lid'];
  const OWNER_FORWARD_TARGETS = ['264317270257735@lid', '6283191473712'];
*/
const OWNER_FORWARD_TARGETS = [
  '264317270257735@lid'
];

const BOT_NAME = 'Husky';
const OWNER_REAL_NAME = 'Alfredo';
const BOT_TIMEZONE = 'America/Mexico_City';

const TTL_MS = 30 * 60 * 1000;
const MAX_HISTORY = 12;

const REACTIVATE_AFTER_OWNER_MS = 30 * 60 * 1000;
const MIN_BOT_REPLY_GAP_MS = 4000;

const DEBUG = true;
const processedMessages = new Set();

// IDs reales de mensajes enviados por el bot
const botSentMessageIds = new Map();
const BOT_SENT_TTL_MS = 2 * 60 * 1000;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function log(...args) {
  if (DEBUG) console.log('[AUTOCHATPV]', ...args);
}

function errorLog(...args) {
  console.log('[AUTOCHATPV][ERROR]', ...args);
}

function ensureFile(filePath, initialData = {}) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
    }
  } catch (e) {
    errorLog('ensureFile:', e.message);
  }
}

function readJSON(filePath, fallback = {}) {
  try {
    ensureFile(filePath, fallback);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    errorLog('readJSON:', e.message);
    return fallback;
  }
}

function writeJSON(filePath, data) {
  try {
    ensureFile(filePath, {});
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    errorLog('writeJSON:', e.message);
  }
}

function readDB() {
  return readJSON(dbPath, {});
}

function writeDB(db) {
  writeJSON(dbPath, db);
}

function readState() {
  return readJSON(statePath, {});
}

function writeState(state) {
  writeJSON(statePath, state);
}

function getChatState(state, from) {
  if (!state[from]) {
    state[from] = {
      active: true,
      lastOwnerReplyAt: 0,
      lastBotReplyAt: 0,
      lastActivationAt: 0
    };
  }
  return state[from];
}

function rememberMessage(id) {
  if (!id) return;
  processedMessages.add(id);

  if (processedMessages.size > 800) {
    const first = processedMessages.values().next().value;
    processedMessages.delete(first);
  }
}

function rememberBotSentMessage(messageId) {
  if (!messageId) return;

  botSentMessageIds.set(messageId, Date.now());
  log(`BOT-ID-GUARDADO -> ${messageId}`);

  const now = Date.now();
  for (const [id, ts] of botSentMessageIds.entries()) {
    if (now - ts > BOT_SENT_TTL_MS) {
      botSentMessageIds.delete(id);
    }
  }
}

function isBotSentMessage(messageId) {
  if (!messageId) {
    log('BOT-ID-CHECK -> sin-id');
    return false;
  }

  const ts = botSentMessageIds.get(messageId);

  if (!ts) {
    log(`BOT-ID-CHECK -> ${messageId} | encontrado=false`);
    return false;
  }

  if (Date.now() - ts > BOT_SENT_TTL_MS) {
    botSentMessageIds.delete(messageId);
    log(`BOT-ID-CHECK -> ${messageId} | expirado=true`);
    return false;
  }

  log(`BOT-ID-CHECK -> ${messageId} | encontrado=true`);
  return true;
}

function isPrivateChat(from) {
  if (typeof from !== 'string') return false;
  return from.endsWith('@s.whatsapp.net') || from.endsWith('@lid');
}

function fullJid(jid) {
  return String(jid || 'sin-jid');
}

function registrarMensajePropio(from) {
  const state = readState();
  const chatState = getChatState(state, from);

  chatState.active = false;
  chatState.lastOwnerReplyAt = Date.now();

  writeState(state);
  log(`OFF -> ${fullJid(from)}`);
  return true;
}

function resolveForwardJid(target) {
  const raw = String(target || '').trim();
  if (!raw) return null;

  if (raw.endsWith('@lid') || raw.endsWith('@s.whatsapp.net')) {
    return raw;
  }

  const onlyDigits = raw.replace(/\D/g, '');
  if (!onlyDigits) return null;

  return `${onlyDigits}@s.whatsapp.net`;
}

function resolveForwardJids(targets) {
  const list = Array.isArray(targets) ? targets : [targets];
  const out = [];

  for (const item of list) {
    const jid = resolveForwardJid(item);
    if (jid && !out.includes(jid)) out.push(jid);
  }

  return out;
}

const OWNER_FORWARD_JIDS = resolveForwardJids(OWNER_FORWARD_TARGETS);

async function forwardRecado(sock, text) {
  let sent = 0;
  let lastError = null;

  for (const jid of OWNER_FORWARD_JIDS) {
    try {
      const sentMsg = await sock.sendMessage(jid, { text });
      rememberBotSentMessage(sentMsg?.key?.id);
      sent++;
      log(`RECADO OK -> ${jid}`);
    } catch (e) {
      lastError = e;
      errorLog(`RECADO FAIL -> ${jid}`, e.message);
    }
  }

  if (sent === 0) {
    throw lastError || new Error('No se pudo enviar el recado a ningún destino');
  }

  return sent;
}

function extractTextFromMessage(msg) {
  try {
    return (
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      msg.message?.documentMessage?.caption ||
      msg.message?.buttonsResponseMessage?.selectedButtonId ||
      msg.message?.listResponseMessage?.title ||
      msg.message?.templateButtonReplyMessage?.selectedId ||
      msg.message?.interactiveResponseMessage?.body?.text ||
      ''
    );
  } catch {
    return '';
  }
}

function getQuotedText(msg) {
  try {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return '';

    return (
      quoted.conversation ||
      quoted.extendedTextMessage?.text ||
      quoted.imageMessage?.caption ||
      quoted.videoMessage?.caption ||
      quoted.documentMessage?.caption ||
      ''
    );
  } catch {
    return '';
  }
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const QUESTION_TERMS = [
  'que', 'qué',
  'para que', 'para qué',
  'porque', 'por que', 'por qué',
  'como', 'cómo',
  'cuando', 'cuándo',
  'donde', 'dónde',
  'cual', 'cuál',
  'cuales', 'cuáles',
  'quien', 'quién',
  'quienes', 'quiénes',
  'cuanto', 'cuánto',
  'cuanta', 'cuánta',
  'cuantos', 'cuántos',
  'cuantas', 'cuántas',
  'explica',
  'explicame', 'explícame',
  'responde',
  'respondeme', 'respóndeme',
  'define',
  'defineme', 'defíneme',
  'resumen',
  'resume',
  'resumeme', 'resúmeme',
  'detalla',
  'detallame', 'detállame',
  'investiga',
  'analiza',
  'aclara',
  'aclarame', 'aclárame',
  'dime',
  'dimelo', 'dímelo',
  'cuentame', 'cuéntame',
  'ensename', 'enséñame',
  'indica',
  'menciona',
  'lista',
  'enumera',
  'compara',
  'diferencia',
  'significa',
  'significado',
  'ejemplo',
  'ejemplos',
  'ayudame con', 'ayúdame con',
  'necesito saber',
  'quiero saber',
  'me explicas',
  'me puedes explicar',
  'me podrías explicar',
  'puedes explicar',
  'puedes decirme',
  'podrias decirme', 'podrías decirme',
  'sabes que es',
  'sabes que significa',
  'que es', 'qué es',
  'que significa', 'qué significa',
  'que hace', 'qué hace',
  'como funciona', 'cómo funciona',
  'como se usa', 'cómo se usa',
  'como hacer', 'cómo hacer',
  'que opinas', 'qué opinas',
  'cual es', 'cuál es',
  'cuales son', 'cuáles son',
  'donde queda', 'dónde queda',
  'cuando fue', 'cuándo fue',
  'por que pasa', 'por qué pasa',
  'para que sirve', 'para qué sirve'
];

function isQuestionLike(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;

  const normalized = normalizeText(raw);

  if (raw.includes('?') || raw.includes('¿') || /\?+/.test(raw) || /¿+/.test(raw)) {
    return true;
  }

  const startsLikeQuestion = [
    'que ', 'qué ',
    'como ', 'cómo ',
    'cuando ', 'cuándo ',
    'donde ', 'dónde ',
    'cual ', 'cuál ',
    'quien ', 'quién ',
    'cuanto ', 'cuánto ',
    'porque ', 'por que ', 'por qué ',
    'para que ', 'para qué ',
    'explica ', 'define ', 'resume ', 'analiza ',
    'investiga ', 'aclara ', 'dime ', 'cuentame ',
    'cuéntame ', 'responde ', 'compara '
  ].some(prefix => normalized.startsWith(normalizeText(prefix)));

  if (startsLikeQuestion) return true;

  const hasQuestionTerm = QUESTION_TERMS.some(term =>
    normalized.includes(normalizeText(term))
  );

  if (hasQuestionTerm) return true;

  const regexes = [
    /\bque es\b/,
    /\bque significa\b/,
    /\bpara que sirve\b/,
    /\bcomo funciona\b/,
    /\bcomo se usa\b/,
    /\bcual es\b/,
    /\bcuales son\b/,
    /\bme puedes explicar\b/,
    /\bquiero saber\b/,
    /\bnecesito saber\b/,
    /\bdime\b/,
    /\bexplica\b/,
    /\bdefine\b/,
    /\bresume\b/,
    /\binvestiga\b/,
    /\banaliza\b/,
    /\bcompara\b/
  ];

  return regexes.some(rgx => rgx.test(normalized));
}

function isTimeQuestion(text) {
  const t = normalizeText(text);

  const patterns = [
    /\bque hora es\b/,
    /\bqué hora es\b/,
    /\bhora exacta\b/,
    /\bdime la hora\b/,
    /\bme dices la hora\b/,
    /\bpuedes decirme la hora\b/,
    /\bcual es la hora\b/,
    /\bcuál es la hora\b/,
    /\bque horas son\b/,
    /\bqué horas son\b/
  ];

  return patterns.some(r => r.test(t));
}

function formatCurrentTime() {
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('es-MX', {
      timeZone: BOT_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return fmt.format(now);
  } catch {
    const now = new Date();
    return now.toLocaleTimeString('es-MX', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
}

function buildTimeReply() {
  return `Son las ${formatCurrentTime()} ⏰`;
}

function extractRecado(text) {
  const raw = String(text || '').trim();

  const patterns = [
    /^\s*recado\s*:\s*([\s\S]{1,2000})$/i,
    /^\s*recado\s+([\s\S]{1,2000})$/i,
    /^\s*mensaje\s+para\s+alfredo\s*:\s*([\s\S]{1,2000})$/i,
    /^\s*mensaje\s+para\s+alfredo\s+([\s\S]{1,2000})$/i,
    /^\s*para\s+alfredo\s*:\s*([\s\S]{1,2000})$/i,
    /^\s*para\s+alfredo\s+([\s\S]{1,2000})$/i,
    /^\s*encargo\s*:\s*([\s\S]{1,2000})$/i,
    /^\s*encargo\s+([\s\S]{1,2000})$/i
  ];

  for (const rgx of patterns) {
    const match = raw.match(rgx);
    if (match && match[1]) return match[1].trim();
  }

  return null;
}

function buildIntroMessage() {
  return [
    '👋 *Hola, un gusto tenerte por aquí*',
    '',
    `Hablas con *${BOT_NAME}, asistente IA de ${OWNER_REAL_NAME}* 🤖`,
    `${OWNER_REAL_NAME} no se encuentra en línea ahora mismo, pero mientras tanto puedo apoyarte por aquí ✨`,
    '',
    '📩 Si quieres dejarle un recado o mensaje, escribe:',
    '*RECADO: tu mensaje*',
    '',
    '💬 Puedo ayudarte con *dudas, preguntas, apoyo, consejo o información*.',
    '*Solo dime y con gusto te ayudo.* 😊'
  ].join('\n');
}

function isGreetingOnly(text) {
  const t = normalizeText(text);

  const greetings = [
    'hola',
    'holaa',
    'holaaa',
    'holi',
    'holis',
    'buenas',
    'buenos dias',
    'buen día',
    'buenas tardes',
    'buenas noches',
    'hey',
    'ey',
    'hi',
    'ola',
    'alo'
  ];

  return greetings.includes(t);
}

function buildFallbackReply(firstActivation = false, esPregunta = false) {
  if (esPregunta) {
    return 'Te ayudo 😊 No pude generar una respuesta completa ahora mismo, pero si me envías la pregunta otra vez o con más detalle, intento responderla mejor.';
  }

  if (firstActivation) {
    return buildIntroMessage();
  }

  return 'Claro 😊 te ayudo por aquí.';
}

function trimEndingPhrases(text) {
  return String(text || '')
    .replace(/\s*si necesitas algo m[aá]s[, ]+solo dime y te ayudo por aqu[ií]\s*😊?\.?$/i, '')
    .replace(/\s*si necesitas algo m[aá]s[, ]+solo dime\.?$/i, '')
    .replace(/\s*si necesitas algo[, ]+solo dime\.?$/i, '')
    .replace(/\s*estoy aqu[ií] para ayudarte en lo que necesites\.?$/i, '')
    .trim();
}

function cleanText(text) {
  let out = String(text || '')
    .replace(/Husky:|Assistant:|Usuario:|User:/gi, '')
    .replace(/##\s?(.*)/g, '*$1*')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  out = out
    .replace(/^(?:¡?hola+[^.!?\n]*[.!?]\s*)+/i, '')
    .replace(/^(?:buenas|buenos dias|buen día|buenas tardes|buenas noches)[^.!?\n]*[.!?]?\s*/i, '')
    .replace(/^(?:soy husky[^.!?\n]*[.!?]\s*)+/i, '')
    .replace(/^(?:hablas con husky[^.!?\n]*[.!?]\s*)+/i, '')
    .trim();

  out = trimEndingPhrases(out);
  return out;
}

function extractAIResponse(data) {
  return (
    data?.response ||
    data?.message ||
    data?.answer ||
    data?.result ||
    data?.text ||
    data?.data?.response ||
    data?.data?.message ||
    data?.data?.answer ||
    data?.data?.result ||
    data?.data?.text ||
    (typeof data === 'string' ? data : null) ||
    null
  );
}

async function askHusky(nombre, historial, textoUsuario, firstActivation = false, esPregunta = false) {
  const prompt = `
Eres ${BOT_NAME}, una IA de apoyo que atiende mensajes privados por WhatsApp mientras ${OWNER_REAL_NAME} no está disponible.

CONTEXTO:
- Si acabas de reactivarte tras un tiempo sin hablar con el usuario, la aplicación ya agregará una breve presentación por su cuenta.
- Después de eso, responde directo y natural.
- Debes responder cada mensaje mientras sigas activo.
- Si el usuario quiere dejarle un recado a ${OWNER_REAL_NAME}, dile que escriba:
  RECADO: aquí va el mensaje

ESTILO GENERAL:
- Responde en español.
- Usa emojis libremente y con naturalidad 😊✨🤖📩
- Sé amable, cálido y útil.
- No suenes robótico.
- No repitas siempre la misma presentación.
- No repitas en cada mensaje que ${OWNER_REAL_NAME} no está disponible, salvo que encaje por contexto.
- No uses encabezados tipo ##.
- No cierres siempre ofreciendo más ayuda.

REGLAS MUY IMPORTANTES:
- ${firstActivation ? 'Este es el primer mensaje tras reactivarte. NO te presentes ni saludes de nuevo, porque la aplicación ya pondrá la introducción. Responde directo al contenido del usuario.' : 'YA ESTABAS ACTIVO. NO saludes, NO digas hola, NO te presentes otra vez. Responde directo al mensaje del usuario.'}
- ${esPregunta ? 'El usuario está haciendo una pregunta o pidiendo explicación. RESPONDE DIRECTO, con contenido útil y claro. Puedes extenderte más si hace falta. Primero da la respuesta.' : 'Si no es pregunta, mantén una respuesta breve, natural y conversacional.'}
- ${esPregunta ? 'Si preguntan algo como "qué es un perro", contesta directamente qué es un perro, sin rodeos.' : 'No conviertas saludos o mensajes casuales en explicaciones largas.'}
- ${esPregunta ? 'Cuando sea una pregunta, no te limites por pocas palabras. Prioriza responder bien.' : 'Cuando no sea pregunta, procura responder breve.'}
- PROHIBIDO empezar con frases como "Hola", "¡Hola!", "Soy Husky", "Hablas con Husky" o similares.
- PROHIBIDO terminar siempre con frases como "si necesitas algo más, solo dime". Úsalo solo a veces y no en todos los mensajes.
- Si el usuario se despide o da las gracias, responde breve y natural.

NOMBRE DEL USUARIO:
${nombre}

HISTORIAL:
${historial}

MENSAJE DEL USUARIO:
${textoUsuario}

RESPUESTA:
`.trim();

  const res = await axios.get(HUSKY_API_URL, {
    params: { message: prompt },
    timeout: 45000
  });

  return extractAIResponse(res.data);
}

const AutochatPV = {
  responder: async function (sock, msg, from, textoExtraido, botNumber, esPrivadoDirecto) {
    const msgId = msg?.key?.id || 'sin-id';
    const fromMe = !!msg?.key?.fromMe;
    const now = Date.now();
    const chatLabel = fullJid(from);

    try {
      if (processedMessages.has(msgId)) {
        return false;
      }
      rememberMessage(msgId);

      if (!isPrivateChat(from)) {
        return false;
      }

      const textoAlterno = extractTextFromMessage(msg);
      const texto = String(textoExtraido || textoAlterno || '').trim();

      let state = readState();
      let chatState = getChatState(state, from);

      if (fromMe) {
        const esEcoBot = isBotSentMessage(msgId);
        log(`CHECK-ID -> jid=${chatLabel} | id=${msgId} | fromMe=true | esEcoBot=${esEcoBot}`);

        if (esEcoBot) {
          log(`ECHO-ID -> ${chatLabel} | id=${msgId}`);
          return false;
        }

        log(`PROPIO-REAL -> ${chatLabel} | id=${msgId}`);
        registrarMensajePropio(from);
        return false;
      }

      if (!esPrivadoDirecto) {
        return false;
      }

      if (!texto) {
        return false;
      }

      if (texto.startsWith('!')) {
        return false;
      }

      let firstActivation = false;

      if (!chatState.active) {
        const elapsedSinceOwnerReply = now - (chatState.lastOwnerReplyAt || 0);

        if (!chatState.lastOwnerReplyAt || elapsedSinceOwnerReply >= REACTIVATE_AFTER_OWNER_MS) {
          chatState.active = true;
          chatState.lastActivationAt = now;
          writeState(state);
          firstActivation = true;
          log(`ON -> ${chatLabel}`);
        } else {
          return false;
        }
      }

      if (now - (chatState.lastBotReplyAt || 0) < MIN_BOT_REPLY_GAP_MS) {
        return false;
      }

      const nombre = msg?.pushName || 'Usuario';
      let db = readDB();

      if (!db[from]) db[from] = [];

      db[from] = db[from]
        .filter(item => Date.now() - item.time < TTL_MS)
        .slice(-MAX_HISTORY);

      const quoted = getQuotedText(msg);
      let textoParaIA = texto;

      if (quoted) {
        textoParaIA = `(Contexto citado: "${quoted}") -> Usuario: "${texto}"`;
      }

      const recado = extractRecado(texto);
      if (recado) {
        if (!OWNER_FORWARD_JIDS.length) {
          errorLog('Destino de recado inválido');
          return false;
        }

        const avisoOwner = [
          '📩 *Nuevo recado recibido por Husky*',
          '',
          `👤 *De:* ${nombre}`,
          `📱 *Chat:* ${fullJid(from)}`,
          '',
          '📝 *Mensaje:*',
          recado
        ].join('\n');

        await delay(600);
        const sentCount = await forwardRecado(sock, avisoOwner);

        const confirmacion = '✅ Listo 📩 Ya le pasé tu recado a Alfredo.';
        const sentMsg = await sock.sendMessage(from, { text: confirmacion }, { quoted: msg });
        rememberBotSentMessage(sentMsg?.key?.id);

        db[from].push({
          role: 'user',
          name: nombre,
          content: `[RECADO] ${recado}`,
          time: now
        });

        db[from].push({
          role: 'assistant',
          name: BOT_NAME,
          content: confirmacion,
          time: Date.now()
        });

        writeDB(db);

        chatState.lastBotReplyAt = Date.now();
        writeState(state);

        log(`RECADO -> ${chatLabel} => enviados:${sentCount}`);
        return true;
      }

      if (isTimeQuestion(texto)) {
        let respuestaHora = buildTimeReply();

        if (firstActivation) {
          respuestaHora = `${buildIntroMessage()}\n\n${respuestaHora}`;
        }

        await delay(500);
        const sentMsg = await sock.sendMessage(from, { text: respuestaHora }, { quoted: msg });
        rememberBotSentMessage(sentMsg?.key?.id);

        db[from].push({
          role: 'user',
          name: nombre,
          content: textoParaIA,
          time: now
        });

        db[from].push({
          role: 'assistant',
          name: BOT_NAME,
          content: respuestaHora,
          time: Date.now()
        });

        writeDB(db);

        chatState.lastBotReplyAt = Date.now();
        writeState(state);

        log(`HORA -> ${chatLabel}`);
        return true;
      }

      if (firstActivation && isGreetingOnly(texto)) {
        const intro = buildIntroMessage();

        await delay(500);
        const sentMsg = await sock.sendMessage(from, { text: intro }, { quoted: msg });
        rememberBotSentMessage(sentMsg?.key?.id);

        db[from].push({
          role: 'user',
          name: nombre,
          content: textoParaIA,
          time: now
        });

        db[from].push({
          role: 'assistant',
          name: BOT_NAME,
          content: intro,
          time: Date.now()
        });

        writeDB(db);

        chatState.lastBotReplyAt = Date.now();
        writeState(state);

        log(`INTRO -> ${chatLabel}`);
        return true;
      }

      db[from].push({
        role: 'user',
        name: nombre,
        content: textoParaIA,
        time: now
      });

      db[from] = db[from]
        .filter(item => Date.now() - item.time < TTL_MS)
        .slice(-MAX_HISTORY);

      writeDB(db);

      const historial = db[from]
        .map(item => `${item.role === 'user' ? item.name : BOT_NAME}: ${item.content}`)
        .join('\n');

      const esPregunta = isQuestionLike(texto);
      if (esPregunta) {
        log(`PREGUNTA -> ${chatLabel}`);
      }

      let respuestaIA = null;

      try {
        respuestaIA = await askHusky(nombre, historial, texto, firstActivation, esPregunta);
      } catch (e) {
        errorLog(`API -> ${chatLabel}`, e.message);
      }

      let cuerpo = cleanText(respuestaIA);

      if (!cuerpo) {
        cuerpo = buildFallbackReply(firstActivation, esPregunta);
      } else if (firstActivation) {
        cuerpo = `${buildIntroMessage()}\n\n${cuerpo}`;
      }

      await delay(800);
      const sentMsg = await sock.sendMessage(from, { text: cuerpo }, { quoted: msg });
      rememberBotSentMessage(sentMsg?.key?.id);

      db[from].push({
        role: 'assistant',
        name: BOT_NAME,
        content: cuerpo,
        time: Date.now()
      });

      writeDB(db);

      chatState.lastBotReplyAt = Date.now();
      writeState(state);

      log(`RESPONDIO${esPregunta ? ' [Q]' : ''} -> ${chatLabel}`);
      return true;
    } catch (error) {
      errorLog(`GENERAL -> ${chatLabel}`, error.message);

      try {
        const fallback = buildFallbackReply(false, false);
        const sentMsg = await sock.sendMessage(from, { text: fallback }, { quoted: msg });
        rememberBotSentMessage(sentMsg?.key?.id);
        log(`FALLBACK -> ${chatLabel}`);
        return true;
      } catch (e) {
        errorLog(`SIN FALLBACK -> ${chatLabel}`, e.message);
        return false;
      }
    }
  }
};

module.exports = AutochatPV;
