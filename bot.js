const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const fs = require("fs");
const path = require("path");
const P = require("pino");
const Autochat = require("./comandos/autochat");
let currentSock = null;
let isStarting = false;

// ═══════════════════════════════════════════
// 🎨 LOGGER FUTURISTA
// ═══════════════════════════════════════════
const C = {
    reset:  "\x1b[0m",
    bold:   "\x1b[1m",
    dim:    "\x1b[2m",
    cyan:   "\x1b[36m",
    green:  "\x1b[32m",
    yellow: "\x1b[33m",
    red:    "\x1b[31m",
    magenta:"\x1b[35m",
    blue:   "\x1b[34m",
    white:  "\x1b[37m",
    bgCyan: "\x1b[46m",
    bgRed:  "\x1b[41m",
    bgGreen:"\x1b[42m",
};

const tag = (color, label) => `${C.bold}${color}[${label}]${C.reset}`;

const log = {
    info:    (msg) => console.log(`${tag(C.cyan,    "INFO"   )} ${C.white}${msg}${C.reset}`),
    ok:      (msg) => console.log(`${tag(C.green,   "  OK  " )} ${C.green}${msg}${C.reset}`),
    warn:    (msg) => console.log(`${tag(C.yellow,  " WARN " )} ${C.yellow}${msg}${C.reset}`),
    error:   (msg) => console.log(`${tag(C.red,     "ERROR"  )} ${C.red}${msg}${C.reset}`),
    cmd:     (msg) => console.log(`${tag(C.magenta, " CMD  " )} ${C.magenta}${msg}${C.reset}`),
    msg:     (msg) => console.log(`${tag(C.blue,    " MSG  " )} ${C.white}${msg}${C.reset}`),
    lid:     (msg) => console.log(`${tag(C.cyan,    " LID  " )} ${C.cyan}${msg}${C.reset}`),
    admin:   (msg) => console.log(`${tag(C.green,   "ADMIN"  )} ${C.green}${msg}${C.reset}`),
    bot:     (msg) => console.log(`${tag(C.magenta, " BOT  " )} ${C.magenta}${msg}${C.reset}`),
    db:      (msg) => console.log(`${tag(C.blue,    "  DB  " )} ${C.blue}${msg}${C.reset}`),
    net:     (msg) => console.log(`${tag(C.yellow,  " NET  " )} ${C.yellow}${msg}${C.reset}`),
    div:     ()    => console.log(`${C.dim}${C.cyan}  ${"─".repeat(50)}${C.reset}`),
};

// ═══════════════════════════════════════════
// 🛡️ ERRORES GLOBALES
// ═══════════════════════════════════════════
process.on("unhandledRejection", (err) => {
    const msg = String(err);
    if (msg.includes("No sessions") || msg.includes("libsignal")) return;
    log.error(`Unhandled: ${msg.slice(0, 120)}`);
});

// ═══════════════════════════════════════════
// 📦 BASE DE DATOS
// ═══════════════════════════════════════════
const dbPath = "./data2.0.json";
let db = { usuarios: {}, grupos: {}, config: { leveling: true }, modoadmin: {}, lidmap: {} };

if (fs.existsSync(dbPath)) {
    try {
        db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
        if (!db.lidmap) db.lidmap = {};
        log.db(`DB cargada ✔ | Usuarios: ${Object.keys(db.usuarios).length} | LIDs: ${Object.keys(db.lidmap).length}`);
    } catch {
        log.warn("DB corrupta, reiniciando con valores base.");
    }
}

const saveDB = () => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
setInterval(saveDB, 30000);

