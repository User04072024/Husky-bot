const crypto = require('crypto');

module.exports = {
  name: "c",
  alias: ["codigo", "huskycode", "snip"],
  desc: "Envía un bloque de código con resaltado de sintaxis estilo IA",
  
  async execute(sock, msg, args, from) {
    try {
      if (!args || args.length < 2) {
        await sock.sendMessage(from, { 
          text: "❌ *Uso:* !code [lenguaje] [código]" 
        }, { quoted: msg });
        return;
      }

      const language = args[0].toLowerCase();
      const codeToDisplay = args.slice(1).join(" ");

      const tokenize = (src) => {
        const tokens = [];
        let i = 0;
        const KEYWORDS = new Set(['import', 'def', 'return', 'if', 'else', 'const', 'let', 'function', 'class']);
        while (i < src.length) {
          const ch = src[i];
          if (/[A-Za-z_$]/.test(ch)) {
            let j = i + 1;
            while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
            const word = src.slice(i, j);
            tokens.push({ highlightType: KEYWORDS.has(word.toLowerCase()) ? 1 : 0, codeContent: word });
            i = j; continue;
          }
          tokens.push({ highlightType: 0, codeContent: ch });
          i++;
        }
        return tokens;
      };

      const mainText = `💻 *Code:* ${language.toUpperCase()}`;

      // Payload simplificado
      const unifiedResponseData = {
        response_id: crypto.randomUUID(),
        sections: [
          {
            view_model: {
              primitive: {
                text: mainText,
                __typename: "GenAIMarkdownTextUXPrimitive"
              },
              __typename: "GenAISingleLayoutViewModel"
            }
          },
          {
            view_model: {
              primitive: {
                language: language,
                code_blocks: tokenize(codeToDisplay),
                __typename: "GenAICodeUXPrimitive"
              },
              __typename: "GenAISingleLayoutViewModel"
            }
          }
        ]
      };

      const content = {
        botForwardedMessage: {
          message: {
            richResponseMessage: {
              messageType: 1,
              unifiedResponse: {
                // PRUEBA: Cambiamos de Base64 a String Plano
                data: JSON.stringify(unifiedResponseData) 
              },
              contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedAiBotMessageInfo: {
                  botJid: "259786046210223@bot" // ID alternativo de Meta
                }
              }
            }
          }
        }
      };

      await sock.relayMessage(from, content, { quoted: msg });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, { text: "⚠️ Error al enviar el código." });
    }
  },
};

