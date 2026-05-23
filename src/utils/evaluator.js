// =====================================================================
// Motor de evaluación de español rioplatense para respuestas de IA.
// Reglas heurísticas: léxico regional, voseo, tono robótico, modismos
// y precisión semántica. Devuelve score, errores y respuesta sugerida.
// =====================================================================

// --- Vocabulario no rioplatense -> equivalente local ---
const LEXICO_NO_LOCAL = [
  { patron: /\bcita(s)?\b/gi,                local: 'turno$1',      categoria: 'Léxico regional', severidad: 8,  ctx: 'médico|doctor|consulta|odontólogo|kinesiólogo', explica: '"Cita" suena a español neutro. En el Río de la Plata se dice "turno" cuando se trata de una consulta médica o profesional.' },
  { patron: /\bcoger\b/gi,                   local: 'tomar',        categoria: 'Falsos amigos',    severidad: 12, explica: '"Coger" tiene una connotación vulgar en el Río de la Plata. Se debe reemplazar por "tomar", "agarrar" o "subirse a".' },
  { patron: /\bordenador(es)?\b/gi,          local: 'computadora$1', categoria: 'Léxico regional', severidad: 8,  explica: '"Ordenador" es el término ibérico. En Argentina y Uruguay se dice "computadora".' },
  { patron: /\bmóvil(es)?\b/gi,              local: 'celular$1',    categoria: 'Léxico regional', severidad: 7,  explica: '"Móvil" es ibérico. En el Río de la Plata se usa "celular".' },
  { patron: /\bautobús(es)?\b/gi,            local: 'colectivo$1',  categoria: 'Léxico regional', severidad: 7,  explica: '"Autobús" no es de uso corriente. En registro formal se dice "colectivo"; en informal, "bondi".' },
  { patron: /\btenis\b/gi,                   local: 'zapatillas',   categoria: 'Léxico regional', severidad: 6,  explica: '"Tenis" como calzado es mexicano/centroamericano. En el Río de la Plata se dice "zapatillas" o, coloquialmente, "zapas".' },
  { patron: /\bvale\b/gi,                    local: 'dale',         categoria: 'Modismos',         severidad: 5,  explica: '"Vale" como muletilla es ibérica. La equivalencia rioplatense es "dale" o "listo".' },
  { patron: /\bguay\b/gi,                    local: 'copado',       categoria: 'Modismos',         severidad: 5,  explica: '"Guay" es ibérico. En rioplatense se usa "copado", "groso" o "bárbaro".' },
  { patron: /\bestupendo\b/gi,               local: 'bárbaro',      categoria: 'Modismos',         severidad: 5,  explica: '"Estupendo" suena ibérico o muy formal. En el Río de la Plata: "bárbaro", "genial", "una masa".' },
  { patron: /\btíos?\b/gi,                   local: 'chicos',       categoria: 'Modismos',         severidad: 5,  explica: '"Tío/tía" como vocativo es ibérico. En rioplatense: "che", "flaco/flaca", "loco" o "boludo" (informal).' },
  { patron: /\bmajos?\b/gi,                  local: 'buena onda',   categoria: 'Modismos',         severidad: 5,  explica: '"Majo" es ibérico. En rioplatense se traduce como "buena onda" o "copado".' },
  { patron: /\bvosotros\b/gi,                local: 'ustedes',      categoria: 'Voseo / Tuteo',    severidad: 9,  explica: '"Vosotros" no se usa en el Río de la Plata. El plural de segunda persona es siempre "ustedes".' },
  { patron: /\bpulsa\b/gi,                   local: 'apretá',       categoria: 'Léxico regional', severidad: 5,  explica: '"Pulsar" suena ibérico o muy formal. En rioplatense: "apretá", "presioná" o "tocá".' },
  { patron: /\bcoche(s)?\b/gi,               local: 'auto$1',       categoria: 'Léxico regional', severidad: 6,  explica: '"Coche" es ibérico. En el Río de la Plata se dice "auto".' },
  { patron: /\bzumo(s)?\b/gi,                local: 'jugo$1',       categoria: 'Léxico regional', severidad: 6,  explica: '"Zumo" es ibérico. En el Río de la Plata se dice "jugo".' },
  { patron: /\bpiscina(s)?\b/gi,             local: 'pileta$1',     categoria: 'Léxico regional', severidad: 4,  explica: 'Aunque "piscina" se entiende, en registro local se usa "pileta".' },
];

