const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

async function execute(client, message, args) {

    const targetJid = message.key.remoteJid;
    if (!targetJid) return;

    const fullInput = args.join(' ');
    const match = fullInput.match(/(.+?)\s(\d+)$/);

    let searchTerm = fullInput;
    let requestedPart = null;

    if (match) {
        searchTerm = match[1].trim();
        requestedPart = parseInt(match[2]);
    }

    const searchId = crypto.createHash('md5')
        .update(searchTerm.toLowerCase())
        .digest('hex');

    const tempDir = path.join(__dirname, '../temp', searchId);

    // =====================================================
    // 📦 ENVIAR PARTE
    // =====================================================
    if (requestedPart !== null) {

        const partFile = path.join(
            tempDir,
            `part_${(requestedPart-1).toString().padStart(3,'0')}.mp4`
        );

        if (!fs.existsSync(partFile))
            return client.sendMessage(targetJid,{text:"❌ Parte no existe."});

        await client.sendMessage(targetJid,{
            text:`📤 Enviando parte ${requestedPart}...`
        });

        await client.sendMessage(targetJid,{
            video:{url:partFile},
            caption:`🎬 ${searchTerm} - Parte ${requestedPart}`,
            mimetype:'video/mp4'
        });

        fs.unlinkSync(partFile);

        const remaining = fs.readdirSync(tempDir)
            .filter(f=>f.startsWith('part_'));

        if (!remaining.length){
            fs.rmSync(tempDir,{recursive:true,force:true});
            return client.sendMessage(targetJid,{
                text:"✅ Última parte enviada y carpeta limpiada."
            });
        }

        return client.sendMessage(targetJid,{
            text:`📦 Quedan ${remaining.length} partes`
        });
    }

    // =====================================================
    // 🔎 BUSCAR Y PROCESAR
    // =====================================================

    if (!fs.existsSync(tempDir)) {

        fs.mkdirSync(tempDir,{recursive:true});

        await client.sendMessage(targetJid,{
            text:`🔎 Buscando "${searchTerm}"...`
        });

        try{

            // API Dailymotion
            const api = `https://api.dailymotion.com/videos?search=${encodeURIComponent(searchTerm)}&limit=5&fields=id,title`;

            const {data} = await axios.get(api);

            if (!data.list?.length)
                throw "Sin resultados";

            const video = data.list[0];
            const videoUrl = `https://www.dailymotion.com/video/${video.id}`;

            await client.sendMessage(targetJid,{
                text:`🎬 Encontrado:\n${video.title}`
            });

            const localVideoPath = path.join(tempDir,'original.mp4');

            // ================================
            // 📥 DESCARGA CON PROGRESO
            // ================================

            await downloadWithProgress(
                videoUrl,
                localVideoPath,
                client,
                targetJid
            );

            // ================================
            // ✂️ CORTE CON PROGRESO
            // ================================

            await splitWithProgress(
                localVideoPath,
                path.join(tempDir,'part_%03d.mp4'),
                client,
                targetJid
            );

            fs.unlinkSync(localVideoPath);

            const parts = fs.readdirSync(tempDir)
                .filter(f=>f.startsWith('part_'));

            await client.sendMessage(targetJid,{
                text:`✅ LISTO\n📦 Partes: ${parts.length}\n\nUsa:\n!dm ${searchTerm} 1`
            });

        }catch(err){

            if (fs.existsSync(tempDir))
                fs.rmSync(tempDir,{recursive:true,force:true});

            client.sendMessage(targetJid,{
                text:"❗ Error procesando video"
            });
        }

    } else {

        const files = fs.readdirSync(tempDir)
            .filter(f=>f.startsWith('part_'));

        client.sendMessage(targetJid,{
            text:`📦 Ya procesado\nPartes restantes: ${files.length}`
        });
    }
}

module.exports = {name:'dm',execute};



// =====================================================
// 📥 DESCARGA CON PROGRESO (moderado)
// =====================================================

async function downloadWithProgress(url, output, client, jid){

    return new Promise((resolve,reject)=>{

        let lastPercent=0;
        let lastTime=0;

        client.sendMessage(jid,{text:"📥 Descargando..."});

        const ytdlp = spawn("yt-dlp",[
            url,
            "-f","best[ext=mp4]",
            "-o",output,
            "--newline",
            "--no-check-certificates"
        ]);

        ytdlp.stdout.on("data",async data=>{

            const line=data.toString();
            const match=line.match(/(\d+\.\d+)%/);

            if(!match) return;

            const percent=Math.floor(match[1]);
            const now=Date.now();

            if(percent-lastPercent>=10 || now-lastTime>10000 || percent==100){
                lastPercent=percent;
                lastTime=now;

                await client.sendMessage(jid,{
                    text:`📥 Descargando ${percent}%`
                });
            }
        });

        ytdlp.on("close",resolve);
        ytdlp.on("error",reject);
    });
}



// =====================================================
// ✂️ CORTE CON PROGRESO (moderado)
// =====================================================

async function splitWithProgress(input,out,client,jid){

    return new Promise((resolve,reject)=>{

        let lastPercent=0;

        client.sendMessage(jid,{text:"✂️ Procesando video..."});

        ffmpeg(input)
            .outputOptions([
                '-f segment',
                '-segment_time 600',
                '-reset_timestamps 1',
                '-c copy'
            ])
            .output(out)

            .on('progress',async p=>{

                if(!p.percent) return;

                const percent=Math.floor(p.percent);

                if(percent-lastPercent>=10){
                    lastPercent=percent;

                    await client.sendMessage(jid,{
                        text:`✂️ Procesando ${percent}%`
                    });
                }
            })

            .on('end',resolve)
            .on('error',reject)
            .run();
    });
}
