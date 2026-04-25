module.exports = {
  name: "codigo",
  alias: ["code"],
  desc: "Envía código con formato resaltado en WhatsApp",
  async execute(sock, msg, args, from) {
    try {
      if (!args || args.length === 0) {
        await sock.sendMessage(from, {
          text: "❌ Formato:\n!codigo JavaScript: tu código aquí"
        }, { quoted: msg });
        return;
      }

      const input = args.join(" ");
      const match = input.match(/^(\w+):\s*([\s\S]+)$/i);

      if (!match) {
        await sock.sendMessage(from, {
          text: "❌ Ejemplo:\n!codigo JavaScript: const x = 1"
        }, { quoted: msg });
        return;
      }

      const lenguaje = match[1].toLowerCase();
      const codigo = match[2].trim();

      // ✅ Enviar como documento de código nativo de WhatsApp
      await sock.sendMessage(from, {
        text: "```" + lenguaje + "\n" + codigo + "\n```"
      });

    } catch (err) {
      console.error("❌ Error en !codigo:", err);
      await sock.sendMessage(from, {
        text: "⚠️ Error al enviar el código."
      }, { quoted: msg });
    }
  },
};
