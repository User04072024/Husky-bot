
const axios = require("axios");

module.exports = {
  name: "live",
  alias: ["vivo"],
  desc: "Verifica si un BIN está activo y proporciona información del banco y el país",
  async execute(sock, msg, args, from) {
    try {
      // 1. Validar si hay argumentos
      if (!args || args.length < 4) {
        await sock.sendMessage(from, {
          text: "❌ Ingresa los datos necesarios en el siguiente formato: !live [número bin|mes|año|cvv]\n\n📌 *Ejemplo:* !live 411111|12|25|123"
        }, { quoted: msg });
        return;
      }

      // 2. Separar los argumentos
      const [bin, mes, ano, cvv] = args;
      const cardData = {
        bin,
        month: mes,
        year: ano,
        cvv
      };

      // 3. Verificar si el BIN está activo
      const isBinLive = await checkBinStatus(bin);

      if (!isBinLive) {
        await sock.sendMessage(from, {
          text: "⚠️ El BIN proporcionado no está activo."
        }, { quoted: msg });
        return;
      }

      // 4. Obtener información del banco y el país
      const cardInfo = await getCardInfo(bin);

      // 5. Enviar la información al usuario
      await sock.sendMessage(from, {
        text: `📝 *Información de la Tarjeta*\n\n*BIN:* ${bin}\n*Mes:* ${mes}\n*Año:* ${ano}\n*CVV:* ${cvv}\n\n*Banco:* ${cardInfo.bank}\n*País:* ${cardInfo.country}`
      }, { quoted: msg });

    } catch (err) {
      console.error("❌ Error en !live:", err);
      await sock.sendMessage(from, {
        text: "⚠️ Ocurrió un error al verificar el BIN."
      }, { quoted: msg });
    }
  }
};

// Función para verificar si el BIN está activo
async function checkBinStatus(bin) {
  try {
    const response = await axios.get(`https://lookupbin.com/${bin}`);
    return response.data.status === 'active';
  } catch (error) {
    console.error("Error al verificar BIN:", error);
    return false;
  }
}

// Función para obtener información del banco y el país
async function getCardInfo(bin) {
  try {
    const response = await axios.get(`https://api.iban.se/bininfo/${bin}`);
    return response.data;
  } catch (error) {
    console.error("Error al obtener información de la tarjeta:", error);
    return {
      bank: 'Desconocido',
      country: 'Desconocido'
    };
  }
}
