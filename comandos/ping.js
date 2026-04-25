const os = require('os');
const process = require('process');
const fs = require('fs');

module.exports = {
  name: "ping",
  description: "Muestra información ultra completa del bot",
  async execute(sock, msg, args, from) {
    try {
      // --------- Ping simulado entre 1 y 30 ms ----------
      const ping = Math.floor(Math.random() * 30) + 1;

      // --------- Velocidad de Internet ≥50 Mbps ----------
      const minSpeed = 50;
      const maxSpeed = 150;
      const randomSpeed = Math.floor(Math.random() * (maxSpeed - minSpeed + 1)) + minSpeed;
      const speedText = `${randomSpeed} Mbps`;

      // --------- Memoria simulada ----------
      const memoriaTotalMB = 12 * 1024; // 12 GB en MB
      const memoriaUsedMB = Math.floor(Math.random() * (4500 - 3800 + 1)) + 3800; // 3.8–4.5 GB usados
      const memoriaBlocks = Math.max(0, Math.min(20, Math.round((memoriaUsedMB / memoriaTotalMB) * 20)));
      const memoriaBar = "█".repeat(memoriaBlocks) + "░".repeat(20 - memoriaBlocks);

      // --------- CPU ----------
      const cpus = os.cpus() || [];
      let totalLoad = 0;
      const cpuPercents = [];
      if (cpus.length > 0) {
        cpus.forEach(cpu => {
          const times = cpu.times;
          const busy = (times.user + times.nice + times.sys);
          const total = busy + times.idle;
          const load = total > 0 ? busy / total : 0;
          totalLoad += load;
          cpuPercents.push(Math.round(load * 100));
        });
        totalLoad = totalLoad / cpus.length;
      }
      const cpuBlocks = Math.max(0, Math.min(20, Math.round(totalLoad * 20)));
      const cpuBar = "█".repeat(cpuBlocks) + "░".repeat(20 - cpuBlocks);
      const cpuInfo = (cpus.length > 0) ? cpus[0].model : "N/D";

      // --------- Temperatura CPU simulada 38-100°C ----------
      const cpuTemp = (Math.floor(Math.random() * (100 - 38 + 1)) + 38) + "°C";

      // --------- Disco estático 256 GB con 84 GB usados (33%) ----------
      const diskTotalGB = 256;
      const diskUsedGB = 84;
      const usedPercent = Math.round((diskUsedGB / diskTotalGB) * 100);
      const diskPercent = usedPercent + "%";

      // --------- Uptime ----------
      const seconds = process.uptime();
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const uptimeBot = `${hours}h ${minutes}m ${secs}s`;

      // --------- Usuarios, chats y mensajes desde db.json ----------
      const dbPath = `${process.env.HOME}/whatsapp-bot-new/db.json`;
      let usersCount = 0;
      let chatsCount = 0;
      let totalMensajes = 0;

      try {
        if (fs.existsSync(dbPath)) {
          const dbRaw = fs.readFileSync(dbPath, 'utf-8');
          const dbData = JSON.parse(dbRaw);

          // Chats
          if (dbData.grupos) {
            chatsCount = Object.keys(dbData.grupos).length;
          }

          // Usuarios únicos y total de mensajes
          const userSet = new Set();
          if (dbData.grupos) {
            Object.values(dbData.grupos).forEach(grupo => {
              if (grupo.usuarios) {
                Object.values(grupo.usuarios).forEach(usuario => {
                  userSet.add(usuario.name || usuario.id);
                  if (usuario.mensajes) totalMensajes += usuario.mensajes;
                });
              }
            });
          }
          usersCount = userSet.size;
        }
      } catch (e) {
        console.warn("No se pudo leer db.json:", e && e.message ? e.message : e);
      }

      // --------- Fecha y hora ----------
      const now = new Date();
      const fechaHora = now.toLocaleString();

      // --------- CPU por núcleo ----------
      let cpuPerCoreText = "";
      if (cpuPercents.length > 0) {
        cpuPercents.forEach((p, i) => {
          cpuPerCoreText += `Core ${i + 1}: ${p}%\n`;
        });
      } else cpuPerCoreText = "N/D\n";

      // --------- IPs random ----------
      const randomIPv4 = () => Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join('.');
      const localIP = randomIPv4();
      const publicIP = randomIPv4();

      // --------- Número de comandos activos ----------
      let commandsCount = "N/D";
      try {
        if (global && global.commands && typeof global.commands === 'object') {
          commandsCount = Object.keys(global.commands).length;
        }
      } catch (e) { commandsCount = "N/D"; }

      // --------- Sistema operativo ----------
      let osInfo = `${os.type()} ${os.release()}`;
      try {
        if (fs.existsSync('/etc/os-release')) {
          const etc = fs.readFileSync('/etc/os-release', 'utf-8');
          const pretty = (etc.match(/^PRETTY_NAME="?([^"\n]+)"?/m) || [])[1];
          if (pretty) osInfo = pretty;
        }
      } catch {}

      // --------- Hostname fijo ----------
      const hostname = "Husky-Bot";

      // --------- Mensaje final ----------
      const infoText = `
⚡🐺 *𝐇𝐔𝐒𝐊𝐘-𝐁𝐎𝐓 PING* 🐺⚡

⏱️ Ping: ${ping} ms
🌐 Velocidad aproximada: ${speedText}
🕒 Uptime: ${uptimeBot}
📅 Fecha/Hora: ${fechaHora}
🌎 Proveedor: Husky-VPS | Ubicación: 🇨🇴 CO - LA GUA

💾 Memoria: [${memoriaBar}] ${memoriaUsedMB} / ${memoriaTotalMB} MB
🖥️ CPU: [${cpuBar}] ${Math.round(totalLoad * 100)}% (${cpuInfo})
${cpuPerCoreText}
🌡️ Temperatura CPU: ${cpuTemp}

💽 Disco: ${diskUsedGB} / ${diskTotalGB} GB (${diskPercent})
👥 Usuarios registrados: ${usersCount}
💬 Chats/Grupos: ${chatsCount}
✉️ Mensajes enviados: ${totalMensajes}

⚡ Comandos activos: ${commandsCount}

💻 Plataforma: ${osInfo} (${os.arch()})
🟢 Node.js: ${process.version}
🏷️ Hostname: ${hostname}
📡 IP Local: ${localIP} | IP Pública: ${publicIP}
`;

      await sock.sendMessage(from, { text: infoText }, { quoted: msg });

    } catch (error) {
      console.error("Error en comando ping:", error);
      await sock.sendMessage(from, { text: "❌ Error obteniendo información del bot." }, { quoted: msg });
    }
  }
};
