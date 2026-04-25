// comandos/advertir.js
const fs = require("fs");
const rutaAdvertencias = "./advertencias.json";

function cargarAdvertencias() {
  try {
    if (fs.existsSync(rutaAdvertencias)) {
      return JSON.parse(fs.readFileSync(rutaAdvertencias, "utf8"));
    }
  } catch (error) {
    console.error("Error al cargar advertencias:", error);
  }
  return {};
}

function guardarAdvertencias(advertencias) {
  try {
    fs.writeFileSync(rutaAdvertencias, JSON.stringify(advertencias, null, 2));
  } catch (error) {
    console.error("Error al guardar advertencias:", error);
  }
}

function normalizarJid(jid = "") {
  return jid.replace(/:\d+@/, "@");
}

function tagUsuario(jid) {
  return jid.split("@")[0];
}

function asegurarRegistro(advertencias, grupo, usuario) {
  if (!advertencias[grupo]) advertencias[grupo] = {};
  if (!advertencias[grupo][usuario]) advertencias[grupo][usuario] = 0;
}

function sumarAdvertencia(advertencias, grupo, usuario) {
  asegurarRegistro(advertencias, grupo, usuario);
  advertencias[grupo][usuario] += 1;
  guardarAdvertencias(advertencias);
  return advertencias[grupo][usuario];
}

