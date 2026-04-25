const fs = require('fs');
const path = require('path');

const NEW_DB_PATH = path.join(__dirname, "data2.0.json");

const database = {
    load: () => {
        try {
            if (!fs.existsSync(NEW_DB_PATH)) {
                fs.writeFileSync(NEW_DB_PATH, JSON.stringify({ usuarios: [] }, null, 2));
            }
            return JSON.parse(fs.readFileSync(NEW_DB_PATH, 'utf-8'));
        } catch (e) {
            return { usuarios: [] };
        }
    },

    save: (data) => {
        try {
            fs.writeFileSync(NEW_DB_PATH, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error("❌ Error guardando data2.0:", e);
        }
    },

    getHandler: (jid, lid, pushName = "Usuario") => {
        let db2 = database.load();
        
        // Limpiamos los IDs para evitar formatos raros como "@lid@s.whatsapp.net"
        const cleanJid = jid ? jid.split('@')[0].split(':')[0] + "@s.whatsapp.net" : null;
        const cleanLid = lid ? lid.split('@')[0].split(':')[0] + "@lid" : null;
        const rawNumber = cleanJid ? cleanJid.split('@')[0] : (cleanLid ? cleanLid.split('@')[0] : 'desconocido');

        // Buscamos si el usuario ya existe comparando JID o LID
        let userIndex = db2.usuarios.findIndex(u => 
            (cleanJid && u.perfil_basico.id === cleanJid) || 
            (cleanLid && u.perfil_basico.lid === cleanLid)
        );

        if (userIndex === -1) {
            const newUser = {
                perfil_basico: {
                    id: cleanJid, // Aquí queda el 549... o similar
                    lid: cleanLid, // Aquí queda el 264... o similar
                    numero: rawNumber,
                    nombre_personalizado: pushName,
                    registro_fecha: Date.now()
                },
                info_whatsapp_real: { 
                    pushname: pushName, 
                    estado_bio: "Disponible", 
                    foto_url: null,
                    es_empresa: false
                },
                estadisticas_globales: {
                    mensajes_totales: 0, 
                    comandos_ejecutados: 0, 
                    imagenes: 0, 
                    videos: 0, 
                    stickers: 0, 
                    audios_y_notas_voz: 0
                },
                economia_rpg: { nivel: 1, xp: 0, saldo_mano: 0, saldo_banco: 0, diamantes: 0, oro: 0 },
                moderacion_y_seguridad: { es_admin: false, es_mod: false, es_premium: false, advertencias: 0, baneado: false }
            };
            db2.usuarios.push(newUser);
            database.save(db2);
            return { user: newUser, db2, index: db2.usuarios.length - 1 };
        }
        
        // Si el usuario existe pero no tenía LID o JID y ahora sí lo tenemos, actualizamos
        let updated = false;
        if (cleanLid && !db2.usuarios[userIndex].perfil_basico.lid) {
            db2.usuarios[userIndex].perfil_basico.lid = cleanLid;
            updated = true;
        }
        if (cleanJid && !db2.usuarios[userIndex].perfil_basico.id) {
            db2.usuarios[userIndex].perfil_basico.id = cleanJid;
            updated = true;
        }
        if (updated) database.save(db2);

        return { user: db2.usuarios[userIndex], db2, index: userIndex };
    }
};

module.exports = database;

