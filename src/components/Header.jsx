export default function Header() {
  return (
    <header className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-600 via-brand-700 to-accent-600 opacity-95" />
      <div className="absolute inset-0 -z-10 opacity-30"
           style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.2), transparent 40%)' }} />
      <div className="max-w-6xl mx-auto px-6 py-12 sm:py-16 text-white">
        <div className="flex items-center gap-3 text-white/80 text-sm font-medium mb-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 backdrop-blur border border-white/20 font-bold">ñ</span>
          <span>Demo · Formador en IA</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
          Evaluador de Español Rioplatense para IA
        </h1>
        <p className="mt-4 max-w-3xl text-white/90 text-base sm:text-lg leading-relaxed">
          Analiza respuestas generadas por modelos de lenguaje y detecta errores de español rioplatense:
          uso de tuteo, vocabulario no local, tono robótico, modismos mal empleados y problemas de naturalidad.
          Pensado como herramienta de apoyo para anotadores y formadores de IA.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white/15 border border-white/20 px-3 py-1">Voseo</span>
          <span className="rounded-full bg-white/15 border border-white/20 px-3 py-1">Léxico regional</span>
          <span className="rounded-full bg-white/15 border border-white/20 px-3 py-1">Tono y registro</span>
          <span className="rounded-full bg-white/15 border border-white/20 px-3 py-1">Modismos</span>
          <span className="rounded-full bg-white/15 border border-white/20 px-3 py-1">Precisión semántica</span>
        </div>
      </div>
    </header>
  )
}
