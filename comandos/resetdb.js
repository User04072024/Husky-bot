module.exports = {
  name: "resetdb",
  description: "Reinicia completamente la base de datos (SOLO OWNER)",

  // Se añade 'sender' en la posición correcta para que coincida con bot.js
  async execute(sock, msg, args, from, sender, db, saveDB) {
    try {
      // 👑 LISTA DE OWNERS AUTORIZADOS
      const owners = [
        "264317270257735@s.whatsapp.net", // Tu LID
        "573006252061@s.whatsapp.net",
        "6283191473712@s.whatsapp.net",
        "16134862205@s.whatsapp.net",
        "50259446745@s.whatsapp.net"
      ];

      // 😏 VALIDACIÓN DE PERMISOS
      // El parámetro 'sender' ya viene normalizado desde el bot.js
      if (!owners.includes(sender)) {
        const burlas = [
          "🤣 Ey campeón, este botón no es para ti.",
          "😏 Buen intento… pero solo el dueño manda aquí.",
          "🚫 Nivel insuficiente. Vuelve cuando seas OWNER.",
          "😂 Nice try bro, pero no tienes permisos.",
          "🫵 Tú no mandas aquí… todavía."
        ];

        const respuesta = burlas[Math.floor(Math.random() * burlas.length)];

        return sock.sendMessage(
          from,
          { text: respuesta },
          { quoted: msg }
        );
      }

      // 🗑️ BORRADO TOTAL DE LA BASE DE DATOS
      // Se limpian las propiedades existentes en el objeto db
      db.usuarios = {};
      db.nombres = {};
      db.xp = {};
      db.mensajes = {};

      // Guardar los cambios invocando la función recibida del bot.js
      if (typeof saveDB === 'function') {
        saveDB();
      } else {
        throw new Error("La función de guardado no se recibió correctamente.");
      }

      // ✅ CONFIRMACIÓN AL OWNER
      await sock.sendMessage(
        from,
        {
          text:
            "🗑️ *RESET TOTAL COMPLETADO*\n\n" +
            "✔ Usuarios eliminados\n" +
            "✔ Nombres eliminados\n" +
            "✔ XP eliminado\n" +
            "✔ Mensajes eliminados\n\n" +
            "👑 Acción ejecutada por el OWNER principal."
        },
        { quoted: msg }
      );

      console.log(`\x1b[32m[DB]\x1b[0m Base de datos reseteada por: ${sender}`);

    } catch (error) {
      console.error("❌ Error en resetdb:", error.message);
      await sock.sendMessage(
        from,
        { text: "⚠️ Error crítico al intentar resetear la base de datos." },
        { quoted: msg }
      );
    }
  }
};