module.exports = {
  name: "advertir",
  description: "Advierte a un usuario. Si llega a 3 advertencias, será expulsado con estilo 😎.",

  async execute(sock, msg, args, from) {
    const isGroup = from.endsWith("@g.us");

    if (!isGroup) {
      return sock.sendMessage(from, {
        text: "❌ Este comando solo funciona en grupos, bro 😅"
      });
    }

    let advertencias = cargarAdvertencias();

    // Quién ejecuta el comando
    const ejecutor = normalizarJid(
      msg.key?.participant || msg.participant || ""
    );

    if (!ejecutor) {
      return sock.sendMessage(
        from,
        { text: "❌ No pude identificar quién ejecutó el comando." },
        { quoted: msg }
      );
    }

    // Obtener info del grupo
    const metadata = await sock.groupMetadata(from);
    const participantes = metadata.participants || [];

    const admins = participantes
      .filter((p) => p.admin !== null && p.admin !== undefined)
      .map((p) => normalizarJid(p.id));

    const ejecutorEsAdmin = admins.includes(ejecutor);

    const botId = normalizarJid(sock.user?.id || "");
    const botEsAdmin = admins.includes(botId);

    // Frases para no admins que intenten usar el comando
    const frasesNoAdmin = {
      1: [
        `😹 @${tagUsuario(ejecutor)}, intentaste usar un comando de admin sin corona. Primera advertencia (*1/3*).`,
        `🤡 @${tagUsuario(ejecutor)}, ¿y ese poder imaginario? Este comando es solo para admins. Vas *1/3*.`,
        `🤣 @${tagUsuario(ejecutor)} quiso jugar a ser admin... pero el bot no se ríe gratis. Advertencia *1/3*.`,
        `🫵 @${tagUsuario(ejecutor)}, bonito intento de jefe... lástima que no mandas aquí. Advertencia *1/3*.`,
        `🎭 @${tagUsuario(ejecutor)} entró en modo admin de utilería. Resultado: advertencia *1/3*.`,
        `😎 @${tagUsuario(ejecutor)}, baja del pony. Ese comando no es para ti. Ya llevas *1/3*.`,
        `🚫 @${tagUsuario(ejecutor)}, permisos insuficientes y confianza excesiva. Advertencia *1/3*.`,
        `😂 @${tagUsuario(ejecutor)} quiso tocar botones prohibidos. El bot respondió con un *1/3*.`,
        `👀 @${tagUsuario(ejecutor)}, te vi intentando mandar sin ser admin. Advertencia *1/3*.`,
        `📛 @${tagUsuario(ejecutor)}, primer intento de golpe de estado detectado. Advertencia *1/3*.`
      ],
      2: [
        `🤨 @${tagUsuario(ejecutor)}, otra vez jugando al admin... ya vas *2/3*. El chiste se está acabando.`,
        `😂 @${tagUsuario(ejecutor)}, sigues intentando mandar sin permisos. Advertencia *2/3*. Vas fuerte al ban.`,
        `🧨 @${tagUsuario(ejecutor)}, segundo intento de admin falso. Ya estás en *2/3*.`,
        `😬 @${tagUsuario(ejecutor)}, el bot ya te cachó dos veces. Advertencia *2/3*.`,
        `🎪 @${tagUsuario(ejecutor)}, tu show de “soy admin” ya va por *2/3*. Última llamada.`,
        `🚨 @${tagUsuario(ejecutor)}, otro comando de admin que no te pertenece. Llevas *2/3*.`,
        `😏 @${tagUsuario(ejecutor)}, te gusta el peligro, ¿no? Ya estás en *2/3* advertencias.`,
        `🕵️ @${tagUsuario(ejecutor)}, el bot observa y anota. Intento ilegal número dos: *2/3*.`,
        `💢 @${tagUsuario(ejecutor)}, deja de tocar lo que no debes. Ya vas *2/3*.`,
        `🥴 @${tagUsuario(ejecutor)}, a este ritmo desbloqueas el logro “ban por payaso”. Advertencia *2/3*.`
      ],
      3: [
        `💀 @${tagUsuario(ejecutor)} siguió jugando al admin hasta completar *3/3*. Premio: expulsión inmediata.`,
        `🚪 @${tagUsuario(ejecutor)}, llegaste a *3/3* por andar de admin pirata. Salida por la derecha.`,
        `🤣 @${tagUsuario(ejecutor)} insistió tanto en ser admin que el bot le concedió un viaje fuera del grupo. *3/3*.`,
        `☠️ @${tagUsuario(ejecutor)}, tercer intento, tercera advertencia. El bot dijo: “afuera”.`,
        `🧹 @${tagUsuario(ejecutor)} acumuló *3/3* por usar comandos de admin sin serlo. Procediendo a barrer...`,
        `👋 @${tagUsuario(ejecutor)}, gracias por participar en “cómo ser expulsado en 3 pasos”. Resultado: *3/3*.`,
        `🎉 @${tagUsuario(ejecutor)} desbloqueó el rango “admin de imaginación” con *3/3* advertencias. Expulsado.`,
        `🚫 @${tagUsuario(ejecutor)}, el bot ya se cansó de tu actuación. Advertencias completas: *3/3*.`,
        `📦 @${tagUsuario(ejecutor)} fue empacado con cariño y enviado fuera del grupo por llegar a *3/3*.`,
        `😎 @${tagUsuario(ejecutor)}, quisiste mandar mucho... ahora vas directo al lobby. *3/3*.`
      ]
    };

    // Si NO es admin, se advierte al ejecutor
    if (!ejecutorEsAdmin) {
      const total = sumarAdvertencia(advertencias, from, ejecutor);
      const grupoFrasesNoAdmin = frasesNoAdmin[total] || frasesNoAdmin[3];
      const mensajeNoAdmin =
        grupoFrasesNoAdmin[Math.floor(Math.random() * grupoFrasesNoAdmin.length)];

      await sock.sendMessage(
        from,
        {
          text: mensajeNoAdmin,
          mentions: [ejecutor]
        },
        { quoted: msg }
      );

      if (total >= 3) {
        if (!botEsAdmin) {
          return sock.sendMessage(
            from,
            {
              text: `⚠️ @${tagUsuario(ejecutor)} llegó a *3/3*, pero no puedo expulsarlo porque no soy admin.`,
              mentions: [ejecutor]
            },
            { quoted: msg }
          );
        }

        await new Promise((res) => setTimeout(res, 1000));
        await sock.groupParticipantsUpdate(from, [ejecutor], "remove");

        advertencias[from][ejecutor] = 0;
        guardarAdvertencias(advertencias);
      }

      return;
    }

    // Detectar si es respuesta o mención
    const participante = normalizarJid(
      msg.message?.extendedTextMessage?.contextInfo?.participant ||
      (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
        ? msg.message.extendedTextMessage.contextInfo.mentionedJid[0]
        : "")
    );

    if (!participante) {
      return sock.sendMessage(
        from,
        {
          text: "⚠️ Debes responder al mensaje del usuario o mencionarlo con @ para advertirlo."
        },
        { quoted: msg }
      );
    }

    // No dejar advertir a otros admins
    if (admins.includes(participante)) {
      return sock.sendMessage(
        from,
        {
          text: `❌ No puedes advertir ni expulsar a un admin, @${tagUsuario(participante)}.`,
          mentions: [participante]
        },
        { quoted: msg }
      );
    }

    const usuario = participante;

    asegurarRegistro(advertencias, from, usuario);
    advertencias[from][usuario] += 1;
    guardarAdvertencias(advertencias);

    const total = advertencias[from][usuario];
    const restante = `${total}/3`;

    const frases = {
      1: [
        `😅 @${tagUsuario(usuario)}, primera advertencia (${restante}). ¡Todavía te queremos, pero no abuses! 😇`,
        `⚠️ @${tagUsuario(usuario)} lleva ${restante} advertencias. Respira hondo y compórtate, sensei 🧘‍♂️`,
        `🧐 @${tagUsuario(usuario)}, te ganaste tu primera advertencia (${restante}). ¡No empieces con travesuras! 😏`,
        `👀 @${tagUsuario(usuario)}, el bot te echó el primer ojo (${restante})... y no es de cariño 😬`,
        `🤣 @${tagUsuario(usuario)}, esto es una advertencia amistosa. La siguiente ya va con susto incluido 👻 (${restante})`,
        `📢 Atención grupo: @${tagUsuario(usuario)} acaba de ganarse su primera advertencia (${restante}). Aplausos lentos 👏`,
        `🧠 @${tagUsuario(usuario)}, esto es un recordatorio amistoso: el bot *ve todo* 👁️ (${restante})`,
        `😎 @${tagUsuario(usuario)}, relax bro... solo una advertencia (${restante}), no dramatices 🎭`,
        `🫣 @${tagUsuario(usuario)} recibió su primera advertencia (${restante}). Se siente el suspenso en el aire 😶`,
        `🚨 @${tagUsuario(usuario)} ya tiene ${restante}. ¡Cuidado! El bot anda con gatillo fácil hoy 💥`
      ],
      2: [
        `🤨 @${tagUsuario(usuario)}, ya van ${restante} advertencias... la paciencia del bot se está evaporando 😬`,
        `😬 @${tagUsuario(usuario)}, ${restante} advertencias. La tercera viene con *bombo y platillo* 🥁`,
        `🚨 @${tagUsuario(usuario)} tiene ${restante}. Último aviso antes de la catástrofe 😈`,
        `😑 @${tagUsuario(usuario)}, ${restante} advertencias. No tientes al destino 🌀`,
        `💢 @${tagUsuario(usuario)}, ya vas por ${restante}. Empieza a rezar el rosario del perdón 🙏`,
        `🧨 ${restante} advertencias para @${tagUsuario(usuario)}... la próxima será con fuego 🔥`,
        `🕵️ El bot te vigila, @${tagUsuario(usuario)} (${restante}). Tus movimientos están siendo observados 👁️`,
        `😂 ${restante} advertencias... @${tagUsuario(usuario)} está en modo “speedrun del ban” 🏃‍♂️💨`,
        `😱 @${tagUsuario(usuario)}, ${restante} advertencias. Estás jugando con fuego y sin extintor 🔥`,
        `🧠 Consejo del día: @${tagUsuario(usuario)}, la mejor forma de evitar el ban es... no provocar al bot 😏 (${restante})`
      ],
      3: [
        `💀 @${tagUsuario(usuario)} completó las ${restante} advertencias. El bot lo mandó a la dimensión del olvido 🌌`,
        `🧨 ${restante} advertencias... @${tagUsuario(usuario)} fue expulsado con honores y efectos especiales 💥`,
        `🤣 El bot dijo “ya basta” y *adiós* a @${tagUsuario(usuario)} (${restante}) 👋`,
        `🚪 @${tagUsuario(usuario)} alcanzó las ${restante} advertencias y fue teletransportado fuera del grupo 😆`,
        `😂 Aplausos por @${tagUsuario(usuario)} que llegó al récord de ${restante} advertencias 👏 ¡Expulsado nivel PRO!`,
        `☠️ ${restante} advertencias... el bot ejecutó el “Plan B: Ban Inmediato” sobre @${tagUsuario(usuario)} 😜`,
        `🚫 @${tagUsuario(usuario)} se graduó con ${restante} advertencias. ¡Felicidades, ahora eres libre... del grupo! 🦶`,
        `🥳 ${restante} advertencias. @${tagUsuario(usuario)} desbloqueó el logro oculto: “Expulsión gloriosa” 🏆`,
        `👋 ${restante} advertencias. El bot le dijo a @${tagUsuario(usuario)}: “Hasta la vista, baby 😎”`,
        `💫 @${tagUsuario(usuario)} llegó a ${restante} advertencias. El bot lo lanzó directo al metaverso de los baneados 🤯`
      ]
    };

    const grupoFrases = frases[total] || frases[3];
    const mensaje = grupoFrases[Math.floor(Math.random() * grupoFrases.length)];

    if (total >= 3) {
      await sock.sendMessage(
        from,
        { text: mensaje, mentions: [usuario] },
        { quoted: msg }
      );

      if (!botEsAdmin) {
        return sock.sendMessage(
          from,
          {
            text: `⚠️ @${tagUsuario(usuario)} llegó a *3/3*, pero no puedo expulsarlo porque no soy admin.`,
            mentions: [usuario]
          },
          { quoted: msg }
        );
      }

      await new Promise((res) => setTimeout(res, 1000));
      await sock.groupParticipantsUpdate(from, [usuario], "remove");

      advertencias[from][usuario] = 0;
      guardarAdvertencias(advertencias);
    } else {
      await sock.sendMessage(
        from,
        { text: mensaje, mentions: [usuario] },
        { quoted: msg }
      );
    }
  }
};