// ═══════════════════════════════════════════
// 🔄 CONTROL DE REAPRENDIZAJE DE LIDs
// ═══════════════════════════════════════════
const lidScheduler = {
    interval:          null,
    startupTimer:      null,
    ultimoAprendizaje: 0,
    MIN_INTERVALO:     6 * 60 * 60 * 1000, // 6 horas
    corriendo:         false,

    async ejecutar(sock) {
        if (this.corriendo) {
            log.lid("⏭️ Reaprendizaje ya en curso, saltando...");
            return;
        }
        const ahora = Date.now();
        const tiempoDesdeUltimo = ahora - this.ultimoAprendizaje;
        if (this.ultimoAprendizaje > 0 && tiempoDesdeUltimo < this.MIN_INTERVALO) {
            const minRestantes = Math.ceil((this.MIN_INTERVALO - tiempoDesdeUltimo) / 60000);
            log.lid(`⏭️ Muy pronto, faltan ${minRestantes} min`);
            return;
        }

        this.corriendo = true;
        try {
            log.lid("🔄 Reaprendiendo LIDs...");
            const chats = await sock.groupFetchAllParticipating();
            const grupos = Object.entries(chats);
            let nuevos = 0;
            let actualizados = 0;

            for (const [groupId, group] of grupos) {
                for (const p of group.participants) {
                    if (p.jid && p.id?.endsWith("@lid")) {
                        const num = p.jid.split("@")[0];
                        if (!db.lidmap[num]) {
                            db.lidmap[num] = p.id;
                            nuevos++;
                        } else if (db.lidmap[num] !== p.id) {
                            db.lidmap[num] = p.id;
                            actualizados++;
                        }
                    }
                }
                // 2s entre grupos para no saturar
                await new Promise(r => setTimeout(r, 2000));
            }

            this.ultimoAprendizaje = Date.now();
            if (nuevos > 0 || actualizados > 0) {
                saveDB();
                log.lid(`✅ +${nuevos} nuevos | ${actualizados} actualizados | Total: ${Object.keys(db.lidmap).length}`);
            } else {
                log.lid(`✅ Todo al día | Total: ${Object.keys(db.lidmap).length}`);
            }
        } catch (e) {
            log.warn(`Error reaprendiendo LIDs: ${e.message}`);
        } finally {
            this.corriendo = false;
        }
    },

    iniciar(sock) {
        this.detener();
        // 1 minuto después de conectar en lugar de 8 segundos
        this.startupTimer = setTimeout(() => this.ejecutar(sock), 60000);
        this.interval = setInterval(() => {
            if (currentSock) this.ejecutar(currentSock);
        }, this.MIN_INTERVALO);
        log.lid("⏰ Scheduler de LIDs iniciado");
    },

    detener() {
        if (this.interval)     { clearInterval(this.interval);   this.interval     = null; }
        if (this.startupTimer) { clearTimeout(this.startupTimer); this.startupTimer = null; }
    }
};

// ═══════════════════════════════════════════
// 📂 CARGA DE COMANDOS
// ═══════════════════════════════════════════
const comandos = {};
const comandosPath = path.join(__dirname, "comandos");

if (fs.existsSync(comandosPath)) {
    fs.readdirSync(comandosPath).forEach(f => {
        if (f.endsWith(".js")) {
            try {
                const c = require(path.join(comandosPath, f));
                if (c.name) {
                    comandos[c.name] = c;
                    log.info(`Comando cargado → !${c.name}`);
                }
            } catch (e) {
                log.error(`Fallo al cargar ${f}: ${e.message}`);
            }
        }
    });
}
log.div();

// ═══════════════════════════════════════════
// 🚀 COLA ANTI-429 / ANTI-RATE-LIMIT
// ═══════════════════════════════════════════

// ── Configuración de límites ────────────────
const LIMITE = {
    envioDelay:    1500,  // ms entre cada envío
    consultaDelay: 2000,  // ms entre cada consulta
    maxEnvioPorMin: 20,   // máx mensajes por minuto
    maxConsultaPorMin: 10 // máx consultas por minuto
};

