# 🐾 Husky-Bot v1.8 — Multi-Device 

<p align="center">
  <img src="https://telegra.ph/file/husky-logo-example.png" alt="Husky Bot Logo" width="200">
</p>

<p align="center">
<img src="https://img.shields.io/badge/Version-1.8-cyan?style=for-the-badge&logo=github" alt="v1.8">
<img src="https://img.shields.io/badge/Environment-Termux-orange?style=for-the-badge&logo=android" alt="Termux">
<img src="https://img.shields.io/badge/Language-JavaScript-yellow?style=for-the-badge&logo=javascript" alt="JS">
</p>

---

## 💎 Visualización & Estética
El **Husky-Bot** está diseñado bajo conceptos de **Glassmorphism** y **Neon Style**, priorizando una interfaz limpia y moderna en los mensajes interactivos de WhatsApp.

* **Interfaz:** Minimalista con soporte para *Rich Responses*.
* **Mensajes:** Uso de botones, listas y mensajes de sistema con formato profesional.
* **Identidad:** Basado en la agilidad y potencia del Husky.

---

## 🚀 Características Principales

### 🛠️ Automatización Avanzada
* **Baileys Library:** Conexión estable y rápida mediante EcmaScript Modules (ESM).
* **Bot de Administración:** Control total de grupos, bienvenida dinámica y baneo de usuarios.
* **Gestión de Medios:** Descarga de contenido desde YouTube (vía PyTube-AudioHub), Instagram y más.

### 🔍 Herramientas de Inteligencia & OSINT
* **Web Scraping:** Extracción de datos en tiempo real.
* **API Integration:** Conexión con WolframAlpha, Gemini y servicios de análisis de datos.
* **Seguridad:** Análisis de enlaces maliciosos y protección contra phishing.

---

## 📂 Estructura del Proyecto

| Carpeta | Descripción |
| :--- | :--- |
| `comandos/` | Corazón del bot. Contiene todos los módulos `.js` de interacción. |
| `lib/` | Librerías personalizadas, bases de datos JSON y funciones auxiliares. |
| `media/` | Almacenamiento temporal de imágenes, audios y stickers. |
| `bin/` | Binarios y herramientas externas de soporte. |

---

## ⚡ Instalación en Termux

```bash
git clone [https://github.com/User04072024/Husky-bot](https://github.com/User04072024/Husky-bot)
cd Husky-bot
npm install
node bot.js
