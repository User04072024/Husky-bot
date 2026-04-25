const axios = require("axios");

module.exports = {
  name: "copilot",
  alias: ["ai", "chat"],
  desc: "Chatea con IA usando diferentes modelos",

  async execute(sock, msg, args, from, sender, db, saveDB) {
    try {
      if (!args || args.length === 0) {
        await sock.sendMessage(
          from,
          { text: "❌ Ingresa un mensaje.\n\n📌 Ejemplo: !copilot hola cómo estás" },
          { quoted: msg }
        );
        return;
      }

      const message = args.join(" ");

      await sock.sendMessage(from, {
        image: { url: "https://i.postimg.cc/9fWf5k4W/file-00000000bb2c71f7b7340939641cad9f.png" },
        caption: `🤖 *Copilot AI*\n\nElige el modelo que quieres usar:\n\n💬 Tu mensaje: _${message}_`,
        title: "🤖 Copilot AI",
        subtitle: "Selecciona un modelo",
        footer: "⚡ Powered by HuskyDev",
        media: true,
        interactiveButtons: [
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🧠 GPT-5",
              id: `copilot_gpt-5_${message}`
            })
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🔍 Think Deeper",
              id: `copilot_think-deeper_${message}`
            })
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⚡ Default",
              id: `copilot_default_${message}`
            })
          }
        ]
      }, { quoted: msg });

      const buttonResponse = await waitForButtonReply(sock, from, msg.key.participant || from, 60000);

      if (!buttonResponse) {
        await sock.sendMessage(
          from,
          { text: "⏰ Tiempo agotado. Vuelve a usar !copilot." },
          { quoted: msg }
        );
        return;
      }

      const parts = buttonResponse.split("_");
      const model = parts[1];
      const userMessage = parts.slice(2).join("_");

      const modelLabels = {
        "gpt-5": "GPT-5 🧠",
        "think-deeper": "Think Deeper 🔍",
        "default": "Default ⚡"
      };

      await sock.sendMessage(
        from,
        { text: `⏳ Consultando con *${modelLabels[model]}*...` },
        { quoted: msg }
      );

      const url = `https://api.huskydev.space/ai/copilot?message=${encodeURIComponent(userMessage)}&model=${model}`;
      const { data } = await axios.get(url);

      if (!data?.status || !data?.result?.text) {
        throw new Error("Respuesta inválida de la API");
      }

      await sock.sendMessage(
        from,
        { text: `🤖 *Copilot AI* [${modelLabels[model]}]\n\n${data.result.text}` },
        { quoted: msg }
      );

    } catch (err) {
      console.error("❌ Error en !copilot:", err);
      await sock.sendMessage(
        from,
        { text: "⚠️ Ocurrió un error al conectar con la IA." },
        { quoted: msg }
      );
    }
  },
};

function waitForButtonReply(sock, from, senderJid, timeout = 60000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sock.ev.off("messages.upsert", handler);
      resolve(null);
    }, timeout);

    const handler = ({ messages }) => {
      for (const m of messages) {
        const isFromSender =
          (m.key.participant || m.key.remoteJid) === senderJid &&
          m.key.remoteJid === from &&
          !m.key.fromMe;

        if (!isFromSender) continue;

        let buttonId = null;

        const interactive = m.message?.interactiveResponseMessage;
        if (interactive) {
          try {
            const parsed = JSON.parse(interactive.nativeFlowResponseMessage?.paramsJson || "{}");
            if (parsed?.id) buttonId = parsed.id;
          } catch {}

          if (!buttonId && interactive.selectedButtonId) {
            buttonId = interactive.selectedButtonId;
          }

          if (!buttonId && interactive.nativeFlowResponseMessage?.name) {
            buttonId = interactive.nativeFlowResponseMessage.name;
          }
        }

        const buttons = m.message?.buttonsResponseMessage;
        if (!buttonId && buttons) {
          buttonId = buttons.selectedButtonId || buttons.selectedDisplayText;
        }

        const template = m.message?.templateButtonReplyMessage;
        if (!buttonId && template) {
          buttonId = template.selectedId || template.selectedDisplayText;
        }

        const text = m.message?.conversation || m.message?.extendedTextMessage?.text;
        if (!buttonId && text && text.startsWith("copilot_")) {
          buttonId = text.trim();
        }

        if (buttonId && buttonId.startsWith("copilot_")) {
          clearTimeout(timer);
          sock.ev.off("messages.upsert", handler);
          resolve(buttonId);
        }
      }
    };

    sock.ev.on("messages.upsert", handler);
  });
}