// ── Contador de peticiones ──────────────────
const contador = {
    envios:    { count: 0, resetAt: Date.now() + 60000 },
    consultas: { count: 0, resetAt: Date.now() + 60000 },

    puedeEnviar() {
        const ahora = Date.now();
        if (ahora > this.envios.resetAt) {
            this.envios = { count: 0, resetAt: ahora + 60000 };
        }
        return this.envios.count < LIMITE.maxEnvioPorMin;
    },

    puedeConsultar() {
        const ahora = Date.now();
        if (ahora > this.consultas.resetAt) {
            this.consultas = { count: 0, resetAt: ahora + 60000 };
        }
        return this.consultas.count < LIMITE.maxConsultaPorMin;
    },

    sumarEnvio()    { this.envios.count++;    },
    sumarConsulta() { this.consultas.count++; }
};

// ── Cola de ENVÍOS ──────────────────────────
const sendQueue = [];
let isProcessingQueue = false;

async function processQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (sendQueue.length > 0) {

        // Esperar si llegamos al límite por minuto
        if (!contador.puedeEnviar()) {
            const espera = contador.envios.resetAt - Date.now();
            log.net(`⏸️ Límite de envíos alcanzado → esperando ${Math.ceil(espera/1000)}s...`);
            await new Promise(r => setTimeout(r, espera + 500));
        }

        const task = sendQueue.shift();
        try {
            await task.sock.sendMessage(task.jid, task.content, task.opts);
            contador.sumarEnvio();
            // Delay fijo entre envíos
            await new Promise(r => setTimeout(r, LIMITE.envioDelay));
            task.resolve(true);
        } catch (e) {
            const errMsg = String(e);
            if (errMsg.includes("429") || errMsg.includes("rate-overlimit")) {
                log.net("🚨 Rate-limit de envío → pausando 30s...");
                sendQueue.unshift(task);
                await new Promise(r => setTimeout(r, 30000));
            } else if (errMsg.includes("Timed Out") || errMsg.includes("Connection Closed")) {
                log.warn("Conexión perdida, descartando mensaje");
                task.resolve(false);
            } else {
                log.error(`Error en cola: ${errMsg.slice(0, 80)}`);
                task.resolve(false);
            }
        }
    }

    isProcessingQueue = false;
}

function sendMessageSafe(sock, jid, content, opts = {}) {
    return new Promise((resolve) => {
        sendQueue.push({ sock, jid, content, opts, resolve });
        processQueue();
    });
}

// ── Cola de CONSULTAS ───────────────────────
const consultaQueue = [];
let consultaEnCurso = false;

async function processConsultaQueue() {
    if (consultaEnCurso) return;
    consultaEnCurso = true;

    while (consultaQueue.length > 0) {

        // Esperar si llegamos al límite de consultas por minuto
        if (!contador.puedeConsultar()) {
            const espera = contador.consultas.resetAt - Date.now();
            log.net(`⏸️ Límite de consultas alcanzado → esperando ${Math.ceil(espera/1000)}s...`);
            await new Promise(r => setTimeout(r, espera + 500));
        }

        const task = consultaQueue.shift();
        try {
            const result = await task.fn();
            contador.sumarConsulta();
            // Delay fijo entre consultas
            await new Promise(r => setTimeout(r, LIMITE.consultaDelay));
            task.resolve(result);
        } catch (e) {
            const errMsg = String(e);
            if (errMsg.includes("429") || errMsg.includes("rate-overlimit")) {
                log.net("🚨 Rate-limit de consulta → pausando 30s...");
                consultaQueue.unshift(task);
                await new Promise(r => setTimeout(r, 30000));
            } else {
                task.reject(e);
            }
        }
    }

    consultaEnCurso = false;
}

function safeQuery(fn) {
    return new Promise((resolve, reject) => {
        consultaQueue.push({ fn, resolve, reject });
        processConsultaQueue();
    });
}

// ═══════════════════════════════════════════
// 🗺️ CACHE DE METADATA
// ═══════════════════════════════════════════

