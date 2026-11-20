"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, ArrowRight, LockKeyhole, Sparkles, Trophy, PartyPopper, KeyRound, BookOpen, Lightbulb } from 'lucide-react'

const stages = [
  { number: 1, title: 'Cámara que perdió RA', level: 'INICIO', clue: 'Cámara que perdió RA, vecino: ¿dónde duermo?', answer: 'CAMA',
    hints: { definition: 'La definición pregunta por el lugar donde descansás por la noche.', indicator: '«Perdió» indica que hay que quitar letras.', material: 'El material es CÁMARA: un dispositivo para tomar fotografías.' },
    parts: { material: ['Cámara', 'RA'], indicator: ['perdió'], definition: ['¿dónde duermo?'] } },
  { number: 2, title: 'El lugar indicado', level: 'NIVEL 02', clue: 'A principios de 2892, encontré por fin el lugar indicado.', answer: 'DONDE',
    hints: { definition: 'La definición es «el lugar indicado».', indicator: '«A principios» y «por fin» señalan que tomes letras iniciales y finales.', material: 'Los números se leen en palabras: dos, ocho, nueve, dos. Sumá la última letra de encontré.' },
    parts: { material: ['2892', 'encontré'], indicator: ['principios', 'por fin'], definition: ['el lugar indicado'] } },
  { number: 3, title: 'El dios más humano', level: 'NIVEL 03', clue: 'Pacífico la cabeza del agua y una masa redonda frita. Es el dios más humano de todos.', answer: 'MARADONA',
    hints: { definition: 'La definición es «el dios más humano de todos».', indicator: '«La cabeza» pide tomar la primera letra de la palabra siguiente.', material: 'Pacífico aporta MAR; agua aporta A; una masa redonda frita es una DONA.' },
    parts: { material: ['Pacífico', 'agua', 'masa redonda frita'], indicator: ['la cabeza'], definition: ['Es el dios más humano de todos'] } },
  { number: 4, title: 'Cuarto desafío', level: 'NIVEL 04', clue: 'Un nuevo enigma te espera.', answer: '' },
  { number: 5, title: 'Casi al final', level: 'NIVEL 05', clue: 'Un último enigma antes del gran cierre.', answer: '' },
  { number: 6, title: 'El gran final', level: 'DESAFÍO FINAL', clue: 'La respuesta final guarda una sorpresa.', answer: '' },
]

const mechanisms = [
  { title: 'Anagramas', description: 'Las letras de una palabra o grupo de palabras se reordenan para formar la solución.', indicators: 'revuelto · mezclado · desordenado · confuso · agitado · hecho un lío' },
  { title: 'Palabras ocultas', description: 'La solución aparece como una secuencia continua de letras dentro de otra palabra o frase presente en la pista.', indicators: 'oculto en · escondido en · dentro de · parte de · entre' },
  { title: 'Bifrontes', description: 'La solución se obtiene leyendo una palabra o secuencia de letras al revés.', indicators: 'al revés · vuelto · de espaldas · invertido · reflejado' },
  { title: 'Homófonos', description: 'La solución es una palabra que suena igual o muy similar a otra mencionada en la pista.', indicators: 'se oye · suena · al oído · en voz alta' },
  { title: 'Sinónimos', description: 'La solución se obtiene sustituyendo una palabra por otra de significado equivalente.' },
]

