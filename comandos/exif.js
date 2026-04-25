const Emoji = {
  love: ['❤', '😍', '😘', '💕', '😻', '💑', '💏', '🥰'],
  happy: ['😀', '😃', '😄', '😁', '😆', '😂', '🤣', '😊'],
  sad: ['😢', '😭', '😞', '🥺'],
  angry: ['😡', '🤬', '😠'],
  greet: ['👋'],
  celebrate: ['🎉', '🎊', '🎂', '✨']
};

class Exif {
  constructor(metadata) {
    this.packname = metadata.packname;
    this.author = metadata.author;
    this.packId =
      metadata.packId || `husky.sticker.${Date.now()}`;
    this.categories = [
      (Emoji[metadata.categories] || Emoji.love)[
        Math.floor(
          Math.random() *
            (Emoji[metadata.categories] || Emoji.love).length
        )
      ],
    ];
    this.gmail =
      metadata.gmail || "huskyvps@gmail.com";
    this.webSite =
      metadata.webSite || "https://www.huskyvps.online";
    this.appstore =
      metadata.appstore || "https://www.huskyvps.online";
    this.playStore =
      metadata.playStore || "https://www.huskyvps.online";
  }

  create() {
    const json = {
      "sticker-pack-id": this.packId,
      "sticker-pack-name": this.packname,
      "sticker-pack-publisher": this.author,
      "sticker-pack-publisher-email": this.gmail,
      "sticker-pack-publisher-website": this.webSite,
      "android-app-store-link": this.appstore,
      "ios-app-store-link": this.playStore,
      emojis: this.categories,
    };

    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00,
      0x08, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x41, 0x57,
      0x07, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x16, 0x00,
      0x00, 0x00,
    ]);

    const jsonBuffer = Buffer.from(
      JSON.stringify(json),
      "utf8"
    );

    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);

    return exif;
  }
}

module.exports = { Exif };
