const fetch = require("node-fetch");
const https = require("https");

const agent = new https.Agent({ rejectUnauthorized: false });

/* =========================
   🎨 ESTILOS AMPLIADOS
========================= */
const LOGOS = {
    "burning": 4, "pixel badge": 32, "keen": 758279718, "fire": 13,
    "white": 732438332, "sword": 2172004512, "easy": 791030843, "stranger": 2792545512,
    "sugar": 1783669883, "rage": 749791093, "super scripted": 732447945, "tesla": 4113131447,
    "bad acid": 732450628, "gold outline": 46, "outline": 25, "ozone": 4618063429,
    "apollo 11": 4113153856, "saint": 4516516448, "fun": 1009848424, "cupid": 622058564,
    "black gold": 4516496663, "chromium": 33, "gold trim": 732443655, "water": 830469381,
    "scavenge": 4110551533, "happy new year": 2222569522, "gunmetal": 852819205, "sushi": 830446526,
    "dark": 830474754, "chrome two": 8, "supernova": 2650967346, "animated glow": 26,
    "comic": 9, "galactica": 599808801, "achilles": 4623046021, "merry christmas": 2222568262,
    "troy": 4623632030, "groovy": 789574607, "itext": 37, "gold bevel": 4112424040,
    "particle": 39, "studio 54": 732453157, "purple girl": 4618043283, "iceberg": 783756759,
    "snowman": 615569527, "glowing steel": 15, "coffee cup": 4528246004, "house arryn": 783758829,
    "fantasy": 45, "dragon": 1408867449, "tough": 758282876, "skate": 780833150,
    "epic stone": 732440996, "blinkie": 819515844, "ice cube": 1779834160, "princess": 829964308,
    "neon": 18, "club": 832337804, "muddy": 615608693, "slab": 17,
    "molten core": 43, "frosty": 36, "love": 819721038, "invaders": 4618529410,
    "glitter": 28, "graffiti": 3527181643, "lava": 11, "lasers": 42, 
    "gold bar": 47, "robot": 35, "tribal": 3, "vampire": 2, 
    "alien glow": 1, "glossy": 14, "simple": 16, "royal": 40
};

const HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Referer': 'https://es.cooltext.com/',
    'Origin': 'https://es.cooltext.com'
};

const getJid = m => m.key?.remoteJid || m.chat;

function findLogo(q) {
    q = q?.toLowerCase().trim();
    if (LOGOS[q]) return { name: q, id: LOGOS[q] };
    const m = Object.entries(LOGOS).find(([k]) => k.includes(q));
    return m ? { name: m[0], id: m[1] } : null;
}

function menu() {
    let styles = Object.keys(LOGOS).sort();
    let rows = [];
    for (let i = 0; i < styles.length; i += 3) {
        rows.push(`🔹 ${styles[i] || ""} | ${styles[i+1] || ""} | ${styles[i+2] || ""}`);
    }
    return `🎨 *GENERADOR DE LOGOS*\n\n> *Imagen:* !logo [estilo] [texto]\n> *GIF:* !logo animado [estilo] [texto]\n\n✨ *ESTILOS DISPONIBLES:*\n${rows.join("\n")}`;
}