const metadataCache = new Map();
const CACHE_TTL_MEM  = 5 * 60 * 1000;  // 5 min en memoria
const CACHE_TTL_DB   = 30 * 60 * 1000; // 30 min en JSON

async function getGroupMetadata(sock, groupId) {
    const ahora = Date.now();

    // 1. Revisar cache en memoria (más rápido)
    const cached = metadataCache.get(groupId);
    if (cached && ahora - cached.ts < CACHE_TTL_MEM) {
        return cached.data;
    }

    // 2. Revisar cache en JSON (sobrevive reinicios)
    if (!db.grupos) db.grupos = {};
    const cachedDB = db.grupos[groupId];
    if (cachedDB?.metadata && ahora - (cachedDB.metadata_ts || 0) < CACHE_TTL_DB) {
        // Cargar en memoria también
        metadataCache.set(groupId, { data: cachedDB.metadata, ts: cachedDB.metadata_ts });
        return cachedDB.metadata;
    }

    // 3. Solo si no hay cache válido consultar a WhatsApp
    try {
        log.info(`Consultando groupMetadata → ${groupId}`);
        const data = await sock.groupMetadata(groupId);

        // Guardar en memoria
        metadataCache.set(groupId, { data, ts: ahora });

        // Guardar en JSON
        if (!db.grupos[groupId]) db.grupos[groupId] = {};
        db.grupos[groupId].metadata    = data;
        db.grupos[groupId].metadata_ts = ahora;
        saveDB();

        return data;
    } catch (e) {
        log.warn(`groupMetadata falló para ${groupId}: ${e.message}`);
        // Retornar lo que haya aunque esté vencido antes de retornar null
        return cachedDB?.metadata || cached?.data || null;
    }
}

// ═══════════════════════════════════════════
// 🔑 HELPERS LID
// ═══════════════════════════════════════════
function esLid(id) {
    return id && id.endsWith("@lid");
}

