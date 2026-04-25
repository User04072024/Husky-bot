// ── ~/whatsapp-bot-new/lib/token.js ──────────────────────────────────────────
// Tokenizador de sintaxis para bloques de código (Meta AI Rich Message)
// Uso: const { buildCodeBlocksFromString, mapHighlightTypeToUnified } = require('../lib/token');
// ─────────────────────────────────────────────────────────────────────────────

const KEYWORD_HIGHLIGHT = 1;
const COMMENT_HIGHLIGHT = 2;
const STRING_HIGHLIGHT  = 3;
const NUMBER_HIGHLIGHT  = 4;

// Detecta: comentarios, keywords JS/TS/Python/Java/C++, números y strings
const TOKEN_REGEX = /\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|\b(?:async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|yield|def|elif|print|pass|lambda|with|as|not|and|or|is|public|private|protected|int|float|string|bool|boolean|double|long|short|char|byte|abstract|final|interface|implements|enum|package|throws|override)\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|(["'`])(?:\\.|(?!\1)[\s\S])*?\1/g;

/**
 * Determina el tipo de highlight de un token ya reconocido
 * @param {string} token
 * @returns {number} tipo de highlight
 */
function getHighlightType(token) {
  if (/^(?:\/\/|#|\/\*)/.test(token)) return COMMENT_HIGHLIGHT;
  if (/^["'`]/.test(token))           return STRING_HIGHLIGHT;
  if (/^\d/.test(token))              return NUMBER_HIGHLIGHT;
  return KEYWORD_HIGHLIGHT;
}

/**
 * Divide un bloque de código en segmentos con su tipo de resaltado.
 * Los segmentos sin tipo especial (espacios, operadores, etc.) se devuelven
 * con highlightType = 0 (PLAIN).
 *
 * @param {string} codeText  Código fuente como string
 * @returns {{ codeContent: string, highlightType: number }[]}
 */
function buildCodeBlocksFromString(codeText) {
  const text   = String(codeText || '');
  const blocks = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TOKEN_REGEX)) {
    const token = match[0];
    const index = match.index ?? 0;

    // Texto plano entre tokens
    if (index > lastIndex) {
      blocks.push({
        codeContent:   text.slice(lastIndex, index),
        highlightType: 0,
      });
    }

    blocks.push({
      codeContent:   token,
      highlightType: getHighlightType(token),
    });

    lastIndex = index + token.length;
  }

  // Resto del texto después del último token
  if (lastIndex < text.length) {
    blocks.push({
      codeContent:   text.slice(lastIndex),
      highlightType: 0,
    });
  }

  return blocks.length ? blocks : [{ codeContent: text, highlightType: 0 }];
}

/**
 * Convierte el número de tipo a string unificado para el proto de WhatsApp
 * @param {number} highlightType
 * @returns {'PLAIN'|'KEYWORD'|'COMMENT'|'STR'|'NUMBER'}
 */
function mapHighlightTypeToUnified(highlightType) {
  switch (highlightType) {
    case KEYWORD_HIGHLIGHT: return 'KEYWORD';
    case COMMENT_HIGHLIGHT: return 'COMMENT';
    case STRING_HIGHLIGHT:  return 'STR';
    case NUMBER_HIGHLIGHT:  return 'NUMBER';
    default:                return 'PLAIN';
  }
}

module.exports = {
  buildCodeBlocksFromString,
  mapHighlightTypeToUnified,
  getHighlightType,
  // Constantes por si las necesitas fuera
  KEYWORD_HIGHLIGHT,
  COMMENT_HIGHLIGHT,
  STRING_HIGHLIGHT,
  NUMBER_HIGHLIGHT,
};

