const { randomUUID } = require("crypto");

const _0x = ['Y2hhdC53cm1ncHQuY29t', 'X19Ib3N0LWF1dGhqcy5jc3JmLXRva2Vu', 'MTE0ODkyNTYwOTE0OWQ1OTQ0M2NjZjVkZjE2ZGY2MTliOTFkZDcxYmM1ZjA3ZWQxNWRmNjhhYzQ3OTYwZjhjMSU3QzNhMGUzMWYwN2IzZTRjYzBhZDY5OWFiYzczYTA5ZjUzOTdjMDgyZTMxNzVhMzlmZDM3MDQ3ZWUzYmE0MjFmMDc=', 'X19TZWN1cmUtYXV0aGpzLmNhbGxiYWNrLXVybA==', 'aHR0cHMlM0ElMkYlMkZjaGF0LndybWdwdC5jb20lMkY=', 'X19TZWN1cmUtYXV0aGpzLnNlc3Npb24tdG9rZW4=', 'ZXlKaGJHY2lPaUprYVhJaUxDSmxibU1pT2lKQk1qVTJRMEpETFVoVE5URXlJaXdpYTJsa0lqb2lSbmxFU2pRMVVYRlFlRFZSU1Zob2FWTlNRazV1TkZCSGNGQkZWblF6YmpCWlRWaFJWR2xFWjNoTmVTMUthRVpDTlRKUU9XeDZkMGx2TlRSSU9EVTFYM0pOVnpoV1RIRTBVVVZEVUV4VFdGOWFMVGgyYVhjaWZRLi5XalluOVd6N1c2U2J1cEx2ZmtIMFJnLnZsNkNuRFZSeVNpMXZDZUtoRFpBSkFleGM0NjdJbjY4ZzIyc2NNVnNVUHVldUtRdTZ0Qmp0ZllJbFp5Q1FmMUx0ejRwOFFqd3lNWGREanUtb3VuOTFRaWxnN3RHR25qcW5SRDU0MG45RUFILWZiLXpsWTZwOExDdC1rbW5NQkRZSGdaQWs4cDF4SVFfaVlWMHp5V0huenh4Q1lqS2x4alBpR2tQUm9XQnJUdi1NSko0YlN4WFVBeWtidHZmSGdCZmRNVmY1UGVfaXdFU2xjUE1uN0ZiMW5oMkhyaERoUWlkV1UzaHAwd1ZSWnpPNE9GVE10Q1ZXY1pOcXFSRkJpMFBMcjNZTzNzdkJVTEo1MldWVDRILWtZb1I4VEJ4Z1lVSGw1MzBzS25NRHNnQnliRWtJYS1yejdfVkdBTHpQVzRpbHctemRkZG1nMUNsbzQ3QjI5SUZ5dWQzNTJGREV2d2lXazQ3b0ZiSElHaXlOWWJnS1ozbGlJTHI3Y1JJNjJNTVQxZ0VhNF9uMGpGNjNmUTBjNXgxalNzMVdTSGVGalozTjBYR0Y1eGJlY2ZZV0VYMk5nUGh4WDRuQ19zQ0R3cXRBT3RMbTd6R0tEWDVqLXh3VGtwSlpRLnFYZ1hmLUhVbWdjV0FPS1NmUXJuRjZhSm5ZYWtrMm5iWnJWZ0J3bWNpTms='];
const _h = _0x.map(s => Buffer.from(s, 'base64').toString());
const _ck = `${_h[1]}=${_h[2]}; ${_h[3]}=${_h[4]}; ${_h[5]}=${_h[6]}`;
const B = 'https://' + _h[0];

module.exports = {
  name: "gpt",
  alias: ["ia", "wormgpt"],
  desc: "IA WormGPT usando Native Fetch",
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(" ");

    if (!text) return sock.sendMessage(from, { text: "Escribe una consulta para WormGPT." });

    try {
      const id = randomUUID();

      const response = await fetch(B + '/api/chat', {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Referer': B + '/chat/' + id,
          'Cookie': _ck,
          'Origin': B,
          'Priority': 'u=1, i'
        },
        body: JSON.stringify({
          id: id,
          message: { role: 'user', parts: [{ type: 'text', text: text }] },
          selectedChatModel: 'wormgpt-v6.5',
          selectedVisibilityType: 'private',
          searchEnabled: false,
          memoryLength: 8
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.text();
      let fullResponse = '';
      const lines = data.split('\n');

      for (let line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const json = JSON.parse(line.substring(6));
            if (json.type === 'text-delta') fullResponse += json.delta;
          } catch (e) {}
        }
      }

      const result = fullResponse.trim() || "No se obtuvo respuesta.";
      await sock.sendMessage(from, { text: result }, { quoted: msg });

    } catch (err) {
      console.error("❌ Error con Fetch:", err.message);
      await sock.sendMessage(from, { 
        text: `⚠️ Error: ${err.message}. El servidor sigue rechazando la conexión o el token expiró.` 
      });
    }
  }
};

