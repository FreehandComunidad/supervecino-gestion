"use client"

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bot, Send, Sparkles, ShieldCheck, LoaderCircle, RotateCcw } from 'lucide-react'

type Message = { role: 'user' | 'assistant'; content: string }
const starters = [
  'Dame un resumen de cómo está el negocio hoy.',
  '¿Qué productos están por debajo del stock mínimo?',
  'Analizá las ventas de los últimos 30 días.',
  '¿Qué compras o facturas necesitan atención?',
  '¿Qué productos tienen un margen más bajo?'
]

export default function CentralAssistant() {
  const db = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function send(text = draft) {
    const prompt = text.trim()
    if (!prompt || busy) return
    setDraft('')
    setError('')
    const next = [...messages, { role: 'user' as const, content: prompt }]
    setMessages(next)
    setBusy(true)
    try {
      const { data: sessionData, error: sessionError } = await db.auth.getSession()
      if (sessionError) throw sessionError
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Tu sesión venció. Volvé a ingresar al sistema.')
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ messages: next.slice(-12) })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo consultar al asistente.')
      setMessages(current => [...current, { role: 'assistant', content: result.reply }])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error al consultar.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="assistant-shell">
    <header className="assistant-hero">
      <div className="assistant-orb"><Bot size={30}/></div>
      <div><span className="assistant-kicker">SÚPERVECINO · INTELIGENCIA COMERCIAL</span><h1>Asistente central</h1><p>Tu copiloto para entender el negocio, anticipar problemas y preparar decisiones.</p></div>
    </header>
    <div className="assistant-safety"><ShieldCheck size={17}/><span><b>Autonomía limitada</b> · Consulta datos reales y prepara recomendaciones. En esta primera etapa no modifica stock, precios, compras ni caja.</span></div>
    <section className="assistant-chat">
      <div className="assistant-chat-head"><div><Sparkles size={18}/><b>¿Qué necesitás saber?</b></div><button className="secondary" onClick={()=>{setMessages([]);setError('')}} disabled={!messages.length||busy}><RotateCcw size={15}/> Nueva consulta</button></div>
      <div className="assistant-messages">
        {!messages.length && <div className="assistant-welcome"><Bot size={34}/><h2>Hola. Soy el asistente de SÚPERVECINO.</h2><p>Puedo analizar ventas, inventario, márgenes, compras y cierres de caja usando los datos de tu sistema.</p><div className="assistant-starters">{starters.map(s=><button key={s} onClick={()=>void send(s)} disabled={busy}>{s}</button>)}</div></div>}
        {messages.map((m,i)=><article key={i} className={'assistant-message '+m.role}><span>{m.role==='user'?'Vos':'Asistente central'}</span><p>{m.content}</p></article>)}
        {busy && <article className="assistant-message assistant"><span>Asistente central</span><p className="assistant-thinking"><LoaderCircle size={16}/> Estoy revisando los datos del negocio…</p></article>}
      </div>
      {error && <p className="assistant-error">{error}</p>}
      <form className="assistant-compose" onSubmit={e=>{e.preventDefault();void send()}}>
        <textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Preguntame por ventas, stock, rentabilidad, compras…" rows={2} maxLength={2000}/>
        <button className="primary" disabled={busy||!draft.trim()}>{busy?'Analizando…':'Enviar'} <Send size={16}/></button>
      </form>
      <p className="assistant-disclaimer">Las recomendaciones son apoyo para decidir. Verificá importes y condiciones antes de ejecutar operaciones comerciales.</p>
    </section>
  </main>
}