module.exports = {
    name: "logo",
    alias: ["cool"],
    async execute(sock, m, args) {
        const jid = getJid(m);
        try {
            if (!args[0]) return sock.sendMessage(jid, { text: menu() }, { quoted: m });

            let statusMsg = await sock.sendMessage(jid, { text: "> ⏳ Iniciando..." }, { quoted: m });
            const update = async (t) => await sock.sendMessage(jid, { text: `> ${t}`, edit: statusMsg.key });

            let isAnimated = args[0].toLowerCase() === "animado";
            if (isAnimated) args.shift();

            const style = args[0];
            const text = args.slice(1).join(" ");
            const logo = findLogo(style);

            if (!logo || !text) return update("❌ Estilo o texto inválido.");

            let buf;
            let fontSize = 150;

            if (isAnimated) {
                await update(`🎥 Generando GIF: *${logo.name}*`);
                const bodyGif = `LogoID=${logo.id}&Text=${encodeURIComponent(text)}&FontSize=${fontSize}&Boolean1=on&Integer1=15&Integer9=0&Integer13=on&Integer12=on&FileFormat=7&IsTransparent=true&BackgroundColor_color=%23FFFFFF`;

                const pc = await fetch('https://es.cooltext.com/PostChange', { method: 'POST', headers: HEADERS, body: bodyGif, agent });
                const pcData = await pc.json();

                if (pcData.renderLocation) {
                    await update("⚙️ Procesando frames...");
                    await new Promise(r => setTimeout(r, 4500)); 
                    
                    const dl = await fetch(pcData.renderLocation, { headers: { 'User-Agent': HEADERS['User-Agent'] }, agent });
                    buf = Buffer.from(await dl.arrayBuffer());
                }

                if (!buf || buf.length < 1000) {
                   const rn = await fetch('https://es.cooltext.com/Render', { method: 'POST', headers: HEADERS, body: `logoId=${pcData.newId}&composite=`, agent });
                   const rnData = await rn.json();
                   const matchId = rnData.redirectLocation?.match(/RenderID=(\d+)/);
                   if (matchId) {
                       const server = pcData.renderLocation?.match(/https:\/\/([a-z]\d+)\.cooltext\.com/)?.[1] || 'r72';
                       const dlUrl = `https://${server}.cooltext.com/d.php?renderid=${matchId[1]}&extension=gif`;
                       const dl2 = await fetch(dlUrl, { headers: { 'User-Agent': HEADERS['User-Agent'] }, agent });
                       buf = Buffer.from(await dl2.arrayBuffer());
                   }
                }

            } else {
                await update(`🖼️ Generando Imagen: *${logo.name}*`);
                const bodyImg = `LogoID=${logo.id}&Text=${encodeURIComponent(text)}&FontSize=${fontSize}&Integer5=0&Integer7=0&Integer8=0&Integer14_color=%23000000&Integer6=75&Integer9=0&Integer13=on&Integer12=on&FileFormat=6&BackgroundColor_color=%23FFFFFF`;

                const pc = await fetch('https://es.cooltext.com/PostChange', { method: 'POST', headers: HEADERS, body: bodyImg, agent });
                const pcData = await pc.json();

                await update("⚙️ Renderizando...");
                const rn = await fetch('https://es.cooltext.com/Render', { method: 'POST', headers: HEADERS, body: `logoId=${pcData.newId}&composite=`, agent });
                const rnData = await rn.json();
                const matchId = rnData.redirectLocation?.match(/RenderID=(\d+)/);

                const server = pcData.renderLocation?.match(/https:\/\/([a-z]\d+)\.cooltext\.com/)?.[1] || 'r72';
                const dlUrl = `https://${server}.cooltext.com/d.php?renderid=${matchId[1]}&extension=png`;

                await new Promise(r => setTimeout(r, 1800));
                const dl = await fetch(dlUrl, { headers: { 'User-Agent': HEADERS['User-Agent'] }, agent });
                buf = Buffer.from(await dl.arrayBuffer());
            }

            if (!buf || buf.length < 1200) return update("❌ El servidor tardó demasiado. Intenta de nuevo.");

            const caption = `✅ *Logo:* ${logo.name.toUpperCase()}\n🔥 *HuskyBot*`;

            if (isAnimated) {
                // ADAPTACIÓN: Forzar envío como video reproducible
                await sock.sendMessage(jid, { 
                    video: buf, 
                    mimetype: 'video/mp4', 
                    gifPlayback: true,
                    caption: caption,
                    gifAttribution: 1
                }, { quoted: m });
            } else {
                await sock.sendMessage(jid, { image: buf, caption: caption }, { quoted: m });
            }

        } catch (e) {
            console.error(e);
            sock.sendMessage(jid, { text: "❌ Error de conexión con el servidor." }, { quoted: m });
        }
    }
};

