const fs = require("fs");

/* ================= UTILIDADES ================= */

function getJid(participant) {
  if (typeof participant === "string") return participant;
  if (participant && participant.id) return participant.id;
  return null;
}

// Limpia LID / JID
function normalizeJid(jid) {
  if (!jid) return null;
  if (jid.includes(":")) jid = jid.split(":")[0];
  return jid.replace(/[^0-9]/g, "");
}

// Corrige prefijo falso "1" de WhatsApp
function fixWhatsAppPrefix(number) {
  if (number.startsWith("1") && number.length > 11) {
    const withoutOne = number.slice(1);

    const realPrefixes = [
      // Centroamérica
      "502","503","504","505","506","507",
      // Norteamérica y Caribe
      "52","53","54","55","56","57","58",
      // Sudamérica largos
      "591","593","595","598","599"
    ];

    for (const p of realPrefixes) {
      if (withoutOne.startsWith(p)) return withoutOne;
    }
  }
  return number;
}

// 🌎 TODA AMÉRICA
function getCountryInfo(number) {
  const countries = {
    // Norteamérica
    "1": { name: "USA/Canadá", flag: "🇺🇸" },
    "52": { name: "México", flag: "🇲🇽" },

    // Centroamérica
    "502": { name: "Guatemala", flag: "🇬🇹" },
    "503": { name: "El Salvador", flag: "🇸🇻" },
    "504": { name: "Honduras", flag: "🇭🇳" },
    "505": { name: "Nicaragua", flag: "🇳🇮" },
    "506": { name: "Costa Rica", flag: "🇨🇷" },
    "507": { name: "Panamá", flag: "🇵🇦" },

    // Caribe
    "53": { name: "Cuba", flag: "🇨🇺" },
    "54": { name: "Argentina", flag: "🇦🇷" },
    "55": { name: "Brasil", flag: "🇧🇷" },
    "56": { name: "Chile", flag: "🇨🇱" },
    "57": { name: "Colombia", flag: "🇨🇴" },
    "58": { name: "Venezuela", flag: "🇻🇪" },
    "590": { name: "Guadalupe", flag: "🇬🇵" },
    "591": { name: "Bolivia", flag: "🇧🇴" },
    "592": { name: "Guyana", flag: "🇬🇾" },
    "593": { name: "Ecuador", flag: "🇪🇨" },
    "594": { name: "Guayana Francesa", flag: "🇬🇫" },
    "595": { name: "Paraguay", flag: "🇵🇾" },
    "596": { name: "Martinica", flag: "🇲🇶" },
    "597": { name: "Surinam", flag: "🇸🇷" },
    "598": { name: "Uruguay", flag: "🇺🇾" },
    "599": { name: "Caribe Neerlandés", flag: "🇨🇼" },

    // Caribe NANP
    "1809": { name: "Rep. Dominicana", flag: "🇩🇴" },
    "1829": { name: "Rep. Dominicana", flag: "🇩🇴" },
    "1849": { name: "Rep. Dominicana", flag: "🇩🇴" },
    "1876": { name: "Jamaica", flag: "🇯🇲" },
    "1868": { name: "Trinidad y Tobago", flag: "🇹🇹" },
    "1784": { name: "San Vicente y las Granadinas", flag: "🇻🇨" },
    "1758": { name: "Santa Lucía", flag: "🇱🇨" },
    "1767": { name: "Dominica", flag: "🇩🇲" }
  };

  const codes = Object.keys(countries).sort((a, b) => b.length - a.length);
  for (const code of codes) {
    if (number.startsWith(code)) return countries[code];
  }

  return { name: "Desconocido", flag: "🌍" };
}

/* ================= MÓDULO ================= */

module.exports = {
  name: "welcome",
  description: "Bienvenida completa América (fix LID + prefijo + nombre)",

  async execute(sock, msg, args, from, db) {
    const status = args[0];
    if (!["1", "0"].includes(status)) {
      return sock.sendMessage(from, { text: "⚙️ Uso: !welcome 1 / !welcome 0" });
    }

    db.welcome = db.welcome || {};
    db.welcome[from] = status === "1";
    fs.writeFileSync("./db.json", JSON.stringify(db, null, 2));

    await sock.sendMessage(from, {
      text: status === "1" ? "✅ Bienvenidas activadas" : "❌ Bienvenidas desactivadas"
    });
  },

  async onParticipantAdd(sock, groupMetadata, participant, db, action) {
    const from = groupMetadata.id;
    if (!db.welcome?.[from]) return;
    if (action && !["add", "join"].includes(action)) return;

    const rawJid = getJid(participant);
    if (!rawJid) return;

    global.lastWelcome = global.lastWelcome || {};
    if (global.lastWelcome[rawJid] && Date.now() - global.lastWelcome[rawJid] < 2500) return;
    global.lastWelcome[rawJid] = Date.now();

    let number = normalizeJid(rawJid);
    number = fixWhatsAppPrefix(number);
    if (!number) return;

    // Nombre real posible
    let userName =
      participant?.notify ||
      participant?.pushName ||
      "Nuevo Miembro";

    const country = getCountryInfo(number);
    const countryText = `${country.flag} ${country.name}`;

    const frases = [
      "¡Llegó la alegría al grupo! 🥳",
      "Uno más para la familia 🤝",
      "¡Bienvenido/a al team! 💪",
      "Que empiecen los memes 👀"
    ];
    const frase = frases[Math.floor(Math.random() * frases.length)];

    let imageUsed;
    try {
      imageUsed = await sock.profilePictureUrl(number + "@s.whatsapp.net", "image");
    } catch {
      imageUsed = "https://singlecolorimage.com/get/1E90FF/400x400";
    }

    const welcomeCard =
      `https://api.delirius.store/canvas/welcard` +
      `?name=${encodeURIComponent(userName)}` +
      `&author=${encodeURIComponent(countryText)}` +
      `&server=${encodeURIComponent("BIENVENIDO/A")}` +
      `&image=${encodeURIComponent(imageUsed)}`;

    const caption =
`╭───🎉 *BIENVENIDO/A* 🎉───╮
│ 👤 @${number}
│ 🌎 ${countryText}
│ 💬 ${frase}
╰────────────────────╯`;

    await sock.sendMessage(from, {
      image: { url: welcomeCard },
      caption,
      mentions: [`${number}@s.whatsapp.net`]
    });
  }
};
