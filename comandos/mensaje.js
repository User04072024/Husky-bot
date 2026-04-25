// comandos/mensaje.js

module.exports = {
  name: "mensaje",
  description: "Envía un mensaje fijo dos veces en el grupo",

  async execute(sock, msg, args, from, sender, db, saveDB) {
    const MENSAJE_FIJO = "📢 dejen el porno";
    const REPETICIONES = 50;
    const DELAY_MS = 400;

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    try {
      const isGroup = from.endsWith("@g.us");

      if (!isGroup) {
        await sock.sendMessage(from, { text: "❗ Este comando solo puede usarse en grupos." });
        return;
      }

      // 🔁 Enviar el mensaje REPETICIONES veces
      for (let i = 0; i < REPETICIONES; i++) {
        await sock.sendMessage(from, { text: MENSAJE_FIJO });
        if (i < REPETICIONES - 1) await sleep(DELAY_MS);
      }

    } catch (err) {
      console.error("Error en !mensaje:", err);
      await sock.sendMessage(from, { text: "⚠️ Ocurrió un error al enviar el mensaje." });
    }
  },
};
