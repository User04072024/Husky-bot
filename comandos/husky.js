const { prepareWAMessageMedia, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

module.exports = {
  name: "husky",
  alias: ["links", "catalogo"],
  desc: "Catálogo Husky Dev Space",

  async execute(sock, msg, args, from) {
    try {

      // 🔹 Imagen 1
      const img1 = await prepareWAMessageMedia(
        { image: { url: "https://picsum.photos/300?1" } },
        { upload: sock.waUploadToServer }
      );

      // 🔹 Imagen 2
      const img2 = await prepareWAMessageMedia(
        { image: { url: "https://picsum.photos/300?2" } },
        { upload: sock.waUploadToServer }
      );

      // 🔹 Imagen 3
      const img3 = await prepareWAMessageMedia(
        { image: { url: "https://picsum.photos/300?3" } },
        { upload: sock.waUploadToServer }
      );

      // 🔥 MENSAJE TIPO CATÁLOGO (MULTI PRODUCT)
      const message = generateWAMessageFromContent(from, {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: {
                text: "🐺 *Husky Dev Space*\nExplora nuestras plataformas oficiales:"
              },
              footer: {
                text: "© Husky Dev"
              },
              header: {
                hasMediaAttachment: false
              },
              carouselMessage: {
                cards: [
                  {
                    header: {
                      imageMessage: img1.imageMessage,
                      hasMediaAttachment: true
                    },
                    body: {
                      text: "🌐 Plataforma principal de Husky Dev"
                    },
                    footer: {
                      text: "Página Web"
                    },
                    nativeFlowMessage: {
                      buttons: [{
                        name: "cta_url",
                        buttonParamsJson: JSON.stringify({
                          display_text: "🔗 Ir a la Web",
                          url: "https://huskydev.space"
                        })
                      }]
                    }
                  },
                  {
                    header: {
                      imageMessage: img2.imageMessage,
                      hasMediaAttachment: true
                    },
                    body: {
                      text: "⚙️ Documentación y endpoints para desarrolladores"
                    },
                    footer: {
                      text: "API Oficial"
                    },
                    nativeFlowMessage: {
                      buttons: [{
                        name: "cta_url",
                        buttonParamsJson: JSON.stringify({
                          display_text: "⚙️ Ver API",
                          url: "https://api.huskydev.space"
                        })
                      }]
                    }
                  },
                  {
                    header: {
                      imageMessage: img3.imageMessage,
                      hasMediaAttachment: true
                    },
                    body: {
                      text: "📢 Únete a nuestra comunidad oficial"
                    },
                    footer: {
                      text: "Canal WhatsApp"
                    },
                    nativeFlowMessage: {
                      buttons: [{
                        name: "cta_url",
                        buttonParamsJson: JSON.stringify({
                          display_text: "📢 Unirse",
                          url: "https://whatsapp.com/channel/0029VbCGBnb2UPBF8LXws83u"
                        })
                      }]
                    }
                  }
                ]
              }
            }
          }
        }
      }, {
        quoted: msg,
        userJid: sock.user.id
      });

      await sock.relayMessage(from, message.message, {
        messageId: message.key.id
      });

    } catch (err) {
      console.error("Error catálogo:", err);

      // 🔻 Fallback seguro
      await sock.sendMessage(from, {
        text: `🐺 *Husky Dev Space*\n\n🌐 Web: https://huskydev.space\n⚙️ API: https://api.huskydev.space\n📢 Canal: https://whatsapp.com/channel/0029VbCGBnb2UPBF8LXws83u`
      }, { quoted: msg });
    }
  }
};
