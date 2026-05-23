// ============================================================================
// Post-procesador "argentinizador"
//
// Toma texto generado por la IA y reemplaza palabras/expresiones no porteñas
// por sus equivalentes bonaerenses. Funciona como red de seguridad por si el
// modelo se desvía a español neutro o ibérico.
//
// La tabla de reemplazos vive en lexico-rioplatense.js (fuente única de verdad
// que también consume el evaluator).
//
// Soporta `contextoNeg`: si el patrón matchea pero el contexto negativo también,
// no se aplica el reemplazo (evita falsos positivos).
// ============================================================================

import { REEMPLAZOS_RIOPLATENSES } from './lexico-rioplatense.js'

export function argentinizar(texto) {
  if (!texto) return texto
  let out = texto
  for (const regla of REEMPLAZOS_RIOPLATENSES) {
    if (regla.contextoNeg && regla.contextoNeg.test(out)) continue
    out = out.replace(regla.patron, regla.reemplazo)
  }
  return out
}

// Helper para tests / debug: aplica una sola regla y devuelve qué cambió
export function argentinizarDebug(texto) {
  if (!texto) return { resultado: texto, cambios: [] }
  let out = texto
  const cambios = []
  for (const regla of REEMPLAZOS_RIOPLATENSES) {
    if (regla.contextoNeg && regla.contextoNeg.test(out)) continue
    const before = out
    out = out.replace(regla.patron, regla.reemplazo)
    if (before !== out) {
      cambios.push({ categoria: regla.categoria, explicacion: regla.explicacion })
    }
  }
  return { resultado: out, cambios }
}