function aprenderLidsDeParticipants(participants) {
    let nuevos = 0;
    for (const p of participants) {
        if (p.jid && p.lid) {
            const num = p.jid.split("@")[0];
            const lid = p.lid.endsWith("@lid") ? p.lid : p.lid + "@lid";
            if (!db.lidmap[num]) {
                db.lidmap[num] = lid;
                nuevos++;
            }
        }
    }
    return nuevos;
}
// ═══════════════════════════════════════════
// 🚀 START BOT
// ═══════════════════════════════════════════
async function startBot() {

    if (isStarting) {
        log.warn("Intento de inicio bloqueado (ya hay uno activo)");
        return;
    }

    isStarting = true;

    try {
        const { state, saveCreds } = await useMultiFileAuthState("auth_info");
        const { version } = await fetchLatestBaileysVersion();

        log.info(`Iniciando con Baileys v${version.join(".")}`);

        const sock = makeWASocket({
            version,
            auth: state,
            logger: P({ level: "silent" }),
            printQRInTerminal: true,
            browser: ["Husky-Bot", "Chrome", "20.0.0"],
            syncFullHistory: false,
            shouldSyncHistoryMessage: () => false,
            getMessage: async () => ({})
        });

        // 🔥 IMPORTANTE: guardar instancia actual
        currentSock = sock;

        sock.ev.on("creds.update", saveCreds);

    // 🗺️ Aprender LIDs desde contacts
    sock.ev.on("contacts.set", ({ contacts }) => {
        let nuevos = 0;
        for (const c of contacts) {
            if (c.id && c.lid) {
                const num = c.id.split("@")[0];
                const lid = c.lid.endsWith("@lid") ? c.lid : c.lid + "@lid";
                if (!db.lidmap[num]) { db.lidmap[num] = lid; nuevos++; }
            }
        }
        if (nuevos > 0) {
            saveDB();
            log.lid(`contacts.set → ${nuevos} LIDs nuevos | Total: ${Object.keys(db.lidmap).length}`);
        }
    });

    sock.ev.on("contacts.update", (updates) => {
        let nuevos = 0;
        for (const c of updates) {
            if (c.id && c.lid) {
                const num = c.id.split("@")[0];
                const lid = c.lid.endsWith("@lid") ? c.lid : c.lid + "@lid";
                if (!db.lidmap[num]) { db.lidmap[num] = lid; nuevos++; }
            }
        }
        if (nuevos > 0) {
            saveDB();
            log.lid(`contacts.update → ${nuevos} LIDs nuevos`);
        }
    });

    // ═══════════════════════════════════════
    // 📨 MENSAJES
    // ═══════════════════════════════════════
    sock.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.remoteJid === "status@broadcast") return;
            if (msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const pushName = msg.pushName || "Usuario";

            const participantRaw =
                msg.key.participant ||
                msg.message?.extendedTextMessage?.contextInfo?.participant ||
                msg.key.remoteJid;

            let realSender = participantRaw;
            let isAdmin = false;

            // ─── RESOLUCIÓN DE SENDER ───────────────
            if (from.endsWith("@g.us")) {
                const groupMetadata = await getGroupMetadata(sock, from);

                if (groupMetadata) {
                    const participants = groupMetadata.participants;
                    const todosLid = participants.every(p => esLid(p.id));

                    // Aprender LIDs desde campo jid de participants
                    const nuevos = aprenderLidsDeParticipants(participants);
                    if (nuevos > 0) {
                        saveDB();
                        log.lid(`Aprendidos ${nuevos} LIDs de participants`);
                    }

                    if (todosLid) {
                        const senderNum = participantRaw.split("@")[0];
                        let match = null;

                        // 1️⃣ Viene directo como LID
                        if (esLid(participantRaw)) {
                            match = participants.find(p => p.id === participantRaw);
                            if (match) log.lid(`Directo LID → ${match.id}`);
                        }

                        // 2️⃣ Buscar por campo jid en participants
                        if (!match) {
                            match = participants.find(p =>
                                p.jid && p.jid.split("@")[0] === senderNum
                            );
                            if (match) log.lid(`Via jid → ${senderNum} → ${match.id}`);
                        }

                        // 3️⃣ Buscar en lidmap guardado
                        if (!match && db.lidmap[senderNum]) {
                            match = participants.find(p => p.id === db.lidmap[senderNum]);
                            if (match) log.lid(`Via lidmap → ${senderNum} → ${match.id}`);
                        }

                        // 4️⃣ onWhatsApp último recurso
                        if (!match && !esLid(participantRaw)) {
                            try {
                                const result = await sock.onWhatsApp(senderNum + "@s.whatsapp.net");
                                if (result?.[0]?.lid) {
                                    const lid = result[0].lid.endsWith("@lid")
                                        ? result[0].lid : result[0].lid + "@lid";
                                    db.lidmap[senderNum] = lid;
                                    saveDB();
                                    match = participants.find(p => p.id === lid);
                                    if (match) log.lid(`Via onWhatsApp → ${senderNum} → ${lid}`);
                                }
                            } catch (_) {}
                        }

                        if (match) {
                            realSender = match.id;
                            isAdmin = match.admin === "admin" || match.admin === "superadmin";
                            if (!db.lidmap[senderNum] && match.jid) {
                                db.lidmap[senderNum] = match.id;
                                saveDB();
                            }
                        } else {
                            log.warn(`Sin LID para: ${participantRaw}`);
                            realSender = participantRaw;
                        }

                    } else {
                        const num = participantRaw.split("@")[0];
                        const match = participants.find(p =>
                            p.id.split("@")[0] === num || p.id === participantRaw
                        );
                        if (match) {
                            realSender = match.id;
                            isAdmin = match.admin === "admin" || match.admin === "superadmin";
                        }
                    }
                }
            }

            if (!realSender) realSender = participantRaw || msg.key.remoteJid;

            const senderNumber = realSender.split("@")[0];
            const botNumber = sock.user.id.split(":")[0];
            const owners = ["264317270257735", "573006252061"];
            const isOwner = owners.includes(senderNumber);

            let body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                msg.message.imageMessage?.caption ||
                msg.message.videoMessage?.caption ||
                "";

            // ─── LOG DE MENSAJE ──────────────────────
            log.div();
            log.msg(`${C.bold}${pushName}${C.reset}${C.white}: ${body.slice(0, 60)}`);
            log.info(`Sender → ${realSender} | Admin: ${isAdmin ? C.green+"✔"+C.reset : C.red+"✘"+C.reset} | Owner: ${isOwner ? C.green+"✔"+C.reset : C.red+"✘"+C.reset}`);


           // ─── DB USUARIO ──────────────────────────
if (!db.usuarios[realSender]) {
    db.usuarios[realSender] = {
        name: pushName,
        nivel: 1,
        xp: 0,
        dinero: 100,
        stats_globales: {
            mensajes:   0,
            fotos:      0,
            videos:     0,
            audios:     0,
            stickers:   0,
            documentos: 0,
            respuestas: 0
        },
        grupos: {},
        last_seen: new Date().toLocaleString()
    };
    log.db(`Nuevo usuario → ${realSender}`);
} else {
    // Migrar estructura vieja sin perder datos
    const u = db.usuarios[realSender];
    if (!u.stats_globales) {
        u.stats_globales = {
            mensajes:   u.stats?.mensajes   || 0,
            fotos:      u.stats?.fotos      || 0,
            videos:     u.stats?.videos     || 0,
            audios:     u.stats?.audios     || 0,
            stickers:   u.stats?.stickers   || 0,
            documentos: u.stats?.documentos || 0,
            respuestas: u.stats?.respuestas || 0
        };
        delete u.stats;
        delete u.admin_en_grupos;
        delete u.stats_por_grupo;
    }
    if (!u.grupos) u.grupos = {};
}

const user = db.usuarios[realSender];

// ─── ACTUALIZAR DATOS BÁSICOS ─────────────
user.name      = pushName;
user.xp        = (user.xp     || 0) + 10;
user.dinero    = (user.dinero || 0) + 5;

// ─── DETECTAR TIPO DE MENSAJE ─────────────
const esFoto      = !!msg.message.imageMessage;
const esVideo     = !!msg.message.videoMessage;
const esAudio     = !!(msg.message.audioMessage || msg.message.pttMessage);
const esSticker   = !!msg.message.stickerMessage;
const esDocumento = !!msg.message.documentMessage;
const esRespuesta = !!msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

// ─── STATS GLOBALES ───────────────────────
const sg = user.stats_globales;
sg.mensajes   = (sg.mensajes   || 0) + 1;
if (esFoto)      sg.fotos      = (sg.fotos      || 0) + 1;
if (esVideo)     sg.videos     = (sg.videos     || 0) + 1;
if (esAudio)     sg.audios     = (sg.audios     || 0) + 1;
if (esSticker)   sg.stickers   = (sg.stickers   || 0) + 1;
if (esDocumento) sg.documentos = (sg.documentos || 0) + 1;
if (esRespuesta) sg.respuestas = (sg.respuestas || 0) + 1;

// ─── STATS POR GRUPO ─────────────────────
if (from.endsWith("@g.us")) {
    if (!user.grupos[from]) {
        user.grupos[from] = {
            isAdmin: isAdmin,
            stats: {
                mensajes:   0,
                fotos:      0,
                videos:     0,
                audios:     0,
                stickers:   0,
                documentos: 0,
                respuestas: 0
            },
            last_seen: new Date().toLocaleString()
        };
    }

             const grupo = user.grupos[from];
                grupo.isAdmin   = isAdmin;
                grupo.last_seen = new Date().toLocaleString();
                user.last_seen  = new Date().toLocaleString();

             const gs = grupo.stats;
                gs.mensajes   = (gs.mensajes   || 0) + 1;
                if (esFoto)      gs.fotos      = (gs.fotos      || 0) + 1;
                if (esVideo)     gs.videos     = (gs.videos     || 0) + 1;
                if (esAudio)     gs.audios     = (gs.audios     || 0) + 1;
                if (esSticker)   gs.stickers   = (gs.stickers   || 0) + 1;
                if (esDocumento) gs.documentos = (gs.documentos || 0) + 1;
                if (esRespuesta) gs.respuestas = (gs.respuestas || 0) + 1;
               }

            // ─── EJECUTAR COMANDO ────────────────────
            const prefix = "!";
            if (body.startsWith(prefix)) {
                const args = body.trim().split(/ +/).slice(1);
                const commandName = body.trim().split(/ +/)[0].slice(1).toLowerCase();

                if (comandos[commandName]) {
                    log.cmd(`Ejecutando !${commandName} | Args: [${args.join(", ")}]`);

                   await comandos[commandName].execute(
                       sock, msg, args, from,
                       realSender, db, saveDB,
                       isOwner, sendMessageSafe, isAdmin,
                       getGroupMetadata
                     );

                } else {
                    log.warn(`Comando desconocido: !${commandName}`);
                }
            }


              // 🤖 AUTOCHAT
              if (
                 from.endsWith("@g.us") &&
                 !body.startsWith(prefix)
            ) {
              const esLlamadaDirecta = /\bhusky\b/i.test(body);

               await Autochat.responder(
                 sock,
                 msg,
                 from,
                 body,
                 botNumber,
                 esLlamadaDirecta
               );
             }
            if (from.endsWith("@g.us") && body.toLowerCase().includes("husky")) {
                await Autochat.responder(sock, msg, from, body, botNumber);
            }

        } catch (err) {
            const errStr = String(err);
            if (errStr.includes("rate-overlimit") || errStr.includes("429")) {
                log.net("Rate-overlimit global → pausando 8s...");
                await new Promise(r => setTimeout(r, 8000));
                return;
            }
            log.error(`ERROR GLOBAL: ${errStr.slice(0, 150)}`);
        }
    });


