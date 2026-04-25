module.exports = {
    name: "grupoinfo",
    alias: ["groupinfo", "infogrupo", "gcinfo"],

    async execute(sock, m, args) {
        // Log para ver en la terminal que el comando se activó
        console.log("--- SE ACTIVÓ EL COMANDO GRUPOINFO ---");
        
        const from = m.key.remoteJid;

        // 1. Verificar que el comando se use en un grupo
        if (!from.endsWith("@g.us")) {
            return sock.sendMessage(from, { text: "❌ Este comando solo puede usarse en grupos." }, { quoted: m });
        }

        try {
            // 2. Obtener la información del grupo (Metadata)
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants || [];
            const admins = participants.filter(p => p.admin !== null);
            
            // 3. Definir el creador y preparar las menciones
            const owner = metadata.owner || from.split("-")[0] + "@s.whatsapp.net";
            const mentionIds = admins.map(a => a.id);
            if (owner && !mentionIds.includes(owner)) mentionIds.push(owner);

            // 4. Crear la lista visual de administradores
            const adminList = admins.map((v, i) => `${i + 1}. @${v.id.split("@")[0]}`).join("\n");

            // 5. Construir el cuerpo del mensaje
            const textoInfo = `
╭───★☆ INFO DEL GRUPO ☆★───╮
📛 *Nombre:* ${metadata.subject}
🆔 *ID:* ${metadata.id}
👥 *Miembros:* ${participants.length}

👑 *Creador:*
• @${owner.split("@")[0]}

🛡️ *Administradores:*
${adminList || "No se encontraron admins"}

📝 *Descripción:*
${metadata.desc?.toString() || "Sin descripción"}
╰────────────────────────╯
`.trim();

            // 6. Intentar obtener la foto del grupo
            let groupImage;
            try {
                groupImage = await sock.profilePictureUrl(from, "image");
            } catch (e) {
                groupImage = null; // Si no hay foto, el bot enviará solo texto
            }

            // 7. Enviar el mensaje (con foto o solo texto)
            if (groupImage) {
                await sock.sendMessage(from, {
                    image: { url: groupImage },
                    caption: textoInfo,
                    mentions: mentionIds
                }, { quoted: m });
            } else {
                await sock.sendMessage(from, { 
                    text: textoInfo, 
                    mentions: mentionIds 
                }, { quoted: m });
            }

            console.log("✅ Comando ejecutado con éxito.");

        } catch (error) {
            console.log("❌ Error en el comando grupoinfo:", error);
            await sock.sendMessage(from, { text: "Hubo un error al obtener la información del grupo." }, { quoted: m });
        }
    }
};

