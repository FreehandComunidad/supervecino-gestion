"use client"

import { useState } from 'react'
import { ArrowLeft, ArrowRight, LockKeyhole, Sparkles, Trophy, PartyPopper, KeyRound } from 'lucide-react'

const stages = [
  { number: 1, title: 'Primer enigma', level: 'INICIO', description: 'El primer desafío abre el juego.' },
  { number: 2, title: 'Siguiente pista', level: 'NIVEL 02', description: 'Una nueva incógnita te espera.' },
  { number: 3, title: 'La tercera clave', level: 'NIVEL 03', description: 'Cada respuesta te acerca al final.' },
  { number: 4, title: 'Cuarto desafío', level: 'NIVEL 04', description: 'Poné a prueba tu ingenio.' },
  { number: 5, title: 'Casi al final', level: 'NIVEL 05', description: 'Un último enigma antes del gran cierre.' },
  { number: 6, title: 'El gran final', level: 'DESAFÍO FINAL', description: 'La respuesta final guarda una sorpresa.' },
]

export default function CumplePage() {
  const [started, setStarted] = useState(false)
  const [player, setPlayer] = useState('')
  const [activeStage, setActiveStage] = useState(1)
  const [answer, setAnswer] = useState('')
  const [notice, setNotice] = useState('')
  const [completed, setCompleted] = useState<number[]>([])

  function enterGame(e: React.FormEvent) {
    e.preventDefault()
    if (!player.trim()) return
    setStarted(true)
  }

  function checkAnswer(e: React.FormEvent) {
    e.preventDefault()
    setNotice('Este críptico todavía está en preparación. Pronto vas a poder ingresar tu respuesta.')
  }

  const stage = stages[activeStage - 1]

  return <main className="birthday-game">
    <header className="birthday-nav">
      <a href="/" className="birthday-back"><ArrowLeft size={16}/> Volver</a>
      <div className="birthday-mark"><span>✳</span> THE SECRET GAME</div>
      <div className="birthday-nav-right"><span className="live-dot"/> EXPERIENCIA PRIVADA</div>
    </header>

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

    {!started ? <section className="birthday-entry">
      <div className="birthday-entry-card">
        <div className="birthday-card-icon"><PartyPopper size={22}/></div>
        <div className="birthday-kicker">ANTES DE COMENZAR</div>
        <h2>¿Quién está jugando?</h2>
        <p>Escribí tu nombre para entrar a la experiencia.</p>
        <form onSubmit={enterGame}>
          <label htmlFor="player-name">Tu nombre</label>
          <input id="player-name" value={player} onChange={e=>setPlayer(e.target.value)} placeholder="Ingresá tu nombre..." maxLength={32} required />
          <button className="birthday-primary" type="submit">Comenzar aventura <ArrowRight size={17}/></button>
        </form>
        <small>Vas a recorrer los desafíos en orden.</small>
      </div>
    </section> : <section className="birthday-play">
      <div className="birthday-welcome"><div><span className="birthday-kicker">PARTICIPANTE</span><h2>¡Vamos, {player.trim()}!</h2></div><span className="birthday-progress-label">{completed.length} / 6 COMPLETADOS</span></div>
      <div className="birthday-progress"><span style={{width: (completed.length / 6 * 100) + '%'}}/></div>
      <div className="birthday-layout">
        <aside className="birthday-levels">
          <div className="birthday-levels-head"><span className="birthday-kicker">TU RECORRIDO</span><b>Los seis desafíos</b></div>
          {stages.map(item=><button key={item.number} className={'birthday-level '+(activeStage===item.number?'selected ':'')+(completed.includes(item.number)?'done':'')} onClick={()=>{setActiveStage(item.number);setAnswer('');setNotice('')}}>
            <span className="birthday-level-number">{completed.includes(item.number)?'✓':String(item.number).padStart(2,'0')}</span>
            <span className="birthday-level-copy"><b>{item.title}</b><small>{item.level}</small></span>
            {item.number===6&&!completed.includes(6)&&<LockKeyhole size={15}/>}
          </button>)}
        </aside>
        <article className="birthday-challenge">
          <div className="birthday-challenge-top"><span>{stage.level}</span><span>DESAFÍO {String(stage.number).padStart(2,'0')} / 06</span></div>
          <div className="birthday-challenge-icon">{stage.number===6?'✧':'?'}</div>
          <h2>{stage.title}</h2>
          <p>{stage.description}</p>
          <div className="birthday-coming"><LockKeyhole size={17}/><div><b>Enigma en preparación</b><span>Acá aparecerá el críptico y sus pistas cuando definamos el contenido.</span></div></div>
          <form className="birthday-answer" onSubmit={checkAnswer}>
            <label htmlFor="game-answer">Tu respuesta</label>
            <div><input id="game-answer" value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Escribí tu respuesta..." disabled/><button type="submit" disabled><ArrowRight size={17}/></button></div>
          </form>
          {notice&&<p className="birthday-notice">{notice}</p>}
          <div className="birthday-challenge-foot"><span><Sparkles size={14}/> Pensá, probá y descubrí</span><span>NO HAY LÍMITE DE TIEMPO</span></div>
        </article>
      </div>
    </section>}

    <footer className="birthday-footer"><span>MADE FOR A SPECIAL DAY</span><span>✳</span><span>THE SECRET GAME · 2026</span></footer>
  </main>
}
