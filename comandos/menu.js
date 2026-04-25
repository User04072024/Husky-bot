module.exports = {
name: "menu",
description: "Muestra el menú de comandos del Husky-Bot (v1.8)",
async execute(sock, msg, args, from, sender, db, saveDB, isOwner, sendMessageSafe, isAdmin, getGroupMetadata, comandos) {

const startTime   = Date.now();  
const now         = new Date();  
const fecha       = now.toLocaleDateString("es-CO");  
const hora        = now.toLocaleTimeString("es-CO");  
const ping        = Date.now() - startTime;  
const usuarios    = Object.keys(db?.usuarios || {}).length;  
const totalCmds   = Object.keys(comandos || {}).length;  
const previewUrl  = "https://iili.io/BgmzVX1.png";  

const menuText =
`▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱
⬡  *𝙃𝙐𝙎𝙆𝙔-𝘽𝙊𝙏*  ◈  *𝙑 𝟭.𝟴*
    ⌬ _Interactive Version_ ⌬
▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱

◌ ───── 𝗦𝗬𝗦𝗧𝗘𝗠 𝗖𝗢𝗥𝗘 ───── ◌
  ⚡ *Latencia*    ›  ${ping}ms
  🗓 *Fecha*       ›  ${fecha}
  🕒 *Hora*        ›  ${hora}
  👥 *Usuarios*    ›  ${usuarios}
  📦 *Módulos*     ›  ${totalCmds}
  🔋 *Sistema*     ›  En línea
  🌐 *Conexión*    ›  Estable

◌ ──── 𝗠𝗢𝗗𝗢 𝗜𝗔 𝗔𝗖𝗧𝗜𝗩𝗢 ──── ◌
  💬 Escribe *Husky* o *Husky-Bot*
  para activar el chat con IA
▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱`;

await sock.sendMessage(from, {
image: { url: previewUrl },
caption: menuText,
title: "⬡ 𝐇𝐔𝐒𝐊𝐘-𝐁𝐎𝐓 V1.8",
subtitle: "[ Interactive Version ]",
footer: `▰ ${totalCmds} módulos activos · ${usuarios} usuarios registrados ▰`,
media: true,
interactiveButtons: [
{
name: "single_select",
buttonParamsJson: JSON.stringify({
title: "⬡ Ver menú",
sections: [
{
title: "🎵 Multimedia & Descargas",
highlight_label: "🎵",
rows: [
{ header: "🎵 Música",      title: "!play",        description: "Reproducir música de YouTube",   id: "!play"        },
{ header: "🎧 Spotify",     title: "!sp",          description: "Buscar canciones en Spotify",    id: "!sp"          },
{ header: "📹 YouTube",     title: "!vid",         description: "Descargar videos de YouTube",    id: "!vid"         },
{ header: "🎵 TikTok",      title: "!tk",          description: "TikTok sin marca de agua",       id: "!tk"          },
{ header: "📸 Instagram",   title: "!ig",          description: "Descargar videos de Instagram",  id: "!ig"          },
{ header: "▶️ Dailymotion", title: "!dailymotion", description: "Descargar de Dailymotion",       id: "!dailymotion" },
{ header: "📁 Mediafire",   title: "!mediafire",   description: "Descargar archivos Mediafire",   id: "!mediafire"   },
{ header: "☁️ Mega",        title: "!mega",        description: "Descargar archivos de Mega",     id: "!mega"        },
{ header: "🔄 Convertir",   title: "!convertir",   description: "Convertir formatos de archivo",  id: "!convertir"   },
{ header: "🎬 Película",    title: "!pelicula",    description: "Link directo para ver película", id: "!pelicula"    },
{ header: "📡 Live",        title: "!live",        description: "Streams en vivo",                id: "!live"        },
]
},
{
title: "🖼️ Stickers & Imágenes",
highlight_label: "🖼️",
rows: [
{ header: "✂️ Crear",       title: "!sticker",    description: "Crear sticker desde imagen",    id: "!sticker"    },
{ header: "🎨 Texto Color", title: "!attp",       description: "Sticker con texto de colores",  id: "!attp"       },
{ header: "✏️ Texto",       title: "!texs",       description: "Convertir texto a sticker",     id: "!texs"       },
{ header: "✨ Animado",     title: "!texsv",      description: "Sticker animado con texto",     id: "!texsv"      },
{ header: "🔀 EmojiMix",   title: "!emojimix",   description: "Combinar dos emojis",           id: "!emojimix"   },
{ header: "😀 Emoji",       title: "!a",          description: "Obtener emoji animado",         id: "!a"          },
{ header: "🎲 3D",          title: "!qc",         description: "Sticker 3D desde imagen",       id: "!qc"         },
{ header: "📏 BigSticker",  title: "!bigsticker", description: "Sticker grande que sobresale",  id: "!bigsticker" },
{ header: "🎨 Sin Fondo",   title: "!remove",     description: "Eliminar fondo de imagen",      id: "!remove"     },
{ header: "🔄 Convertir",   title: "!convert",    description: "Sticker a imagen o video",      id: "!convert"    },
{ header: "📸 HD",          title: "!hd",         description: "Aumentar resolución de imagen", id: "!hd"         },
{ header: "💬 Quote",       title: "!quote",      description: "Citar mensaje como imagen",     id: "!quote"      },
{ header: "🖊️ Book",        title: "!book",       description: "Texto en hoja manuscrita",      id: "!book"       },
{ header: "🏷️ Exif",        title: "!exif",       description: "Ver o editar datos EXIF",       id: "!exif"       },
]
},
{
title: "🤖 Inteligencia Artificial",
highlight_label: "🤖",
rows: [
{ header: "🤖 Copilot",   title: "!copilot", description: "IA con GPT-5 / Think Deeper",  id: "!copilot" },
{ header: "🧠 Gemini",    title: "!ia",      description: "Google Gemini AI",              id: "!ia"      },
{ header: "💬 ChatGPT",   title: "!chatgpt", description: "OpenAI GPT Assistant",          id: "!chatgpt" },
{ header: "🎨 Imágenes",  title: "!img",     description: "Generar imágenes con IA",       id: "!img"     },
{ header: "⚡ Generar",   title: "!generar", description: "Generar imágenes por prompt",   id: "!generar" },
{ header: "🎬 Videos IA", title: "!sora",    description: "Generar videos con IA",         id: "!sora"    },
{ header: "🔊 Leer",      title: "!leer",    description: "Convertir texto a audio",       id: "!leer"    },
]
},
{
title: "🌐 Redes & Búsqueda Web",
highlight_label: "🌐",
rows: [
{ header: "🌐 Google",    title: "!google",   description: "Buscar información en Google", id: "!google"   },
{ header: "📸 Pinterest", title: "!pint",     description: "Buscar imágenes en Pinterest", id: "!pint"     },
{ header: "📰 Noticias",  title: "!noticias", description: "Noticias del país y el mundo", id: "!noticias" },
{ header: "📱 APK",       title: "!apk",      description: "Buscar APK en Play Store",     id: "!apk"      },
{ header: "📱 An1",       title: "!An1",      description: "Buscar APK en An1",            id: "!An1"      },
{ header: "📡 Canal WA",  title: "!stwa",     description: "Info de canal de WhatsApp",    id: "!stwa"     },
{ header: "🔗 Info Link", title: "!link",     description: "Información de un enlace",     id: "!link"     },
{ header: "🌍 IP",        title: "!ip",       description: "Información de dirección IP",  id: "!ip"       },
{ header: "📸 Web",       title: "!ssweb",    description: "Captura de pantalla web",      id: "!ssweb"    },
{ header: "🏴 Banderas",  title: "!bandera",  description: "Info de banderas por país",    id: "!bandera"  },
]
},
{
title: "🧰 Herramientas & Utilidades",
highlight_label: "🧰",
rows: [
{ header: "🌤️ Clima",   title: "!clima",      description: "Ver clima de tu ciudad",       id: "!clima"      },
{ header: "🔢 Calc",    title: "!calc",       description: "Calculadora matemática",       id: "!calc"       },
{ header: "🔤 Fuentes", title: "!font",       description: "Estilos de letra",             id: "!font"       },
{ header: "📧 Correo",  title: "!correo",     description: "Correo temporal desechable",   id: "!correo"     },
{ header: "📷 QR",      title: "!qr",         description: "Generar código QR",            id: "!qr"         },
{ header: "🔍 Leer QR", title: "!readqr",     description: "Leer y decodificar QR",        id: "!readqr"     },
{ header: "🔗 Links",   title: "!acortalink", description: "Acortar enlaces largos",       id: "!acortalink" },
{ header: "💡 Dato",    title: "!fact",       description: "Dato curioso aleatorio",       id: "!fact"       },
{ header: "🎨 Pixel",   title: "!pixel",      description: "Imagen a Pixel Art",           id: "!pixel"      },
{ header: "💻 ASCII",   title: "!ascii",      description: "Texto a ASCII Art",            id: "!ascii"      },
{ header: "⠿ Braille",  title: "!braille",    description: "Texto a Braille",              id: "!braille"    },
{ header: "🏷️ Tag",     title: "!tag",        description: "Repicar mensaje del bot",      id: "!tag"        },
{ header: "ℹ️ InfoBot", title: "!infobot",    description: "Información del bot",          id: "!infobot"    },
]
},
{
title: "🎮 Juegos & Entretenimiento",
highlight_label: "🎮",
rows: [
{ header: "⚔️ Batalla", title: "!pvp",   description: "Juego de batalla entre usuarios", id: "!pvp"   },
{ header: "🐾 Mascota", title: "!pet",   description: "Adopta y cuida tu mascota",       id: "!pet"   },
{ header: "🎭 Drama",   title: "!drama", description: "Genera drama entre usuarios",     id: "!drama" },
]
},
{
title: "🛡️ Administración de Grupo",
highlight_label: "🛡️",
rows: [
{ header: "🚫 Ban",        title: "!ban",       description: "Expulsar usuario del grupo",  id: "!ban"       },
{ header: "➕ Añadir",     title: "!add",       description: "Añadir usuario al grupo",     id: "!add"       },
{ header: "⬆️ Promover",   title: "!promover",  description: "Dar rol de administrador",    id: "!promover"  },
{ header: "⬇️ Degradar",   title: "!degradar",  description: "Quitar rol de administrador", id: "!degradar"  },
{ header: "⚠️ Advertir",   title: "!advertir",  description: "Dar advertencia a usuario",   id: "!advertir"  },
{ header: "🔒 Antilink",   title: "!antilink",  description: "Bloquear links en el grupo",  id: "!antilink"  },
{ header: "🗑️ Borrar",    title: "!delete",    description: "Borrar mensaje del chat",     id: "!delete"    },
{ header: "🔓 Grupo",      title: "!grupo",     description: "Abrir o cerrar el grupo",     id: "!grupo"     },
{ header: "👮 ModoAdmin",  title: "!modoadmin", description: "Solo admins pueden escribir", id: "!modoadmin" },
{ header: "👋 Welcome",    title: "!welcome",   description: "Configurar bienvenida",       id: "!welcome"   },
{ header: "🚪 Bye",        title: "!bye",       description: "Configurar despedida",        id: "!bye"       },
{ header: "👻 Inactivos",  title: "!fantasmas", description: "Ver miembros inactivos",      id: "!fantasmas" },
{ header: "🔗 Link Grupo", title: "!glink",     description: "Obtener link del grupo",      id: "!glink"     },
{ header: "📢 Mencionar",  title: "!todos",     description: "Mencionar a todos del grupo", id: "!todos"     },
]
},
{
title: "📈 Perfil, Niveles & Stats",
highlight_label: "📈",
rows: [
{ header: "👤 Perfil",    title: "!perfil",      description: "Ver perfil completo",         id: "!perfil"      },
{ header: "🏆 Ranking",   title: "!rankactivos", description: "Top usuarios más activos",    id: "!rankactivos" },
{ header: "⬆️ Niveles",   title: "!leveling",    description: "Sistema de niveles",          id: "!leveling"    },
{ header: "📊 Mi nivel",  title: "!minivel",     description: "Ver tu nivel y experiencia",  id: "!minivel"     },
{ header: "ℹ️ Grupo",     title: "!grupoinfo",   description: "Ver información del grupo",   id: "!grupoinfo"   },
{ header: "📡 Ping",      title: "!ping",        description: "Ver latencia del bot",        id: "!ping"        },
{ header: "🍪 Cookies",   title: "!setcookies",  description: "Configurar cookies del bot",  id: "!setcookies"  },
]
},
]
})
},
{
name: "cta_url",
buttonParamsJson: JSON.stringify({
display_text: "📢 Canal Oficial",
url: "https://whatsapp.com/channel/0029VbCGBnb2UPBF8LXws83u",
merchant_url: "https://whatsapp.com/channel/0029VbCGBnb2UPBF8LXws83u"
})
},
{
name: "cta_url",
buttonParamsJson: JSON.stringify({
display_text: "👤 Owner",
url: "https://wa.me/6283191473712"
})
}
]
}, { quoted: msg });
}
};
