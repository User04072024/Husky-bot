const axios = require("axios");
const moment = require("moment-timezone");

const WEATHER_API_KEY = "39e882b7c540400b8c5193947251011"; // Pon tu key de WeatherAPI

module.exports = {
  name: "clima",
  alias: ["weather", "tiempo"],
  desc: "Muestra el clima actual y pronóstico de una ciudad",
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const query = args.join(" ");

    if (!query) {
      await sock.sendMessage(from, {
        text: "🌍 Escribe la ciudad de esta forma:\n`Ciudad/Municipio, Departamento o Estado`\nEjemplo: `Hatonuevo, La Guajira`",
      });
      return;
    }

    try {
      // 1️⃣ Llamada a WeatherAPI
      const url = `http://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(
        query
      )}&days=4&aqi=no&alerts=no&lang=es`;

      const res = await axios.get(url);
      const data = res.data;

      const loc = data.location;
      const current = data.current;
      const forecast = data.forecast.forecastday;

      const tz = loc.tz_id;
      const horaLocal = moment(current.last_updated).tz(tz).format("hh:mm A");
      const fechaLocal = moment(current.last_updated).tz(tz).format("YYYY-MM-DD");

      // 2️⃣ Construir texto
      let texto = `🌤️ *Clima en ${loc.name}, ${loc.region || loc.country}:*\n\n`;
      texto += `🕓 Hora local: ${horaLocal}\n`;
      texto += `📝 Condición: ${current.condition.text}\n`;
      texto += `🌡️ Temperatura: ${current.temp_c}°C\n`;
      texto += `🥵 Sensación térmica: ${current.feelslike_c}°C\n`;
      texto += `💧 Humedad: ${current.humidity}%\n`;
      texto += `🌬️ Viento: ${current.wind_kph} km/h (${current.wind_dir})\n`;
      texto += `💨 Ráfagas: ${current.gust_kph} km/h\n`;
      texto += `📈 Presión: ${current.pressure_mb} hPa\n`;
      texto += `🌫️ Visibilidad: ${current.vis_km} km\n`;
      texto += `☁️ Nubosidad: ${current.cloud}%\n`;
      texto += `🌞 Índice UV: ${current.uv}\n`;
      texto += `🌡️ Punto de rocío: ${current.dewpoint_c}°C\n\n`;

      texto += `📅 *Pronóstico para los próximos días:*\n`;
      forecast.forEach((f) => {
        const amanecer = moment(f.astro.sunrise, "hh:mm A").format("hh:mm A");
        const atardecer = moment(f.astro.sunset, "hh:mm A").format("hh:mm A");
        texto += `📆 ${f.date} → ${f.day.condition.text}\n`;
        texto += `🌡️ Máx: ${f.day.maxtemp_c}°C | Mín: ${f.day.mintemp_c}°C\n`;
        texto += `🌧️ Lluvia: ${f.day.totalprecip_mm} mm | 💨 Viento: ${f.day.maxwind_kph} km/h\n`;
        texto += `☀️ Amanecer: ${amanecer} | 🌇 Atardecer: ${atardecer}\n\n`;
      });

      // 3️⃣ Imagen radar RainViewer
      try {
        const radarData = await axios.get("https://api.rainviewer.com/public/weather-maps.json");
        const frame = radarData.data.radar.past.slice(-1)[0];

        // Coordenadas del radar
        const lat = loc.lat;
        const lon = loc.lon;

        // Construir URL del tile centrado en la ciudad
        const radarImg = `https://tilecache.rainviewer.com/v2/radar/${frame.path}/512/${lat}/${lon}/0.png`;

        await sock.sendMessage(from, {
          image: { url: radarImg },
          caption: "🛰️ Radar meteorológico actual",
        });
      } catch (e) {
        console.log("⚠️ No se pudo cargar el radar:", e.message);
      }

      // 4️⃣ Enviar mensaje de clima
      await sock.sendMessage(from, { text: texto });
    } catch (err) {
      console.log("❌ Error en !clima:", err.message);
      await sock.sendMessage(from, {
        text: "⚠️ No se pudo obtener el clima. Asegúrate de escribir `Ciudad/Municipio, Departamento o Estado` correctamente.",
      });
    }
  },
};
