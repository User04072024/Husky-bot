const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Carpeta temporal de descargas
const tempDir = path.join(__dirname, "downloads");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// Endpoint: /download?url=VIDEO_ID
app.get("/download", async (req, res) => {
  const videoId = req.query.url;
  if (!videoId) return res.status(400).json({ error: "Falta video ID" });

  const videoUrl = `https://youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(tempDir, `audio_${Date.now()}.mp3`);

  const cmd = `yt-dlp -x --audio-format mp3 --force-ipv4 --no-check-certificate -o "${outputPath}" "${videoUrl}"`;

  exec(cmd, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error descargando audio" });
    }

    res.json({ audio: outputPath });
  });
});

app.listen(PORT, () => console.log(`Mini API corriendo en http://localhost:${PORT}`));