// --- Detección de tuteo / voseo ---
const TUTEO_PRONOMBRES = [
  { patron: /\btú\b/gi,        reemplazo: 'vos',      explica: 'Uso del pronombre "tú". En español rioplatense se usa "vos" (voseo).' },
  { patron: /\bcontigo\b/gi,   reemplazo: 'con vos',  explica: '"Contigo" no se usa en rioplatense. Se dice "con vos".' },
  { patron: /\bti\b/gi,        reemplazo: 'vos',      explica: '"Ti" no se usa en rioplatense. Se dice "vos" (ej.: "para vos", no "para ti").' },
];

// Conjugaciones de tuteo -> voseo
const TUTEO_CONJUGACIONES = [
  { patron: /\b(tú\s+)?tienes\b/gi,    reemplazo: 'tenés',  explica: '"Tienes" es tuteo. En voseo: "vos tenés".' },
  { patron: /\b(tú\s+)?eres\b/gi,      reemplazo: 'sos',    explica: '"Eres" es tuteo. En voseo: "vos sos".' },
  { patron: /\b(tú\s+)?quieres\b/gi,   reemplazo: 'querés', explica: '"Quieres" es tuteo. En voseo: "vos querés".' },
  { patron: /\b(tú\s+)?puedes\b/gi,    reemplazo: 'podés',  explica: '"Puedes" es tuteo. En voseo: "vos podés".' },
  { patron: /\b(tú\s+)?sabes\b/gi,     reemplazo: 'sabés',  explica: '"Sabes" es tuteo. En voseo: "vos sabés".' },
  { patron: /\b(tú\s+)?dices\b/gi,     reemplazo: 'decís',  explica: '"Dices" es tuteo. En voseo: "vos decís".' },
  { patron: /\b(tú\s+)?haces\b/gi,     reemplazo: 'hacés',  explica: '"Haces" es tuteo. En voseo: "vos hacés".' },
  { patron: /\b(tú\s+)?vienes\b/gi,    reemplazo: 'venís',  explica: '"Vienes" es tuteo. En voseo: "vos venís".' },
  { patron: /\b(tú\s+)?vives\b/gi,     reemplazo: 'vivís',  explica: '"Vives" es tuteo. En voseo: "vos vivís".' },
  { patron: /\b(tú\s+)?escoges\b/gi,   reemplazo: 'elegís', explica: '"Escoges" es tuteo y poco rioplatense. En voseo: "vos elegís".' },
  { patron: /\b(tú\s+)?deseas\b/gi,    reemplazo: 'querés', explica: '"Deseas" suena formal/neutro. En rioplatense informal: "querés".' },
  { patron: /\b(tú\s+)?has\s+estado\b/gi, reemplazo: 'estuviste', explica: '"Has estado" (pretérito perfecto compuesto) es poco frecuente en el Río de la Plata. Se prefiere el pretérito simple: "estuviste".' },
  // Imperativos
  { patron: /\bespera\b/gi,            reemplazo: 'esperá', explica: 'El imperativo voseante es "esperá", no "espera".' },
  { patron: /\bmira\b/gi,              reemplazo: 'mirá',   explica: 'El imperativo voseante es "mirá", no "mira".' },
  { patron: /\bdime\b/gi,              reemplazo: 'decime', explica: 'El imperativo voseante es "decime", no "dime".' },
  { patron: /\bven\b/gi,               reemplazo: 'vení',   explica: 'El imperativo voseante es "vení", no "ven".' },
  { patron: /\bhabla\b/gi,             reemplazo: 'hablá',  explica: 'El imperativo voseante es "hablá", no "habla".' },
];

// Mezcla incorrecta: "vos tienes", "vos puedes", etc.
const MEZCLA_VOSEO_TUTEO = [
  { patron: /\bvos\s+tienes\b/gi,   reemplazo: 'vos tenés',  explica: 'Mezcla incorrecta: "vos" requiere conjugación voseante. Se dice "vos tenés", no "vos tienes".' },
  { patron: /\bvos\s+eres\b/gi,     reemplazo: 'vos sos',    explica: 'Mezcla incorrecta: con "vos" se conjuga "sos", no "eres".' },
  { patron: /\bvos\s+puedes\b/gi,   reemplazo: 'vos podés',  explica: 'Mezcla incorrecta: con "vos" se conjuga "podés", no "puedes".' },
  { patron: /\bvos\s+quieres\b/gi,  reemplazo: 'vos querés', explica: 'Mezcla incorrecta: con "vos" se conjuga "querés", no "quieres".' },
  { patron: /\bvos\s+sabes\b/gi,    reemplazo: 'vos sabés',  explica: 'Mezcla incorrecta: con "vos" se conjuga "sabés", no "sabes".' },
];

