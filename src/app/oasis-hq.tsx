"use client"

import { useState } from 'react'
import { ArrowUpRight, Bot, Building2, CarFront, ChartNoAxesCombined, CheckCircle2, ChevronRight, CircleHelp, Coffee, Crown, DoorOpen, LayoutDashboard, MessageSquare, Palmtree, Plus, ShieldCheck, Sparkles, Users, Waves } from 'lucide-react'

const agents = [
 {id:'ceo',name:'Atlas',role:'Director general',area:'Dirección',icon:Crown,color:'#d6b46a',status:'Coordinando',task:'Revisando el estado general de los negocios'},
 {id:'cfo',name:'Vera',role:'Directora financiera',area:'Finanzas',icon:ChartNoAxesCombined,color:'#76b9a9',status:'Disponible',task:'Preparando el resumen de rentabilidad'},
 {id:'stock',name:'Bruno',role:'Jefe de stock y logística',area:'Inventario',icon:Building2,color:'#e3a66d',status:'Disponible',task:'Control de inventario y reposición'},
 {id:'buy',name:'Mía',role:'Gerenta de compras',area:'Compras',icon:Plus,color:'#c29bd8',status:'Disponible',task:'Comparación de listas de proveedores'},
 {id:'ops',name:'Gael',role:'Gerente de sucursales',area:'Operaciones',icon:Users,color:'#7da8dc',status:'Disponible',task:'Seguimiento de sucursales'},
 {id:'hr',name:'Alma',role:'Recursos humanos',area:'Personas',icon:Users,color:'#d68ca7',status:'Disponible',task:'Organización de equipos y turnos'},
 {id:'marketing',name:'Luca',role:'Director de marketing',area:'Marketing',icon:Sparkles,color:'#d8b66f',status:'Disponible',task:'Ideas para campañas comerciales'},
 {id:'data',name:'Noa',role:'Analista de datos',area:'Inteligencia',icon:ChartNoAxesCombined,color:'#78b8d4',status:'Disponible',task:'Detección de tendencias y oportunidades'},
 {id:'audit',name:'Elías',role:'Auditor interno',area:'Control',icon:ShieldCheck,color:'#9eaaa6',status:'Disponible',task:'Revisión de alertas y diferencias'}
]
const rooms = [
 {id:'board',name:'Sala de directorio',desc:'Reuniones y decisiones',icon:Users,tag:'REUNIONES'},
 {id:'finance',name:'Oficina financiera',desc:'Números, márgenes y caja',icon:ChartNoAxesCombined,tag:'FINANZAS'},
 {id:'ops',name:'Centro de operaciones',desc:'Sucursales y stock',icon:Building2,tag:'OPERACIONES'},
 {id:'studio',name:'Creative studio',desc:'Promociones y marketing',icon:Sparkles,tag:'CREATIVIDAD'}
]
export default function OasisHQ(){
 const [tab,setTab]=useState<'estate'|'agents'|'activity'>('estate')
 const [selected,setSelected]=useState('ceo')
 const [room,setRoom]=useState('board')
 const active=agents.find(a=>a.id===selected)!
 return <main className="oasis-shell">
  <header className="oasis-top">
   <a className="oasis-brand" href="/"><span className="oasis-brand-mark"><Palmtree size={21}/></span><span><b>OASIS <i>HQ</i></b><small>PRIVATE BUSINESS ESTATE</small></span></a>
   <div className="oasis-top-right"><span className="oasis-live"><span/> CENTRAL PRIVADA</span><a href="/" className="oasis-exit">Volver a Gestión <ArrowUpRight size={15}/></a></div>
  </header>
  <section className="oasis-hero">
   <div className="oasis-hero-copy"><div className="oasis-kicker"><Waves size={14}/> YOUR BUSINESS, IN PARADISE</div><h1>Bienvenido a<br/><em>tu centro de mando.</em></h1><p>Una sola mansión. Todos tus negocios. Un equipo inteligente trabajando en conjunto.</p><div className="oasis-weather"><span>☀</span> 28° · Cielo despejado <i/> Modo playa activado</div></div>
   <div className="oasis-hero-stats"><div><small>AGENTES DEL EQUIPO</small><b>09</b><span>Perfiles definidos</span></div><div><small>ESPACIOS DE TRABAJO</small><b>04</b><span>Departamentos</span></div><div><small>NEGOCIOS CONECTADOS</small><b>01</b><span>SÚPERVECINO · base inicial</span></div></div>
  </section>
  <nav className="oasis-tabs">{([{id:'estate',label:'La mansión',icon:Palmtree},{id:'agents',label:'Equipo IA',icon:Bot},{id:'activity',label:'Centro de actividad',icon:LayoutDashboard}] as const).map(t=><button key={t.id} className={tab===t.id?'active':''} onClick={()=>setTab(t.id)}><t.icon size={16}/>{t.label}</button>)}</nav>
  {tab==='estate'&&<section className="oasis-content">
   <div className="oasis-section-title"><div><span>01 / THE ESTATE</span><h2>Explorá tu mansión</h2><p>Elegí un ambiente para ver qué equipo trabaja ahí.</p></div><span className="oasis-weather-pill"><Waves size={14}/> Frente al mar</span></div>
   <div className="oasis-estate">
    <div className="oasis-villa-art"><div className="oasis-sun"/><div className="oasis-palm palm-one">🌴</div><div className="oasis-palm palm-two">🌴</div><div className="oasis-sea"/><div className="oasis-villa"><div className="villa-roof"/><div className="villa-upper"><i/><i/><i/></div><div className="villa-lower"><i/><i/><i/><i/></div><div className="villa-deck"/></div><div className="oasis-pool"/></div>
    <div className="oasis-room-grid">{rooms.map(r=><button key={r.id} onClick={()=>{setRoom(r.id);setTab('agents')}} className={room===r.id?'chosen':''}><span className="room-icon"><r.icon size={19}/></span><small>{r.tag}</small><b>{r.name}</b><span>{r.desc}</span><ChevronRight size={16}/></button>)}</div>
   </div>
   <div className="oasis-bottom-grid"><div className="oasis-panel"><div className="oasis-panel-head"><div><span>GARAGE PRIVADO</span><h3>La colección</h3></div><CarFront size={21}/></div><div className="oasis-cars"><div><span>🏎️</span><b>Supercar</b><small>Espacio reservado</small></div><div><span>🚙</span><b>Luxury SUV</b><small>Espacio reservado</small></div><div><span>🏁</span><b>Grand tourer</b><small>Espacio reservado</small></div></div></div><div className="oasis-panel oasis-pool-panel"><div><span>AFTER HOURS</span><h3>Beach club</h3><p>Terraza, piscina infinita y lounge privado.</p></div><Coffee size={25}/></div></div>
  </section>}
  {tab==='agents'&&<section className="oasis-content"><div className="oasis-section-title"><div><span>02 / YOUR AI TEAM</span><h2>El equipo de la mansión</h2><p>Perfiles, responsabilidades y espacios asignados.</p></div><span className="oasis-weather-pill"><Bot size={14}/> 9 perfiles</span></div><div className="oasis-agent-layout"><div className="oasis-agent-list">{agents.map(a=><button key={a.id} className={selected===a.id?'selected':''} onClick={()=>setSelected(a.id)}><span className="agent-avatar" style={{'--agent-color':a.color} as React.CSSProperties}>{a.name[0]}</span><span><b>{a.name}</b><small>{a.role}</small></span><i>{a.status==='Coordinando'?'EN FOCO':'LISTO'}</i></button>)}</div><div className="oasis-agent-detail"><div className="agent-detail-top"><span className="agent-avatar large" style={{'--agent-color':active.color} as React.CSSProperties}>{active.name[0]}</span><div><span>AGENTE · {active.area.toUpperCase()}</span><h3>{active.name}</h3><p>{active.role}</p></div><span className="agent-ready">PERFIL CREADO</span></div><div className="agent-duty"><small>RESPONSABILIDAD PRINCIPAL</small><p>{active.task}</p></div><div className="agent-duty"><small>PERMISOS PREVISTOS</small><p>Consultar datos de su área, analizar información, proponer acciones y solicitar aprobación para operaciones sensibles.</p></div><div className="agent-chat-placeholder"><MessageSquare size={20}/><div><b>Conversación del agente</b><p>El perfil visual ya está definido. La conexión al motor de IA y a los datos reales se implementará en la siguiente etapa.</p></div></div><button className="oasis-primary" onClick={()=>setTab('activity')}>Ver centro de actividad <ArrowUpRight size={15}/></button></div></div></section>}
  {tab==='activity'&&<section className="oasis-content"><div className="oasis-section-title"><div><span>03 / COMMAND CENTER</span><h2>Centro de actividad</h2><p>Así se organizarán las conversaciones y tareas entre agentes.</p></div><span className="oasis-weather-pill"><CircleHelp size={14}/> Vista de diseño</span></div><div className="oasis-activity-grid"><div className="oasis-panel"><span>REUNIÓN DE EQUIPO · EJEMPLO</span><h3>Revisión de rendimiento semanal</h3><p className="oasis-muted">Flujo ilustrativo de colaboración. Todavía no representa ejecuciones reales.</p>{[{n:'Atlas',t:'Convoca al equipo para revisar los resultados.'},{n:'Vera',t:'Presenta rentabilidad, ingresos y gastos.'},{n:'Noa',t:'Detecta cambios en ventas y tendencias.'},{n:'Bruno',t:'Contrasta faltantes y necesidades de reposición.'},{n:'Mía',t:'Prepara alternativas de compra y costos.'},{n:'Atlas',t:'Eleva las recomendaciones al propietario.'}].map((m,i)=><div className="oasis-flow" key={i}><span>{m.n[0]}</span><div><b>{m.n}</b><p>{m.t}</p></div><small>{i+1}</small></div>)}</div><div className="oasis-panel oasis-next"><Sparkles size={24}/><h3>Próxima etapa</h3><p>Conectar los agentes con la base de datos, habilitar conversaciones reales, tareas compartidas y aprobaciones del propietario.</p><div className="oasis-check"><CheckCircle2 size={16}/> Roles y especialidades definidos</div><div className="oasis-check"><CheckCircle2 size={16}/> Diseño de la sede virtual</div><div className="oasis-check pending"><DoorOpen size={16}/> Conectar agentes al sistema</div><div className="oasis-check pending"><MessageSquare size={16}/> Activar chat multiagente</div></div></div></section>}
  <footer className="oasis-footer"><span>OASIS HQ · PRIVATE BUSINESS ESTATE</span><span>SUMMER NEVER ENDS <Waves size={13}/></span></footer>
 </main>
}
