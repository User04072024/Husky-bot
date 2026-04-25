const axios = require("axios");

module.exports = {
  name: "calc",
  alias: ["math", "symbolab", "pasos", "grafica"],
  desc: "Calculadora gráfica con pasos y gráficas 2D/3D",

  async execute(sock, msg, args, from, sender, db, saveDB, isOwner, sendMessageSafe, isAdmin, getGroupMetadata) {
    const query = args.join(" ").trim();

    if (!query) {
      return await sock.sendMessage(from, {
        text: `❌ Introduce una ecuación o función.\n\n📌 Ejemplos:\n` +
              `  !calc x^2 + 5x + 6 = 0\n` +
              `  !calc -3x + 14y = -113\n` +
              `  !calc sin(x) + cos(x)\n` +
              `  !calc puntos P(-5,4,3) Q(4,-6,0)\n` +
              `  !calc recta P(1,2,3) Q(4,5,6)`
      }, { quoted: msg });
    }

    await sock.sendMessage(from, {
      react: { text: "⏳", key: msg.key }
    });

    try {

      const q = query.toLowerCase();

      // ── DETECTAR TIPO DE PROBLEMA ──────────────────
      const esR3      = q.includes("p(") || q.includes("punto") || q.includes("recta") || q.includes("plano");
      const esDosVar  = /[+-]?\d*\.?\d*\s*[xy]\s*[+-]\s*\d*\.?\d*\s*[xy]\s*=/.test(query);
      const esLineal  = /^[+-]?\d*\.?\d*\s*x\s*([+-]\s*\d+\.?\d*)?\s*=\s*[+-]?\d+\.?\d*$/.test(query.replace(/\s/g,""));
      const esCuadr   = /x\^2/.test(query) && query.includes("=");
      const esFuncion = !query.includes("=") && query.includes("x");

      let texto = "";
      let graficaEnviada = false;

      // ── CASO 1: Problema en R³ ──────────────────────
      if (esR3) {
        const resultado = resolverR3(query);
        texto = resultado.texto;

        // Gráfica 3D via QuickChart con scatter3d
        if (resultado.puntos) {
          try {
            const { P, Q } = resultado.puntos;
            const t = [-2, -1, 0, 1, 2, 3, 4, 5];
            const d = resultado.direccion;

            const xs = t.map(ti => P[0] + ti * d[0]);
            const ys = t.map(ti => P[1] + ti * d[1]);
            const zs = t.map(ti => P[2] + ti * d[2]);

            const chartConfig = {
              type: "scatter",
              data: {
                datasets: [
                  {
                    label: `Recta r(t)`,
                    data: xs.map((x, i) => ({ x, y: ys[i] })),
                    borderColor: "#00ff88",
                    backgroundColor: "#00ff88",
                    pointRadius: 3,
                    showLine: true,
                    borderWidth: 2
                  },
                  {
                    label: `P(${P.join(",")})`,
                    data: [{ x: P[0], y: P[1] }],
                    backgroundColor: "#ff6b6b",
                    pointRadius: 8,
                    pointStyle: "circle"
                  },
                  {
                    label: `Q(${Q.join(",")})`,
                    data: [{ x: Q[0], y: Q[1] }],
                    backgroundColor: "#ffd700",
                    pointRadius: 8,
                    pointStyle: "circle"
                  }
                ]
              },
              options: {
                plugins: {
                  title: { display: true, text: "Proyección XY de la recta en R³", color: "#fff" },
                  legend: { labels: { color: "#fff" } }
                },
                scales: {
                  x: { grid: { color: "rgba(255,255,255,0.1)" }, ticks: { color: "#aaa" }, title: { display: true, text: "x", color: "#fff" } },
                  y: { grid: { color: "rgba(255,255,255,0.1)" }, ticks: { color: "#aaa" }, title: { display: true, text: "y", color: "#fff" } }
                }
              }
            };

            const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=700&height=500&backgroundColor=%230d0d1a`;
            await sock.sendMessage(from, {
              image: { url },
              caption: "📊 *Proyección XY de la recta en R³*\n🔴 Punto P  🟡 Punto Q  🟢 Recta"
            }, { quoted: msg });
            graficaEnviada = true;
          } catch (e) {
            console.log("Error gráfica R3:", e.message);
          }
        }

      // ── CASO 2: Ecuación con dos variables ax + by = c ──
      } else if (esDosVar) {
        const resultado = resolverDosVariables(query);
        texto = resultado.texto;

        try {
          // Despejar y en función de x para graficar
          const { a, b, c } = resultado.coefs;
          // ax + by = c → y = (c - ax) / b
          const puntosX = generarEjeX(-10, 10, 100);
          const puntosY = puntosX.map(x => b !== 0 ? (c - a * x) / b : null);

          const chartConfig = {
            type: "scatter",
            data: {
              datasets: [
                {
                  label: query,
                  data: puntosX.map((x, i) => ({ x, y: puntosY[i] })),
                  borderColor: "#00ff88",
                  backgroundColor: "rgba(0,255,136,0.05)",
                  pointRadius: 0,
                  showLine: true,
                  borderWidth: 2
                },
                // Intersecciones con ejes
                {
                  label: `Intersección X: (${(c/a).toFixed(2)}, 0)`,
                  data: b !== 0 ? [{ x: c/a, y: 0 }] : [],
                  backgroundColor: "#ff6b6b",
                  pointRadius: 7
                },
                {
                  label: `Intersección Y: (0, ${(c/b).toFixed(2)})`,
                  data: b !== 0 ? [{ x: 0, y: c/b }] : [],
                  backgroundColor: "#ffd700",
                  pointRadius: 7
                }
              ]
            },
            options: {
              plugins: {
                title: { display: true, text: query, color: "#fff" },
                legend: { labels: { color: "#fff" } }
              },
              scales: {
                x: {
                  type: "linear", position: "center",
                  min: -10, max: 10,
                  grid: { color: "rgba(255,255,255,0.15)" },
                  ticks: { color: "#aaa" },
                  title: { display: true, text: "x", color: "#fff" }
                },
                y: {
                  type: "linear", position: "center",
                  grid: { color: "rgba(255,255,255,0.15)" },
                  ticks: { color: "#aaa" },
                  title: { display: true, text: "y", color: "#fff" }
                }
              }
            }
          };

          const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=700&height=500&backgroundColor=%230d0d1a`;
          await sock.sendMessage(from, {
            image: { url },
            caption: `📈 *Gráfica:* ${query}`
          }, { quoted: msg });
          graficaEnviada = true;
        } catch (e) {
          console.log("Error gráfica 2var:", e.message);
        }

      // ── CASO 3: Ecuación cuadrática ──────────────────
      } else if (esCuadr) {
        const raices = resolverCuadratica(query);
        texto = construirTextoCuadratica(query, raices);

        try {
          const expr   = query.replace(/\s*=\s*0\s*$/, "").replace(/y\s*=/i, "").replace(/f\(x\)\s*=/i, "").trim();
          const ptX    = generarEjeX(-10, 10, 100);
          const ptY    = evaluarFuncion(expr, -10, 10, 100);
          const validY = ptY.filter(y => y !== null);
          const minY   = Math.max(-50, Math.min(...validY));
          const maxY   = Math.min(50,  Math.max(...validY));

          const datasets = [
            {
              label: `f(x) = ${expr}`,
              data: ptX.map((x, i) => ({ x, y: ptY[i] })),
              borderColor: "#00ff88",
              backgroundColor: "rgba(0,255,136,0.05)",
              borderWidth: 2, pointRadius: 0, showLine: true, tension: 0.1, fill: true
            },
            {
              label: "y = 0",
              data: ptX.map(x => ({ x, y: 0 })),
              borderColor: "rgba(255,255,255,0.2)",
              borderWidth: 1, pointRadius: 0, borderDash: [5, 5]
            }
          ];

          if (raices?.discriminante >= 0) {
            const pts = [{ x: raices.x1, y: 0 }];
            if (raices.x2 !== raices.x1) pts.push({ x: raices.x2, y: 0 });
            datasets.push({
              label: "Raíces",
              data: pts,
              backgroundColor: "#ff6b6b",
              pointRadius: 7,
              showLine: false
            });
          }

          const chartConfig = {
            type: "scatter",
            data: { datasets },
            options: {
              plugins: {
                title: { display: true, text: `f(x) = ${expr}`, color: "#fff" },
                legend: { labels: { color: "#fff" } }
              },
              scales: {
                x: { type: "linear", position: "center", min: -10, max: 10, grid: { color: "rgba(255,255,255,0.15)" }, ticks: { color: "#aaa" } },
                y: { type: "linear", position: "center", min: minY - 2, max: maxY + 2, grid: { color: "rgba(255,255,255,0.15)" }, ticks: { color: "#aaa" } }
              }
            }
          };

          const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=700&height=500&backgroundColor=%230d0d1a`;
          await sock.sendMessage(from, {
            image: { url },
            caption: `📈 *Gráfica:* f(x) = ${expr}${raices?.discriminante >= 0 ? "\n🔴 Raíces en rojo" : ""}`
          }, { quoted: msg });
          graficaEnviada = true;
        } catch (e) {
          console.log("Error gráfica cuadrática:", e.message);
        }

      // ── CASO 4: Función f(x) ─────────────────────────
      } else if (esFuncion || esLineal) {
        const expr  = query.replace(/y\s*=/i, "").replace(/f\(x\)\s*=/i, "").trim();
        const ptX   = generarEjeX(-10, 10, 100);
        const ptY   = evaluarFuncion(expr, -10, 10, 100);
        texto = `◈━━━━━━━━━━━━━━━━━━━━◈\n  ⬡ *𝗖𝗔𝗟𝗖𝗨𝗟𝗔𝗗𝗢𝗥𝗔* ⬡\n◈━━━━━━━━━━━━━━━━━━━━◈\n\n◌ ── 𝗘𝗡𝗧𝗥𝗔𝗗𝗔 ── ◌\n  📝 \`${query}\`\n\n◌ ── 𝗙𝗨𝗡𝗖𝗜𝗢́𝗡 ── ◌\n  📊 Función graficada en [-10, 10]\n\n◈━━━━━━━━━━━━━━━━━━━━◈`;

        try {
          const validY = ptY.filter(y => y !== null && isFinite(y));
          const minY   = Math.max(-20, Math.min(...validY));
          const maxY   = Math.min(20,  Math.max(...validY));

          const chartConfig = {
            type: "scatter",
            data: {
              datasets: [{
                label: `f(x) = ${expr}`,
                data: ptX.map((x, i) => ({ x, y: ptY[i] })),
                borderColor: "#00ff88",
                backgroundColor: "rgba(0,255,136,0.05)",
                borderWidth: 2, pointRadius: 0, showLine: true, tension: 0.1, fill: true
              },
              {
                label: "y = 0",
                data: ptX.map(x => ({ x, y: 0 })),
                borderColor: "rgba(255,255,255,0.2)",
                borderWidth: 1, pointRadius: 0
              }]
            },
            options: {
              plugins: {
                title: { display: true, text: `f(x) = ${expr}`, color: "#fff" },
                legend: { labels: { color: "#fff" } }
              },
              scales: {
                x: { type: "linear", position: "center", min: -10, max: 10, grid: { color: "rgba(255,255,255,0.15)" }, ticks: { color: "#aaa" } },
                y: { type: "linear", position: "center", min: minY - 1, max: maxY + 1, grid: { color: "rgba(255,255,255,0.15)" }, ticks: { color: "#aaa" } }
              }
            }
          };

          const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=700&height=500&backgroundColor=%230d0d1a`;
          await sock.sendMessage(from, {
            image: { url },
            caption: `📈 *Gráfica:* f(x) = ${expr}`
          }, { quoted: msg });
          graficaEnviada = true;
        } catch (e) {
          console.log("Error gráfica función:", e.message);
        }
      } else {
        texto = `◈━━━━━━━━━━━━━━━━━━━━◈\n  ⬡ *𝗖𝗔𝗟𝗖𝗨𝗟𝗔𝗗𝗢𝗥𝗔* ⬡\n◈━━━━━━━━━━━━━━━━━━━━◈\n\n◌ ── 𝗘𝗡𝗧𝗥𝗔𝗗𝗔 ── ◌\n  📝 \`${query}\`\n\n⚠️ Tipo de ecuación no reconocida.\n\n📌 Prueba con:\n  • x^2 + 5x + 6 = 0\n  • -3x + 14y = -113\n  • sin(x) + cos(x)\n  • recta P(-5,4,3) Q(4,-6,0)\n\n◈━━━━━━━━━━━━━━━━━━━━◈`;
      }

      await sock.sendMessage(from, { text: texto }, { quoted: msg });
      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

    } catch (err) {
      console.error("❌ Error en !calc:", err);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
      await sock.sendMessage(from, { text: "⚠️ Error al procesar la ecuación." }, { quoted: msg });
    }
  },
};

// ── RESOLVER R³ ─────────────────────────────────────
function resolverR3(query) {
  const pMatch = query.match(/P\s*\(\s*([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)\s*\)/i);
  const qMatch = query.match(/Q\s*\(\s*([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)\s*\)/i);

  if (!pMatch || !qMatch) {
    return { texto: "⚠️ Formato: *!calc recta P(x1,y1,z1) Q(x2,y2,z2)*" };
  }

  const P  = [parseFloat(pMatch[1]), parseFloat(pMatch[2]), parseFloat(pMatch[3])];
  const Q  = [parseFloat(qMatch[1]), parseFloat(qMatch[2]), parseFloat(qMatch[3])];
  const d  = [Q[0]-P[0], Q[1]-P[1], Q[2]-P[2]];

  const texto =
`◈━━━━━━━━━━━━━━━━━━━━◈
  ⬡ *𝗥𝗘𝗖𝗧𝗔 𝗘𝗡 𝗥³* ⬡
◈━━━━━━━━━━━━━━━━━━━━◈

◌ ── 𝗣𝗨𝗡𝗧𝗢𝗦 ── ◌
  🔴 *P* = (${P.join(", ")})
  🟡 *Q* = (${Q.join(", ")})

◌ ── 𝗩𝗘𝗖𝗧𝗢𝗥 𝗗𝗜𝗥𝗘𝗖𝗖𝗜𝗢́𝗡 ── ◌
  📐 *PQ* = Q - P = (${d.join(", ")})

◌ ── 𝗘𝗖𝗨𝗔𝗖𝗜𝗢́𝗡 𝗩𝗘𝗖𝗧𝗢𝗥𝗜𝗔𝗟 ── ◌
  *r(t) = P + t·d*
  (x,y,z) = (${P[0]},${P[1]},${P[2]}) + t(${d[0]},${d[1]},${d[2]})

◌ ── 𝗘𝗖𝗨𝗔𝗖𝗜𝗢𝗡𝗘𝗦 𝗣𝗔𝗥𝗔𝗠𝗘́𝗧𝗥𝗜𝗖𝗔𝗦 ── ◌
  x = ${P[0]} + ${d[0]}t
  y = ${P[1]} + ${d[1]}t
  z = ${P[2]} + ${d[2]}t

◌ ── 𝗘𝗖𝗨𝗔𝗖𝗜𝗢𝗡𝗘𝗦 𝗦𝗜𝗠𝗘́𝗧𝗥𝗜𝗖𝗔𝗦 ── ◌
  (x${P[0]>=0?"-":"+"}${Math.abs(P[0])})/${d[0]} = (y${P[1]>=0?"-":"+"}${Math.abs(P[1])})/${d[1]} = (z${P[2]>=0?"-":"+"}${Math.abs(P[2])})/${d[2]}

◈━━━━━━━━━━━━━━━━━━━━◈`;

  return { texto, puntos: { P, Q }, direccion: d };
}

// ── RESOLVER DOS VARIABLES ──────────────────────────
function resolverDosVariables(query) {
  const match = query.replace(/\s/g, "").match(/^([+-]?\d*\.?\d*)x([+-]\d*\.?\d*)y=([+-]?\d+\.?\d*)$/i);

  let a = 1, b = 1, c = 0;
  if (match) {
    a = parseFloat(match[1] || "1") || (match[1] === "-" ? -1 : 1);
    b = parseFloat(match[2]) || (match[2]?.startsWith("-") ? -1 : 1);
    c = parseFloat(match[3]) || 0;
  } else {
    // Intentar parsear manualmente
    const am = query.match(/([+-]?\d*\.?\d*)\s*x/i);
    const bm = query.match(/([+-]?\d*\.?\d*)\s*y/i);
    const cm = query.match(/=\s*([+-]?\d+\.?\d*)/);
    a = am ? (parseFloat(am[1]) || (am[1]?.trim() === "-" ? -1 : 1)) : 1;
    b = bm ? (parseFloat(bm[1]) || (bm[1]?.trim() === "-" ? -1 : 1)) : 1;
    c = cm ? parseFloat(cm[1]) : 0;
  }

  const intX = b !== 0 ? (c / a).toFixed(4) : "∞";
  const intY = b !== 0 ? (c / b).toFixed(4) : "∞";
  const pend = b !== 0 ? (-a / b).toFixed(4) : "∞";

  const texto =
`◈━━━━━━━━━━━━━━━━━━━━◈
  ⬡ *𝗖𝗔𝗟𝗖𝗨𝗟𝗔𝗗𝗢𝗥𝗔* ⬡
◈━━━━━━━━━━━━━━━━━━━━◈

◌ ── 𝗘𝗡𝗧𝗥𝗔𝗗𝗔 ── ◌
  📝 \`${query}\`

◌ ── 𝗣𝗔𝗦𝗢𝗦 ── ◌
  1️⃣ Forma: *${a}x + ${b}y = ${c}*
  2️⃣ Despejar y: *${b}y = ${c} - ${a}x*
  3️⃣ *y = ${(-a/b).toFixed(4)}x + ${(c/b).toFixed(4)}*

◌ ── 𝗥𝗘𝗦𝗨𝗟𝗧𝗔𝗗𝗢 ── ◌
  📊 *Pendiente:* m = ${pend}
  🔴 *Intersección X:* (${intX}, 0)
  🟡 *Intersección Y:* (0, ${intY})

◈━━━━━━━━━━━━━━━━━━━━◈`;

  return { texto, coefs: { a, b, c } };
}

// ── RESOLVER CUADRÁTICA ─────────────────────────────
function resolverCuadratica(query) {
  const expr = query.replace(/\s/g, "");
  const m = expr.match(/^([+-]?\d*\.?\d*)x\^2([+-]\d*\.?\d*x)?([+-]\d*\.?\d*)?=0$/i);
  if (!m) return null;

  let a = parseFloat(m[1] || "1") || (m[1] === "-" ? -1 : 1);
  let bm = m[2] ? m[2].match(/([+-]?\d*\.?\d*)x/i) : null;
  let b  = bm ? (parseFloat(bm[1]) || (bm[1] === "+" ? 1 : bm[1] === "-" ? -1 : 1)) : 0;
  let c  = m[3] ? parseFloat(m[3]) : 0;

  const disc = b*b - 4*a*c;
  if (disc < 0) return { tipo: "cuadratica", a, b, c, discriminante: disc };
  return {
    tipo: "cuadratica", a, b, c, discriminante: disc,
    x1: parseFloat(((-b + Math.sqrt(disc)) / (2*a)).toFixed(4)),
    x2: parseFloat(((-b - Math.sqrt(disc)) / (2*a)).toFixed(4))
  };
}

function construirTextoCuadratica(query, r) {
  if (!r) return `◈━━━━━━━━━━━━━━━━━━━━◈\n⚠️ No se pudo resolver\n◈━━━━━━━━━━━━━━━━━━━━◈`;
  const { a, b, c, discriminante, x1, x2 } = r;
  return `◈━━━━━━━━━━━━━━━━━━━━◈\n  ⬡ *𝗖𝗔𝗟𝗖𝗨𝗟𝗔𝗗𝗢𝗥𝗔* ⬡\n◈━━━━━━━━━━━━━━━━━━━━◈\n\n◌ ── 𝗘𝗡𝗧𝗥𝗔𝗗𝗔 ── ◌\n  📝 \`${query}\`\n\n◌ ── 𝗣𝗔𝗦𝗢𝗦 ── ◌\n  1️⃣ Forma estándar: *${a}x² + ${b}x + ${c} = 0*\n  2️⃣ a=${a}, b=${b}, c=${c}\n  3️⃣ Fórmula: *x = (-b ± √(b²-4ac)) / 2a*\n  4️⃣ Discriminante: *Δ = ${discriminante}*\n  5️⃣ ${discriminante < 0 ? "❌ Sin solución real" : discriminante === 0 ? `✅ Raíz doble: x = ${x1}` : `✅ x₁ = ${x1}\n  ✅ x₂ = ${x2}`}\n\n◈━━━━━━━━━━━━━━━━━━━━◈`;
}

// ── HELPERS ──────────────────────────────────────────
function generarEjeX(min, max, puntos) {
  return Array.from({ length: puntos + 1 }, (_, i) => parseFloat((min + i * (max-min)/puntos).toFixed(3)));
}

function evaluarFuncion(expr, min, max, puntos) {
  const jsExpr = expr
    .replace(/\^/g, "**").replace(/sin/g, "Math.sin").replace(/cos/g, "Math.cos")
    .replace(/tan/g, "Math.tan").replace(/log/g, "Math.log10").replace(/ln/g, "Math.log")
    .replace(/sqrt/g, "Math.sqrt").replace(/pi/gi, "Math.PI").replace(/abs/g, "Math.abs")
    .replace(/e(?![a-zA-Z])/g, "Math.E");

  return Array.from({ length: puntos + 1 }, (_, i) => {
    const x = min + i * (max-min)/puntos;
    try {
      const y = eval(jsExpr.replace(/x/g, `(${x})`));
      return isFinite(y) && Math.abs(y) < 1e6 ? parseFloat(y.toFixed(6)) : null;
    } catch { return null; }
  });
}