function HowToPlay() {
  return <section className="birthday-guide" id="como-jugar">
    <div className="birthday-guide-heading"><BookOpen size={20}/><div><span className="birthday-kicker">GUÍA PARA PRINCIPIANTES</span><h2>¿Cómo se juega?</h2></div></div>
    <p className="birthday-guide-intro">No hace falta que hayas resuelto un críptico antes. Leé esta guía y vas a tener las herramientas para empezar.</p>
    <div className="birthday-guide-callout"><b>La clave está en entender dos partes</b><p>Las pistas crípticas tienen una <strong>definición directa</strong> de la respuesta y un <strong>mecanismo</strong> que te permite construirla. La frase completa está diseñada para despistarte: suena como una frase cotidiana, pero puede esconder un juego de palabras.</p></div>
    <h3>Anatomía de una pista</h3>
    <div className="birthday-guide-parts">
      <div><span className="guide-tag definition">DEFINICIÓN</span><p>Descripción directa de la solución. Suele estar al principio o al final de la frase.</p></div>
      <div><span className="guide-tag mechanism">MECANISMO</span><p>El juego de palabras que te permite construir la respuesta.</p></div>
      <div><span className="guide-tag indicator">INDICADOR</span><p>Palabra que señala qué tipo de mecanismo hay que aplicar.</p></div>
    </div>
    <p className="birthday-guide-note">La superficie es cómo suena la pista entera. Parece una frase cotidiana que no tiene nada que ver con la solución. ¡No te quedes solamente con la lectura literal!</p>
    <h3>Tipos de mecanismo</h3>
    <div className="birthday-mechanisms">{mechanisms.map(item=><article key={item.title}><h4>{item.title}</h4><p>{item.description}</p>{item.indicators&&<><span className="birthday-guide-subtitle">INDICADORES TÍPICOS</span><div className="birthday-indicators">{item.indicators.split(' · ').map(word=><span key={word}>{word}</span>)}</div></>}</article>)}</div>
    <h3>Intentos y puntos</h3>
    <div className="birthday-guide-callout"><ul><li>Tenés <strong>5 intentos</strong> para resolver cada desafío.</li><li>Si acertás en el primer intento, sumás <strong>100 puntos</strong>.</li><li>Cada intento adicional resta 10 puntos, hasta un mínimo de <strong>60 puntos</strong>.</li><li>Las pistas de ayuda descuentan <strong>10 puntos cada una</strong>.</li></ul></div>
    <h3>Tipos de ayuda</h3>
    <p className="birthday-guide-intro">Durante el juego pueden aparecer pistas de definición, indicador, material y letra. En la modalidad de referencia, una cuenta permite usar hasta tres pistas de cada tipo por semana; cada pista utilizada resta 10 puntos. La modalidad Críptico Club no tiene ese límite.</p>
    <div className="birthday-guide-tip"><Lightbulb size={18}/><p><b>Consejo:</b> primero buscá qué parte de la frase podría definir la respuesta. Después identificá el indicador y probá el mecanismo que te está sugiriendo.</p></div>
  </section>
}

