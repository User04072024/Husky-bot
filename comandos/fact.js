const axios = require('axios');

// Función para traducir usando Lingva Translate API pública
async function traducirATexto(texto) {
    try {
        const source = 'en';
        const target = 'es';
        const url = `https://lingva.ml/api/v1/${source}/${target}/${encodeURIComponent(texto)}`;
        const res = await axios.get(url);
        if (res.data && res.data.translation) {
            return res.data.translation;
        }
        return texto;
    } catch (err) {
        console.error('⚠️ Error en traducción con Lingva:', err.message);
        return texto;
    }
}

// Función para agregar emojis según palabras clave
function agregarEmojis(texto) {
    const keywords = {
        'dientes': ['🦷','😁'],
        'china': ['🇨🇳','🀄'],
        'invento': ['💡','🔧'],
        'computadora': ['💻','🖱️'],
        'ciencia': ['🔬','🧪'],
        'espacio': ['🚀','🌌'],
        'animales': ['🐶','🐱','🦁'],
        'agua': ['💧','🌊'],
        'comida': ['🍔','🍕','🍎'],
        'musica': ['🎵','🎸','🎹'],
        'deporte': ['⚽','🏀','🏓'],
        'arte': ['🎨','🖌️','🖼️'],
        'historia': ['🏛️','📜'],
        'dinero': ['💰','💵'],
        'libro': ['📚','📖'],
        'sol': ['☀️','🌞'],
        'luna': ['🌙','🌜']
    };

    let emojis = [];
    const lowerText = texto.toLowerCase();
    for (const key in keywords) {
        if (lowerText.includes(key)) {
            emojis = emojis.concat(keywords[key]);
        }
    }

    return emojis.length > 0 ? emojis.join(' ') : '✨';
}

module.exports = {
    name: "fact",
    alias: ["dato", "curiosidad"],
    desc: "Envía un dato curioso traducido al español con emojis contextuales",
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;

        try {
            // Obtener dato curioso en inglés
            const factRes = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
            const factText = factRes.data && factRes.data.text ? factRes.data.text : null;
            if (!factText) throw new Error("No se obtuvo el dato curioso.");

            // Traducir a español
            const factES = await traducirATexto(factText);

            // Agregar emojis contextuales
            const emojis = agregarEmojis(factES);

            // Crear mensaje con estilo
            const message = `📢 *Dato Curioso* ${emojis}\n\n${factES}`;

            await sock.sendMessage(from, { text: message }, { quoted: msg });

        } catch (err) {
            console.error("❌ Error en !fact:", err);
            await sock.sendMessage(from, {
                text: "⚠️ No se pudo obtener un dato curioso en este momento. Intenta de nuevo."
            }, { quoted: msg });
        }
    }
};
