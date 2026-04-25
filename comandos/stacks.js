const { execSync } = require('child_process');
const os = require('os');
const axios = require('axios');

const HCTI_USER = '01KPW9FZ8BZ7F2G4HDA3HN4B5X';
const HCTI_KEY  = '019db897-fd0b-7d49-a023-214c74b4701f';

module.exports = {
  name: "stats",
  alias: ["status", "ram", "htop"],
  desc: "Panel de estado del bot",

  async execute(sock, msg, args, from) {
    try {
      await msg.react?.("⏳");

      // ── Datos ────────────────────────────────────
      const totalRam   = os.totalmem() / 1024 / 1024;
      const freeRam    = os.freemem()  / 1024 / 1024;
      const usedRam    = totalRam - freeRam;
      const ramPercent = Math.round((usedRam / totalRam) * 100);

      const botRam  = (process.memoryUsage().rss      / 1024 / 1024).toFixed(1);
      const botHeap = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

      let cpuModel = 'Android';
      let cpuCores = 1;
      try {
        const cpus = os.cpus();
        if (cpus?.length > 0) {
          cpuModel = cpus[0].model.trim();
          cpuCores = cpus.length;
        } else {
          cpuModel = execSync('cat /proc/cpuinfo | grep "Hardware" | head -1 | cut -d: -f2').toString().trim() || 'Android';
          cpuCores = parseInt(execSync('nproc').toString().trim()) || 1;
        }
      } catch (_) {}

      let cpuLoad = 0;
      try {
        cpuLoad = parseFloat(os.loadavg()[0].toFixed(2));
      } catch (_) {}

      let discoUsado = 0, discoTotal = 1, discoPct = 0;
      try {
        const df = execSync('df / 2>/dev/null | tail -1').toString().trim().split(/\s+/);
        discoUsado = (parseInt(df[2]) / 1024 / 1024).toFixed(1);
        discoTotal = (parseInt(df[1]) / 1024 / 1024).toFixed(1);
        discoPct   = Math.round((parseInt(df[2]) / parseInt(df[1])) * 100);
      } catch (_) {}

      const upBot = process.uptime();
      const uptimeStr = `${Math.floor(upBot/86400)}d ${Math.floor((upBot%86400)/3600)}h ${Math.floor((upBot%3600)/60)}m`;

      const upSys = os.uptime();
      const uptimeSysStr = `${Math.floor(upSys/86400)}d ${Math.floor((upSys%86400)/3600)}h ${Math.floor((upSys%3600)/60)}m`;

      const fecha = new Date().toLocaleString('es-AR');

      // ── Helper SVG círculo ────────────────────────
      function circleBar(percent, color, label, value) {
        const r = 54;
        const circ = 2 * Math.PI * r;
        const offset = circ - (percent / 100) * circ;
        return `
          <div class="circle-wrap">
            <svg viewBox="0 0 120 120" width="120" height="120">
              <circle cx="60" cy="60" r="${r}" fill="none" stroke="#1a1f2e" stroke-width="10"/>
              <circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="10"
                stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
                stroke-linecap="round"
                transform="rotate(-90 60 60)"/>
              <text x="60" y="55" text-anchor="middle" fill="white" font-size="18" font-weight="bold" font-family="monospace">${percent}%</text>
              <text x="60" y="74" text-anchor="middle" fill="${color}" font-size="9" font-family="monospace">${value}</text>
            </svg>
            <div style="text-align:center;color:${color};font-size:11px;letter-spacing:2px;margin-top:4px;font-family:monospace">${label}</div>
          </div>`;
      }

      // ── HTML ──────────────────────────────────────
      const html = `
      <div style="
        width:600px;
        background: linear-gradient(135deg, #0d1117 0%, #0a0e1a 100%);
        border-radius:16px;
        overflow:hidden;
        font-family: 'Courier New', monospace;
        border: 1px solid #21262d;
      ">

        <!-- Header -->
        <div style="
          background: linear-gradient(90deg, #00d4ff22, #7928ca22);
          border-bottom: 2px solid #00d4ff;
          padding: 16px 24px;
          display:flex;
          align-items:center;
          justify-content:space-between;
        ">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:10px;height:10px;border-radius:50%;background:#00d4ff;box-shadow:0 0 8px #00d4ff"></div>
            <span style="color:white;font-size:22px;font-weight:bold;letter-spacing:2px">⌬ HUSKY – BOT</span>
          </div>
          <span style="color:#00d4ff;font-size:13px;letter-spacing:3px">SYSTEM STATS</span>
        </div>

        <!-- Círculos -->
        <div style="
          display:flex;
          justify-content:space-around;
          align-items:center;
          padding:24px 16px 8px;
          background:#0d1117;
        ">
          ${circleBar(ramPercent, '#00d4ff', 'RAM', `${usedRam.toFixed(0)}MB`)}
          ${circleBar(discoPct, '#f78166', 'DISCO', `${discoUsado}GB`)}
          ${circleBar(Math.min(Math.round(cpuLoad * 10), 100), '#3fb950', 'CPU', `${cpuLoad}`)}
          ${circleBar(Math.min(Math.round((parseFloat(botRam) / totalRam) * 100), 100), '#d2a8ff', 'BOT', `${botRam}MB`)}
        </div>

        <!-- Separador -->
        <div style="height:1px;background:linear-gradient(90deg,transparent,#21262d,transparent);margin:8px 24px"></div>

        <!-- Info cards -->
        <div style="display:flex;gap:12px;padding:12px 16px">

          <!-- BOT -->
          <div style="
            flex:1;
            background:#161b22;
            border-radius:10px;
            border:1px solid #21262d;
            border-top:3px solid #d2a8ff;
            padding:12px;
          ">
            <div style="color:#d2a8ff;font-size:11px;letter-spacing:2px;margin-bottom:10px">[ BOT ]</div>
            <div style="color:#8b949e;font-size:11px;line-height:2">
              <span style="color:white">Uptime</span>&nbsp;&nbsp;${uptimeStr}<br>
              <span style="color:white">RAM</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${botRam} MB<br>
              <span style="color:white">Heap</span>&nbsp;&nbsp;&nbsp;&nbsp;${botHeap} MB<br>
              <span style="color:white">Node</span>&nbsp;&nbsp;&nbsp;&nbsp;${process.version}<br>
              <span style="color:white">Arch</span>&nbsp;&nbsp;&nbsp;&nbsp;${os.arch()}
            </div>
          </div>

          <!-- CPU -->
          <div style="
            flex:1;
            background:#161b22;
            border-radius:10px;
            border:1px solid #21262d;
            border-top:3px solid #3fb950;
            padding:12px;
          ">
            <div style="color:#3fb950;font-size:11px;letter-spacing:2px;margin-bottom:10px">[ CPU ]</div>
            <div style="color:#8b949e;font-size:11px;line-height:2">
              <span style="color:white">Modelo</span>&nbsp;${cpuModel.substring(0, 16)}<br>
              <span style="color:white">Cores</span>&nbsp;&nbsp;&nbsp;${cpuCores}<br>
              <span style="color:white">Carga</span>&nbsp;&nbsp;&nbsp;${cpuLoad}<br>
              <span style="color:white">OS Up</span>&nbsp;&nbsp;&nbsp;${uptimeSysStr}<br>
              <span style="color:white">OS</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${os.platform()}
            </div>
          </div>

          <!-- RAM -->
          <div style="
            flex:1;
            background:#161b22;
            border-radius:10px;
            border:1px solid #21262d;
            border-top:3px solid #00d4ff;
            padding:12px;
          ">
            <div style="color:#00d4ff;font-size:11px;letter-spacing:2px;margin-bottom:10px">[ RAM ]</div>
            <div style="color:#8b949e;font-size:11px;line-height:2">
              <span style="color:white">Total</span>&nbsp;&nbsp;&nbsp;${totalRam.toFixed(0)} MB<br>
              <span style="color:white">Usada</span>&nbsp;&nbsp;${usedRam.toFixed(0)} MB<br>
              <span style="color:white">Libre</span>&nbsp;&nbsp;&nbsp;${freeRam.toFixed(0)} MB<br>
              <span style="color:white">Disco</span>&nbsp;&nbsp;&nbsp;${discoUsado}/${discoTotal} GB<br>
              <span style="color:white">Uso</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${discoPct}%
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div style="
          background:#161b22;
          border-top:1px solid #21262d;
          padding:10px 24px;
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-top:4px;
        ">
          <span style="color:#3fb950;font-size:10px;letter-spacing:1px">● ONLINE</span>
          <span style="color:#8b949e;font-size:10px">HuskyDev · Alf</span>
          <span style="color:#8b949e;font-size:10px">${fecha}</span>
        </div>

      </div>`;

      // ── Llamar API hcti.io ────────────────────────
      const { data } = await axios.post(
        'https://hcti.io/v1/image',
        { html, google_fonts: "Share+Tech+Mono" },
        {
          auth: { username: HCTI_USER, password: HCTI_KEY },
          headers: { 'Content-Type': 'application/json' }
        }
      );

      await sock.sendMessage(from, {
        image: { url: data.url },
        caption: '⌬ *HUSKY – BOT · Stats*\n_HuskyDev · Alf_'
      }, { quoted: msg });

      await msg.react?.("✅");

    } catch (err) {
      console.error("❌ Error en !stats:", err);
      await msg.react?.("❌");
      await sock.sendMessage(from, { text: "⚠️ Error al generar el panel." }, { quoted: msg });
    }
  }
};
