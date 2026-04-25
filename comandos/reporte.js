const axios = require("axios");
const fs = require("fs");

const TOKEN_FILE = "./token.txt";

function generateToken() {
  return Math.random().toString(36).slice(2, 15);
}

function verifyToken(token) {
  if (!fs.existsSync(TOKEN_FILE)) return false;
  return fs.readFileSync(TOKEN_FILE, "utf8").trim() === token;
}

module.exports = {
  name: "token",
  alias: ["tk"],
  desc: "Generar token o reportar número",

  async execute(sock, msg, args, from) {
    try {
      if (!args[0]) {
        return sock.sendMessage(
          from,
          {
            text:
`❌ Usa:
!token generar
!token reporte numero token`
          },
          { quoted: msg }
        );
      }

      const sub = args[0].toLowerCase();

      // =====================
      // GENERAR TOKEN
      // =====================
      if (sub === "generar") {
        const token = generateToken();

        fs.writeFileSync(TOKEN_FILE, token);

        await sock.sendMessage(
          from,
          { text: `🔑 Tu token es:\n${token}` },
          { quoted: msg }
        );

        return sock.sendMessage(
          from,
          { text: "✅ Token generado." },
          { quoted: msg }
        );
      }

      // =====================
      // REPORTE
      // =====================
      if (sub === "reporte") {
        if (args.length < 3) {
          return sock.sendMessage(
            from,
            {
              text:
"❌ Uso:\n!token reporte numero token"
            },
            { quoted: msg }
          );
        }

        const number = args[1];
        const userToken = args[2];

        if (!verifyToken(userToken)) {
          return sock.sendMessage(
            from,
            { text: "❌ Token inválido." },
            { quoted: msg }
          );
        }

        await axios.post(
          "https://api.thirdparty.com/report",
          { number, token: userToken }
        );

        return sock.sendMessage(
          from,
          { text: "✅ Reporte enviado." },
          { quoted: msg }
        );
      }

      // =====================
      // SUBCOMANDO INVALIDO
      // =====================
      await sock.sendMessage(
        from,
        { text: "❌ Subcomando inválido." },
        { quoted: msg }
      );

    } catch (err) {
      console.error("ERROR:", err);

      await sock.sendMessage(
        from,
        { text: "⚠️ Ocurrió un error." },
        { quoted: msg }
      );
    }
  },
};