// --- Tono robótico / IA poco natural ---
const FRASES_ROBOTICAS = [
  { patron: /\bcomo\s+modelo\s+de\s+lenguaje\b/gi,         explica: 'Frase típica de IA. Rompe la inmersión y no se adapta a la variante local.' },
  { patron: /\bsoy\s+un\s+modelo\s+de\s+lenguaje\b/gi,     explica: 'Presentación robótica. Una IA bien ajustada al rioplatense debería sonar más cercana.' },
  { patron: /\bestoy\s+aquí\s+para\s+ayudarte\b/gi,        explica: 'Frase típica de asistente neutro. En rioplatense suena más natural "estoy para darte una mano" o "contá conmigo".' },
  { patron: /\bno\s+dudes\s+en\s+consultar(me|nos)?\b/gi,  explica: 'Calco de manual de soporte. En rioplatense se prefiere "cualquier cosa me decís" o "preguntame lo que necesites".' },
  { patron: /\bel\s+día\s+de\s+hoy\b/gi,                   explica: 'Pleonasmo común en respuestas de IA. Basta con "hoy".' },
  { patron: /\blamento\s+la\s+confusión\b/gi,              explica: 'Fórmula calcada del inglés ("I apologize for the confusion"). En rioplatense: "disculpá la confusión" o "perdón por la confusión".' },
  { patron: /\bpor\s+favor,?\s+ten(ga)?\s+en\s+cuenta\b/gi, explica: 'Calco rígido. En rioplatense: "tené en cuenta que…" (voseo) o simplemente "ojo que…".' },
  { patron: /\besp(é|e)ro\s+haber\s+sido\s+de\s+ayuda\b/gi, explica: 'Cierre robótico. En rioplatense suena más natural "espero que te sirva" o "cualquier cosa avisame".' },
];

// --- Modismos rioplatenses (presencia esperada en tonos informales) ---
const MODISMOS_RIOPLATENSES = [
  'che', 'dale', 'posta', 'bárbaro', 'copado', 'groso', 'laburo', 'laburar',
  'quilombo', 'bondi', 'mango', 'mangos', 'guita', 'pibe', 'piba', 'flaco', 'flaca',
  'boludo', 'boluda', 'zapas', 'zarpado', 'banda', 'mina', 'fiaca', 'chamuyo',
  'data', 'birra', 'pucho', 'mate', 'fideos', 'matear'
];

// Modismos mal empleados en tonos formales (penalización suave)
const MODISMOS_PROHIBIDOS_FORMAL = ['boludo', 'boluda', 'quilombo', 'pibe', 'piba', 'guita', 'laburo', 'bondi', 'zapas'];

// =====================================================================
// Helpers
// =====================================================================

