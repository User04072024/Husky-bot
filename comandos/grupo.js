const path = require('path');
const fs = require('fs').promises;

// Delay para pausas entre mensajes de la simulación
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    name: 'grupo',
    description: 'Abre, cierra o simula borrar un grupo.',

    execute: async (sock, msg, args, from, sender) => {
        console.log(`\x1b[34m[GRUPO]\x1b[0m Ejecutando en: ${from}`);

        try {
            // 1. Validar que sea un grupo
            if (!from.endsWith('@g.us')) {
                return await sock.sendMessage(from, { text: '❌ Este comando solo funciona dentro de grupos.' });
            }

            // 2. Obtener metadatos y participantes
            const groupMetadata = await sock.groupMetadata(from);
            const participants = groupMetadata.participants;

            // 3. BUSCADOR DE IDENTIDAD TRIPLE (SENDER / JID / LID)
            // Extraemos el ID exacto que viene en el mensaje (es el más fiable)
            const exactSender = msg.key.participant || msg.participant || sender;
            const cleanNumber = sender.split('@')[0];

            const usuario = participants.find(p => 
                p.id === exactSender || 
                p.lid === exactSender ||
                p.id.split('@')[0] === cleanNumber ||
                (p.lid && p.lid.split('@')[0] === cleanNumber)
            );

            const esAdmin = usuario && (usuario.admin === 'admin' || usuario.admin === 'superadmin');

            // Log de depuración detallado para Termux
            console.log(`\x1b[33m[DEBUG]\x1b[0m ID Mensaje: ${exactSender} | Encontrado: ${usuario ? 'SÍ' : 'NO'} | Admin: ${esAdmin}`);

            if (!esAdmin) {
                return await sock.sendMessage(from, { 
                    text: '⚠️ No tienes permisos de administrador para gestionar este grupo.' 
                }, { quoted: msg });
            }

            // 4. Validar argumentos
            if (!args.length) {
                return await sock.sendMessage(from, {
                    text: `📘 *Panel de Control de Grupo*\n\n👉 !grupo abrir\n👉 !grupo cerrar\n👉 !grupo borrar`
                }, { quoted: msg });
            }

            const accion = args[0].toLowerCase();

            // 5. Cargar frases (Manejo de errores si los archivos no existen)
            const dbPath = path.resolve(__dirname, '../lib/grupo.json');
            let mensajesAbrir = ['🔓 El grupo ha sido abierto.'];
            let mensajesCerrar = ['🔒 El grupo ha sido cerrado.'];

            try {
                const dbData = await fs.readFile(dbPath, 'utf8');
                const frasesDB = JSON.parse(dbData);
                if (frasesDB.mensajesAbrir) mensajesAbrir = frasesDB.mensajesAbrir;
                if (frasesDB.mensajesCerrar) mensajesCerrar = frasesDB.mensajesCerrar;
            } catch (e) {
                console.log("\x1b[33m[WARN]\x1b[0m Usando frases por defecto.");
            }

            // === Lógica de Acciones ===

            if (accion === 'abrir') {
                await sock.groupSettingUpdate(from, 'not_announcement');
                const msj = mensajesAbrir[Math.floor(Math.random() * mensajesAbrir.length)];
                return await sock.sendMessage(from, { text: msj });
            }

            if (accion === 'cerrar') {
                await sock.groupSettingUpdate(from, 'announcement');
                const msj = mensajesCerrar[Math.floor(Math.random() * mensajesCerrar.length)];
                return await sock.sendMessage(from, { text: msj });
            }

            if (["borrar", "eliminar"].includes(accion)) {
                const frasesPath = path.resolve(__dirname, '../lib/frases_grupo_delete.json');
                let frasesBurlonas = ["¿En serio creíste que podía borrar el grupo? 😂"];
                
                try {
                    const raw = await fs.readFile(frasesPath, 'utf8');
                    frasesBurlonas = JSON.parse(raw).frases || frasesBurlonas;
                } catch (e) {}

                await sock.sendMessage(from, { text: "🗑️ *Iniciando eliminación del grupo…*" });
                await delay(1200);
                await sock.sendMessage(from, { text: "📡 Conectando con servidores de WhatsApp…" });
                await delay(1500);
                await sock.sendMessage(from, { text: "🛠️ Reescribiendo permisos administrativos…" });
                await delay(1800);

                const fraseFinal = frasesBurlonas[Math.floor(Math.random() * frasesBurlonas.length)];
                return await sock.sendMessage(from, { text: `❌ *Error fatal detectado.*\n${fraseFinal}` });
            }

            return await sock.sendMessage(from, { text: `🛑 Acción "${accion}" no válida.` });

        } catch (err) {
            console.error('\x1b[31m[ERROR]\x1b[0m', err.message);
            await sock.sendMessage(from, { text: '⚠️ Ocurrió un fallo técnico en el comando.' });
        }
    }
};