// ═══════════════════════════════════════
// 🔌 CONEXIÓN
// ═══════════════════════════════════════
sock.ev.on("connection.update", (u) => {
    const { connection, lastDisconnect } = u;

    if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode;
        const errMsg = String(lastDisconnect?.error || "");

        log.div();
        log.warn(`Desconectado → código: ${reason} | ${errMsg.slice(0, 60)}`);

        if (reason === DisconnectReason.loggedOut) {
            log.error("Sesión cerrada definitivamente (logout). Borra auth_info y reinicia.");
            return;
        }

  // 🔥 CERRAR SOCKET ANTES DE RECONEXIÓN
        if (currentSock) {
            try {
                currentSock.end();
            } catch {}
        }

        log.net("Reconectando en 5s...");
        setTimeout(() => startBot(), 5000);

    } else if (connection === "connecting") {
        log.net("Conectando a WhatsApp...");

    } else if (connection === "open") {
        log.div();
        log.ok(`╔══════════════════════════════════╗`);
        log.ok(`║   🐺 HUSKY BOT ONLINE (FIXED)   ║`);
        log.ok(`╚══════════════════════════════════╝`);
        log.bot(`Número : ${sock.user?.id}`);
        log.bot(`Nombre : ${sock.user?.name || "Husky"}`);
        log.db(`LIDs conocidos: ${Object.keys(db.lidmap).length}`);
        log.db(`Usuarios en DB: ${Object.keys(db.usuarios).length}`);
        log.div();

        // 🔄 Iniciar scheduler de LIDs (limpia el anterior si había)
        lidScheduler.iniciar(sock);
    }
}); // ← termina connection.update

// 🔴 CIERRE CORRECTO DE startBot
} catch (e) {
    log.error(`Error en startBot: ${e}`);
} finally {
    isStarting = false;
}
}

// 🚀 INICIAR BOT
startBot();