function findAll(text, regex) {
  const results = [];
  let m;
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  while ((m = re.exec(text)) !== null) {
    results.push({ match: m[0], index: m.index });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return results;
}

function detectaContexto(texto, ctxPatron) {
  if (!ctxPatron) return true;
  return new RegExp(ctxPatron, 'i').test(texto);
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

// =====================================================================
// Evaluador principal
// =====================================================================

export function evaluarRespuesta({ prompt = '', respuesta = '', variante = 'rioplatense general', tono = 'cotidiano' }) {
  const errores = [];
  let respuestaSugerida = respuesta;

  // -- 1. Léxico no local
  for (const regla of LEXICO_NO_LOCAL) {
    const matches = findAll(respuesta, regla.patron);
    if (matches.length === 0) continue;
    if (!detectaContexto(prompt + ' ' + respuesta, regla.ctx)) continue;

    errores.push({
      categoria: regla.categoria,
      severidad: regla.severidad,
      fragmento: [...new Set(matches.map(m => m.match))].join(', '),
      explicacion: regla.explica,
      sugerencia: regla.local.replace(/\$1/g, ''),
    });
    respuestaSugerida = respuestaSugerida.replace(regla.patron, regla.local);
  }

  // -- 2. Tuteo: pronombres
  for (const regla of TUTEO_PRONOMBRES) {
    const matches = findAll(respuesta, regla.patron);
    if (matches.length === 0) continue;
    errores.push({
      categoria: 'Voseo / Tuteo',
      severidad: 10,
      fragmento: [...new Set(matches.map(m => m.match))].join(', '),
      explicacion: regla.explica,
      sugerencia: regla.reemplazo,
    });
    respuestaSugerida = respuestaSugerida.replace(regla.patron, regla.reemplazo);
  }

  // -- 3. Conjugaciones de tuteo (sólo si no es contexto formal de "usted")
  const usaUsted = /\busted(es)?\b/i.test(respuesta);
  if (!usaUsted) {
    for (const regla of TUTEO_CONJUGACIONES) {
      const matches = findAll(respuestaSugerida, regla.patron);
      if (matches.length === 0) continue;
      errores.push({
        categoria: 'Conjugación voseante',
        severidad: 8,
        fragmento: [...new Set(matches.map(m => m.match.trim()))].join(', '),
        explicacion: regla.explica,
        sugerencia: regla.reemplazo,
      });
      respuestaSugerida = respuestaSugerida.replace(regla.patron, regla.reemplazo);
    }
  }

  // -- 4. Mezcla incorrecta voseo + tuteo
  for (const regla of MEZCLA_VOSEO_TUTEO) {
    const matches = findAll(respuesta, regla.patron);
    if (matches.length === 0) continue;
    errores.push({
      categoria: 'Inconsistencia voseo/tuteo',
      severidad: 12,
      fragmento: [...new Set(matches.map(m => m.match))].join(', '),
      explicacion: regla.explica,
      sugerencia: regla.reemplazo,
    });
    respuestaSugerida = respuestaSugerida.replace(regla.patron, regla.reemplazo);
  }

  // -- 5. Tono robótico
  for (const regla of FRASES_ROBOTICAS) {
    const matches = findAll(respuesta, regla.patron);
    if (matches.length === 0) continue;
    errores.push({
      categoria: 'Tono robótico',
      severidad: 9,
      fragmento: matches[0].match,
      explicacion: regla.explica,
      sugerencia: '(reescribir con tono más natural y cercano)',
    });
  }

  // -- 6. Modismos según tono
  const tonoInformal = ['informal', 'cotidiano'].includes(tono);
  const tonoFormal   = ['formal', 'laboral', 'técnico'].includes(tono);
  const respuestaLower = ' ' + respuesta.toLowerCase() + ' ';

  const modismosUsados = MODISMOS_RIOPLATENSES.filter(m => new RegExp(`\\b${m}\\b`, 'i').test(respuestaLower));
  const modismosProhibidosUsados = MODISMOS_PROHIBIDOS_FORMAL.filter(m => new RegExp(`\\b${m}\\b`, 'i').test(respuestaLower));

  if (tonoInformal && modismosUsados.length === 0 && respuesta.length > 40) {
    errores.push({
      categoria: 'Falta de naturalidad',
      severidad: 7,
      fragmento: '(respuesta completa)',
      explicacion: `El tono esperado es "${tono}", pero la respuesta no contiene marcadores rioplatenses ("che", "dale", "bárbaro", "laburo", etc.). Suena demasiado neutra para el registro pedido.`,
      sugerencia: 'Incorporar al menos uno o dos modismos locales coherentes con el contexto.',
    });
  }

  if (tonoFormal && modismosProhibidosUsados.length > 0) {
    errores.push({
      categoria: 'Registro inadecuado',
      severidad: 8,
      fragmento: modismosProhibidosUsados.join(', '),
      explicacion: `El tono esperado es "${tono}", pero la respuesta usa modismos informales (${modismosProhibidosUsados.join(', ')}) que no corresponden a este registro.`,
      sugerencia: 'Reemplazar por términos neutros sin perder el voseo (ej.: "trabajo" en vez de "laburo").',
    });
  }

  // -- 7. Longitud / precisión semántica básica
  if (respuesta.trim().length > 0 && respuesta.trim().length < 15) {
    errores.push({
      categoria: 'Precisión semántica',
      severidad: 5,
      fragmento: '(respuesta muy corta)',
      explicacion: 'La respuesta es muy breve para evaluar precisión semántica. Considerar si responde lo solicitado en el prompt.',
      sugerencia: 'Ampliar la respuesta con información útil al usuario.',
    });
  }

  // Detectar si la respuesta parece no abordar el prompt (heurística simple)
  if (prompt && respuesta) {
    const palabrasPrompt = prompt.toLowerCase().match(/\b[a-záéíóúñü]{5,}\b/g) || [];
    const respLower = respuesta.toLowerCase();
    const coincidencias = palabrasPrompt.filter(p => respLower.includes(p)).length;
    if (palabrasPrompt.length >= 4 && coincidencias === 0) {
      errores.push({
        categoria: 'Precisión semántica',
        severidad: 6,
        fragmento: '(baja relación con el prompt)',
        explicacion: 'La respuesta no parece guardar relación léxica con el prompt. Verificar si está respondiendo lo solicitado.',
        sugerencia: 'Asegurarse de que la respuesta aborde explícitamente el tema del prompt.',
      });
    }
  }

  // =====================================================================
  // Cálculo de puntaje
  // =====================================================================
  let score = 100;
  for (const e of errores) score -= e.severidad;

  // Bonus / ajustes
  if (tonoInformal && modismosUsados.length > 0 && modismosUsados.length <= 4) score += 4;
  if (tonoFormal && modismosUsados.length === 0 && errores.length === 0) score += 2;

  // Ajuste leve según variante (sin gran impacto, demo)
  if (variante === 'Uruguay' && /\btá\b|\bbo\b/i.test(respuesta)) score += 2; // marcadores uruguayos

  score = clamp(Math.round(score), 0, 100);

  // =====================================================================
  // Recomendación para el modelo
  // =====================================================================
  const categoriasUnicas = [...new Set(errores.map(e => e.categoria))];
  let recomendacion;

  if (errores.length === 0) {
    recomendacion = 'La respuesta es naturalmente rioplatense y coherente con el tono pedido. Para seguir mejorando, ampliar la base de datos de entrenamiento con más diálogos auténticos del Río de la Plata.';
  } else {
    const partes = [];
    if (categoriasUnicas.includes('Voseo / Tuteo') || categoriasUnicas.includes('Conjugación voseante') || categoriasUnicas.includes('Inconsistencia voseo/tuteo')) {
      partes.push('reforzar el fine-tuning con corpus voseante (vos → tenés, sos, querés, podés) y penalizar formas tuteantes en variantes rioplatenses');
    }
    if (categoriasUnicas.includes('Léxico regional') || categoriasUnicas.includes('Falsos amigos')) {
      partes.push('ampliar el diccionario léxico regional con pares ibérico/rioplatense (cita→turno, ordenador→computadora, coger→tomar)');
    }
    if (categoriasUnicas.includes('Tono robótico')) {
      partes.push('reducir frases prefabricadas de asistente ("como modelo de lenguaje…", "estoy aquí para ayudarte…") mediante RLHF con anotadores locales');
    }
    if (categoriasUnicas.includes('Modismos') || categoriasUnicas.includes('Falta de naturalidad')) {
      partes.push('incorporar modismos rioplatenses de uso frecuente (che, dale, bárbaro, laburo) controlando por tono y registro');
    }
    if (categoriasUnicas.includes('Registro inadecuado')) {
      partes.push('mejorar el control de registro: cuando el tono es formal/laboral, evitar coloquialismos demasiado marcados');
    }
    if (categoriasUnicas.includes('Precisión semántica')) {
      partes.push('reforzar la alineación entre prompt y respuesta para que el modelo siempre aborde lo solicitado');
    }
    recomendacion = 'Para mejorar el modelo se sugiere: ' + partes.join('; ') + '.';
  }

  // Si la respuesta sugerida quedó igual a la original pero hay errores de tono,
  // dejamos pista al usuario.
  if (respuestaSugerida === respuesta && errores.length > 0) {
    respuestaSugerida = respuesta + '\n\n[Nota: además de los reemplazos automáticos, se recomienda reescribir esta respuesta con tono más natural rioplatense.]';
  }

  return {
    score,
    errores,
    respuestaSugerida: respuestaSugerida.trim(),
    recomendacion,
    resumen: {
      totalErrores: errores.length,
      categorias: categoriasUnicas,
      modismosDetectados: modismosUsados,
    }
  };
}