export default function CumplePage() {
  const [started, setStarted] = useState(false)
  const [player, setPlayer] = useState('')
  const [activeStage, setActiveStage] = useState(1)
  const [answer, setAnswer] = useState('')
  const [notice, setNotice] = useState('')
  const [completed, setCompleted] = useState<number[]>([])
  const [showGuide, setShowGuide] = useState(false)
  const [activeTab, setActiveTab] = useState<'today' | 'ranking'>('today')
  const [leaderboard, setLeaderboard] = useState<{id:string;display_name:string;points:number}[]>([])
  const [registering, setRegistering] = useState(false)
  const [registrationError, setRegistrationError] = useState('')
  const [totalPoints, setTotalPoints] = useState(0)
  const [pointsByStage, setPointsByStage] = useState<Record<number, number>>({})
  const [attemptsByStage, setAttemptsByStage] = useState<Record<number, number>>({})
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [revealedLetters, setRevealedLetters] = useState<Record<number, number>>({})
  const [visibleHints, setVisibleHints] = useState<Record<number, string[]>>({})
  const [hintsByStage, setHintsByStage] = useState<Record<number, string[]>>({})

  async function loadLeaderboard() {
    const supabase = createClient()
    const { data, error } = await supabase.from('cryptic_guests').select('id, display_name, points').order('points', { ascending: false }).order('created_at', { ascending: true }).limit(100)
    if (!error && data) setLeaderboard(data)
  }

  useEffect(() => {
    if (activeTab === 'ranking') loadLeaderboard()
  }, [activeTab])

  async function enterGame(e: React.FormEvent) {
    e.preventDefault()
    if (!player.trim()) return
    setRegistering(true)
    setRegistrationError('')
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('cryptic_guests').insert({ display_name: player.trim(), points: 0 }).select('id').single()
      if (error) throw error
      localStorage.setItem('cryptic_guest_id', data.id)
      localStorage.setItem('cryptic_guest_name', player.trim())
      setStarted(true)
      setActiveTab('today')
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : 'No pudimos registrar tu nombre. Probá nuevamente.')
    } finally {
      setRegistering(false)
    }
  }

  function requestHint(type: string) {
    const current = hintsByStage[activeStage] || []
    if (current.includes(type) || completed.includes(activeStage)) return
    setHintsByStage(previous => ({ ...previous, [activeStage]: [...(previous[activeStage] || []), type] }))
    setPointsByStage(previous => ({ ...previous, [activeStage]: Math.max(0, (previous[activeStage] ?? 100) - 10) }))
    if (type === 'letter') setRevealedLetters(previous => ({ ...previous, [activeStage]: Math.min(stage.answer.length, (previous[activeStage] || 0) + 1) }))
    else setVisibleHints(previous => ({ ...previous, [activeStage]: [...(previous[activeStage] || []), type] }))
  }

  function checkAnswer(e: React.FormEvent) {
    e.preventDefault()
    if (!stage.answer || completed.includes(activeStage)) return
    const normalizeAnswer = (value: string) => value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z]/g, '')
      .toLowerCase()
    if (normalizeAnswer(answer) === normalizeAnswer(stage.answer)) {
      const earned = pointsByStage[activeStage] ?? 100
      if (!completed.includes(activeStage)) {
        setCompleted(previous => [...previous, activeStage])
        setTotalPoints(total => total + earned)
      }
      setNotice('¡Eso es! Encontraste la respuesta.')
      if (activeStage < stages.length) {
        setIsAdvancing(true)
        window.setTimeout(() => {
          setActiveStage(current => current === activeStage ? activeStage + 1 : current)
          setAnswer('')
          setNotice('')
          setIsAdvancing(false)
        }, 1400)
      }
    } else {
      setAttemptsByStage(previous => ({ ...previous, [activeStage]: (previous[activeStage] || 0) + 1 }))
      setPointsByStage(previous => ({ ...previous, [activeStage]: Math.max(0, (previous[activeStage] ?? 100) - 10) }))
      setNotice('Todavía no. Probá otra vez: cada intento incorrecto resta 10 puntos.')
    }
  }

  const stage = stages[activeStage - 1] as any

  return <main className="birthday-game">
    <header className="birthday-nav">
      <a href="/" className="birthday-back"><ArrowLeft size={16}/> Volver</a>
      <div className="birthday-mark"><span>✳</span> THE SECRET GAME</div>
      <div className="birthday-nav-right"><span className="live-dot"/> EXPERIENCIA PRIVADA</div>
    </header>

    <div className="birthday-game-tabs">
      <button className={activeTab === 'today' ? 'active' : ''} onClick={() => setActiveTab('today')}>HOY</button>
      <button className={activeTab === 'ranking' ? 'active' : ''} onClick={() => setActiveTab('ranking')}>RANKING</button>
    </div>

    {activeTab === 'ranking' ? <section className="birthday-ranking">
      <div className="birthday-ranking-heading"><span className="birthday-kicker">LOS INVITADOS</span><h2>Tabla de posiciones</h2><p>El ranking de quienes participan, ordenado por puntos acumulados.</p></div>
      {leaderboard.length ? <div className="birthday-ranking-list">{leaderboard.map((guest,index)=><div className={'birthday-ranking-row '+(index===0?'top-rank':'')} key={guest.id}><span className="birthday-rank-position">{String(index+1).padStart(2,'0')}</span><span className="birthday-rank-name">{guest.display_name}</span><b className="birthday-rank-points">{guest.points} <small>PTS</small></b></div>)}</div> : <div className="birthday-ranking-empty"><Trophy size={28}/><b>El ranking todavía está vacío</b><span>Cuando tus invitados se registren, aparecerán acá con sus puntos.</span></div>}
      <button className="birthday-ranking-refresh" onClick={loadLeaderboard}>Actualizar ranking</button>
    </section> : <>
    <section className="birthday-hero">
      <div className="birthday-orbit orbit-one"/><div className="birthday-orbit orbit-two"/>
      <div className="birthday-hero-content">
        <div className="birthday-eyebrow"><Sparkles size={14}/> UNA EXPERIENCIA PARA COMPARTIR</div>
        <h1>Seis enigmas.<br/><em>Una gran sorpresa.</em></h1>
        <p>Una aventura de ingenio, pistas y respuestas. ¿Te animás a llegar hasta el final?</p>
        <div className="birthday-hero-meta"><span><KeyRound size={14}/> 6 DESAFÍOS</span><i/> <span><Trophy size={14}/> UN FINAL ESPECIAL</span></div>
      </div>
      <div className="birthday-seal"><span>THE</span><b>秘密</b><span>GAME</span></div>
    </section>

    <div className="birthday-guide-toggle-wrap"><button className="birthday-guide-toggle" onClick={()=>setShowGuide(!showGuide)}><BookOpen size={18}/>{showGuide?'Ocultar guía':'¿No sabés cómo jugar? Aprendé acá'}<span>{showGuide?'−':'+'}</span></button></div>
    {showGuide&&<HowToPlay/>}

    {!started ? <section className="birthday-entry">
      <div className="birthday-entry-card">
        <div className="birthday-card-icon"><PartyPopper size={22}/></div>
        <div className="birthday-kicker">ANTES DE COMENZAR</div>
        <h2>¿Quién está jugando?</h2>
        <p>Escribí tu nombre para entrar a la experiencia.</p>
        <form onSubmit={enterGame}>
          <label htmlFor="player-name">Tu nombre</label>
          <input id="player-name" value={player} onChange={e=>setPlayer(e.target.value)} placeholder="Ingresá tu nombre..." maxLength={32} required />
          <button className="birthday-primary" type="submit" disabled={registering}>{registering ? 'Registrando...' : 'Comenzar aventura'} <ArrowRight size={17}/></button>
          {registrationError && <p className="birthday-registration-error">{registrationError}</p>}
        </form>
        <small>Vas a recorrer los desafíos en orden.</small>
      </div>
    </section> : <section className="birthday-play">
      <div className="birthday-welcome"><div><span className="birthday-kicker">PARTICIPANTE</span><h2>¡Vamos, {player.trim()}!</h2><span className="birthday-total-score">TOTAL ACUMULADO: <b>{totalPoints} PTS</b></span></div><span className="birthday-progress-label">{completed.length} / 6 COMPLETADOS</span></div>
      <div className="birthday-progress"><span style={{width: (completed.length / 6 * 100) + '%'}}/></div>
      <div className="birthday-layout">
        <aside className="birthday-levels">
          <div className="birthday-levels-head"><span className="birthday-kicker">TU RECORRIDO</span><b>Los seis desafíos</b></div>
          {stages.map(item=><button key={item.number} className={'birthday-level '+(activeStage===item.number?'selected ':'')+(completed.includes(item.number)?'done':'')} onClick={()=>{setActiveStage(item.number);setAnswer('');setNotice('');setIsAdvancing(false)}}>
            <span className="birthday-level-number">{completed.includes(item.number)?'✓':String(item.number).padStart(2,'0')}</span>
            <span className="birthday-level-copy"><b>{item.title}</b><small>{item.level}</small></span>
            {item.number===6&&!completed.includes(6)&&<LockKeyhole size={15}/>}
          </button>)}
        </aside>
        <article className="birthday-challenge">
          <div className="birthday-challenge-top"><span>{stage.level}</span><span>DESAFÍO {String(stage.number).padStart(2,'0')} / 06</span></div>
          <div className="birthday-scorebar"><span>ESTE CRÍPTICO</span><strong>{pointsByStage[activeStage] ?? 100} PTS</strong><span>INTENTOS: {attemptsByStage[activeStage] || 0}/5</span></div>
          {stage.answer ? <>
            <div className="birthday-cryptic-clue">{stage.clue.split(/(Cámara|RA|perdió|¿dónde duermo\\?|2892|principios|encontré|por fin|el lugar indicado|Pacífico|agua|la cabeza|masa redonda frita|Es el dios más humano de todos)/gi).map((part: string,index: number)=>{
              const activeTypes = hintsByStage[activeStage] || []
              const shouldMark = activeTypes.some(type => type !== 'letter' && stage.parts?.[type as keyof typeof stage.parts]?.some((term: string) => term.toLocaleLowerCase('es-AR') === part.toLocaleLowerCase('es-AR')))
              return shouldMark ? <span key={index} className={'cryptic-mark '+(activeTypes.includes('definition') && stage.parts?.definition?.some((term: string)=>term.toLocaleLowerCase('es-AR')===part.toLocaleLowerCase('es-AR'))?'mark-definition':activeTypes.includes('indicator') && stage.parts?.indicator?.some((term: string) => term.toLocaleLowerCase('es-AR') === part.toLocaleLowerCase('es-AR'))?'mark-indicator':'mark-material')}>{part}</span> : <span key={index}>{part}</span>
            })}</div>
            {!completed.includes(activeStage) ? <>
              <div className="birthday-hint-buttons">
                {(['definition','indicator','material','letter'] as const).map(type=><button key={type} type="button" disabled={(hintsByStage[activeStage] || []).includes(type)} onClick={()=>requestHint(type)}>{type==='definition'?'Pista: definición':type==='indicator'?'Pista: indicador':type==='material'?'Pista: material':'Revelar una letra'} <small>−10 pts</small></button>)}
              </div>
              {(['definition','indicator','material'] as const).filter(type=>(visibleHints[activeStage] || []).includes(type)).map(type=><p className="birthday-hint-text" key={type}>{stage.hints[type]}</p>)}
              {(revealedLetters[activeStage] || 0)>0 && <p className="birthday-hint-text">Letras reveladas: {stage.answer.slice(0,revealedLetters[activeStage]).split('').join(' · ')}</p>}
              <form className="birthday-answer" onSubmit={checkAnswer}>
                <label htmlFor="game-answer">Tu respuesta</label>
                <div><input id="game-answer" value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Escribí tu respuesta..." maxLength={20}/><button type="submit"><ArrowRight size={17}/></button></div>
              </form>
            </> : <div className="birthday-solution"><b>¡RESUELTO!</b><strong>{stage.answer}</strong><span>¡Muy bien! Seguí con el próximo desafío.</span></div>}
          </> : <div className="birthday-coming"><LockKeyhole size={17}/><div><b>Enigma en preparación</b><span>Este desafío todavía está en preparación.</span></div></div>}
          {notice&&<p className="birthday-notice">{notice}{isAdvancing ? ' Cargando el siguiente desafío…' : ''}</p>}
          <div className="birthday-challenge-foot"><span><Sparkles size={14}/> Pensá, probá y descubrí</span><span>NO HAY LÍMITE DE TIEMPO</span></div>
        </article>
      </div>
    </section>}

    </>}

    <footer className="birthday-footer"><span>MADE FOR A SPECIAL DAY</span><span>✳</span><span>THE SECRET GAME · 2026</span></footer>
  </main>
}
