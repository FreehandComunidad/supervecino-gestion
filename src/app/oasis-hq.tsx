"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowUpRight, Bot, Building2, CarFront, ChartNoAxesCombined, CheckCircle2, ChevronRight, CircleHelp, Coffee, Crown, DoorOpen, LayoutDashboard, MessageSquare, Palmtree, Plus, ShieldCheck, Sparkles, Users, Waves, BriefcaseBusiness, ClipboardList, LoaderCircle, RefreshCw } from 'lucide-react'

type Agent = {id:string;slug:string;name:string;job_title:string;department:string;specialty:string|null;instructions:string|null;status:string;active:boolean;business_id:string|null}
type Business = {id:string;name:string;business_type:string|null;description:string|null;active:boolean}
type Location = {id:string;business_id:string;name:string;address:string|null;city:string|null;province:string|null}
type Task = {id:string;title:string;description:string|null;status:string;priority:string;created_at:string;assigned_agent_id:string|null;business_id:string|null}
type ChatMessage = {id:string;sender_type:'user'|'agent'|'system';content:string;created_at:string}
const rooms = [
 {id:'board',name:'Sala de directorio',desc:'Reuniones y decisiones',icon:Users,tag:'REUNIONES'},
 {id:'finance',name:'Oficina financiera',desc:'Números, márgenes y caja',icon:ChartNoAxesCombined,tag:'FINANZAS'},
 {id:'ops',name:'Centro de operaciones',desc:'Sucursales y stock',icon:Building2,tag:'OPERACIONES'},
 {id:'studio',name:'Creative studio',desc:'Promociones y marketing',icon:Sparkles,tag:'CREATIVIDAD'}
]
const agentColors=['#d6b46a','#76b9a9','#e3a66d','#c29bd8','#7da8dc','#d68ca7','#d8b66f','#78b8d4','#9eaaa6']
const agentIcons=[Crown,ChartNoAxesCombined,Building2,BriefcaseBusiness,Users,Users,Sparkles,ChartNoAxesCombined,ShieldCheck]
const moneyDate=(value:string)=>new Date(value).toLocaleDateString('es-AR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
export default function OasisHQ(){
 const supabase=useMemo(()=>createClient(),[])
 const [tab,setTab]=useState<'estate'|'agents'|'activity'>('estate')
 const [selected,setSelected]=useState('')
 const [room,setRoom]=useState('board')
 const [organizationId,setOrganizationId]=useState('')
 const [organizationName,setOrganizationName]=useState('OASIS HQ')
 const [userId,setUserId]=useState('')
 const [businesses,setBusinesses]=useState<Business[]>([])
 const [locations,setLocations]=useState<Location[]>([])
 const [agents,setAgents]=useState<Agent[]>([])
 const [tasks,setTasks]=useState<Task[]>([])
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [showBusinessForm,setShowBusinessForm]=useState(false)
 const [businessName,setBusinessName]=useState('')
 const [businessType,setBusinessType]=useState('')
 const [branchName,setBranchName]=useState('Casa central')
 const [branchAddress,setBranchAddress]=useState('')
 const [taskTitle,setTaskTitle]=useState('')
 const [taskDescription,setTaskDescription]=useState('')
 const [taskAgent,setTaskAgent]=useState('')
 const [taskBusiness,setTaskBusiness]=useState('')
 const [taskPriority,setTaskPriority]=useState('normal')
 const [taskFilter,setTaskFilter]=useState('all')
 const [chatMessages,setChatMessages]=useState<ChatMessage[]>([])
 const [chatConversationId,setChatConversationId]=useState<string|null>(null)
 const [chatDraft,setChatDraft]=useState('')
 const [chatSending,setChatSending]=useState(false)
 const [chatLoading,setChatLoading]=useState(false)
 const [chatError,setChatError]=useState('')
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const {data:auth,error:authError}=await supabase.auth.getUser()
   if(authError)throw authError
   if(!auth.user)throw new Error('Iniciá sesión para acceder a OASIS HQ.')
   setUserId(auth.user.id)
   const {data:membership,error:memberError}=await supabase.from('organization_memberships').select('organization_id,role').eq('user_id',auth.user.id).eq('active',true).limit(1).maybeSingle()
   if(memberError)throw memberError
   if(!membership)throw new Error('Tu usuario todavía no tiene una organización asignada.')
   setOrganizationId(membership.organization_id)
   const [{data:org,error:orgError},{data:businessRows,error:businessError},{data:agentRows,error:agentError},{data:taskRows,error:taskError}]=await Promise.all([
    supabase.from('organizations').select('id,name').eq('id',membership.organization_id).single(),
    supabase.from('businesses').select('id,name,business_type,description,active').eq('organization_id',membership.organization_id).eq('active',true).order('name'),
    supabase.from('oasis_agents').select('id,slug,name,job_title,department,specialty,instructions,status,active,business_id').eq('organization_id',membership.organization_id).eq('active',true).order('created_at'),
    supabase.from('oasis_tasks').select('id,title,description,status,priority,created_at,assigned_agent_id,business_id').eq('organization_id',membership.organization_id).order('created_at',{ascending:false}).limit(60)
   ])
   if(orgError)throw orgError;if(businessError)throw businessError;if(agentError)throw agentError;if(taskError)throw taskError
   setOrganizationName(org.name);setBusinesses(businessRows||[]);setAgents(agentRows||[]);setTasks(taskRows||[])
   if(agentRows?.length)setSelected(current=>current||agentRows[0].id)
   if(agentRows?.length)setTaskAgent(current=>current||agentRows[0].id)
   if(businessRows?.length)setTaskBusiness(current=>current||businessRows[0].id)
   const ids=(businessRows||[]).map((b:Business)=>b.id)
   if(ids.length){const {data:locRows,error:locError}=await supabase.from('business_locations').select('id,business_id,name,address,city,province').in('business_id',ids).eq('active',true);if(locError)throw locError;setLocations(locRows||[])}else setLocations([])
  }catch(e:any){setError(e.message||'No se pudo cargar OASIS HQ.')}
  finally{setLoading(false)}
 },[supabase])
 useEffect(()=>{void load()},[load])
 const active=agents.find(a=>a.id===selected)||agents[0]
 useEffect(()=>{
  if(!active?.id||!organizationId||!userId){setChatMessages([]);setChatConversationId(null);return}
  let cancelled=false
  async function loadChat(){
   setChatLoading(true);setChatError('')
   const {data:conversation}=await supabase.from('oasis_conversations').select('id').eq('organization_id',organizationId).eq('primary_agent_id',active!.id).eq('created_by',userId).order('updated_at',{ascending:false}).limit(1).maybeSingle()
   if(cancelled)return
   setChatConversationId(conversation?.id||null)
   if(conversation?.id){
    const {data,error}=await supabase.from('oasis_messages').select('id,sender_type,content,created_at').eq('conversation_id',conversation.id).order('created_at',{ascending:true}).limit(40)
    if(cancelled)return
    if(error)setChatError(error.message)
    setChatMessages((data||[]) as ChatMessage[])
   }else setChatMessages([])
   setChatLoading(false)
  }
  void loadChat()
  return()=>{cancelled=true}
 },[active?.id,organizationId,userId,supabase])
 async function sendAgentMessage(e:React.FormEvent){
  e.preventDefault()
  const message=chatDraft.trim()
  if(!message||!active||chatSending)return
  setChatSending(true);setChatError('');setChatDraft('')
  const localMessage:ChatMessage={id:'local-'+Date.now(),sender_type:'user',content:message,created_at:new Date().toISOString()}
  setChatMessages(current=>[...current,localMessage])
  try{
   const response=await fetch('/api/oasis/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agentId:active.id,businessId:active.business_id||taskBusiness||null,conversationId:chatConversationId,message})})
   const result=await response.json()
   if(!response.ok)throw new Error(result.error||'No se pudo obtener respuesta del agente.')
   setChatConversationId(result.conversationId)
   const {data}=await supabase.from('oasis_messages').select('id,sender_type,content,created_at').eq('conversation_id',result.conversationId).order('created_at',{ascending:true}).limit(40)
   setChatMessages((data||[]) as ChatMessage[])
  }catch(error:any){setChatError(error.message||'No se pudo enviar el mensaje.')}
  finally{setChatSending(false)}
 }
 const activeTasks=tasks.filter(t=>taskFilter==='all'||t.status===taskFilter)
 const completed=tasks.filter(t=>t.status==='completed').length
 async function addBusiness(e:React.FormEvent){
  e.preventDefault();if(!businessName.trim()||!organizationId)return
  setSaving(true);setError('');setNotice('')
  try{
   const {data:created,error:createError}=await supabase.from('businesses').insert({organization_id:organizationId,name:businessName.trim(),business_type:businessType.trim()||null,active:true}).select('id').single()
   if(createError)throw createError
   if(branchName.trim()){const {error:branchError}=await supabase.from('business_locations').insert({business_id:created.id,name:branchName.trim(),address:branchAddress.trim()||null,city:'',province:'San Juan',country:'Argentina'});if(branchError)throw branchError}
   setBusinessName('');setBusinessType('');setBranchName('Casa central');setBranchAddress('');setShowBusinessForm(false);setNotice('Negocio agregado correctamente.');await load()
  }catch(e:any){setError(e.message||'No se pudo crear el negocio.')}
  finally{setSaving(false)}
 }
 async function addTask(e:React.FormEvent){
  e.preventDefault();if(!taskTitle.trim()||!organizationId)return
  setSaving(true);setError('');setNotice('')
  try{
   const {error:taskError}=await supabase.from('oasis_tasks').insert({organization_id:organizationId,business_id:taskBusiness||null,assigned_agent_id:taskAgent||null,created_by:userId,title:taskTitle.trim(),description:taskDescription.trim()||null,priority:taskPriority,status:'pending'})
   if(taskError)throw taskError
   setTaskTitle('');setTaskDescription('');setNotice('Tarea registrada y asignada al agente.');await load()
  }catch(e:any){setError(e.message||'No se pudo registrar la tarea.')}
  finally{setSaving(false)}
 }
 async function changeTaskStatus(id:string,status:string){
  const {error:changeError}=await supabase.from('oasis_tasks').update({status,updated_at:new Date().toISOString()}).eq('id',id)
  if(changeError){setError(changeError.message);return}
  setTasks(current=>current.map(t=>t.id===id?{...t,status}:t))
 }
 return <main className="oasis-shell">
  <header className="oasis-top">
   <a className="oasis-brand" href="/"><span className="oasis-brand-mark"><Palmtree size={21}/></span><span><b>OASIS <i>HQ</i></b><small>PRIVATE BUSINESS ESTATE</small></span></a>
   <div className="oasis-top-right"><span className="oasis-live"><span/> CENTRAL PRIVADA</span><button className="oasis-refresh" onClick={()=>void load()} title="Actualizar"><RefreshCw size={14}/></button><a href="/" className="oasis-exit">Volver a Gestión <ArrowUpRight size={15}/></a></div>
  </header>
  <section className="oasis-hero">
   <div className="oasis-hero-copy"><div className="oasis-kicker"><Waves size={14}/> YOUR BUSINESS, IN PARADISE</div><h1>Bienvenido a<br/><em>tu centro de mando.</em></h1><p>Una sola mansión. Todos tus negocios. Un equipo inteligente trabajando en conjunto.</p><div className="oasis-weather"><span>☀</span> Tu central privada <i/> {organizationName}</div></div>
   <div className="oasis-hero-stats"><div><small>AGENTES DEL EQUIPO</small><b>{String(agents.length).padStart(2,'0')}</b><span>Perfiles en la base de datos</span></div><div><small>ESPACIOS DE TRABAJO</small><b>04</b><span>Departamentos</span></div><div><small>NEGOCIOS CONECTADOS</small><b>{String(businesses.length).padStart(2,'0')}</b><span>Unidades comerciales</span></div></div>
  </section>
  <nav className="oasis-tabs">{([{id:'estate',label:'La mansión',icon:Palmtree},{id:'agents',label:'Equipo IA',icon:Bot},{id:'activity',label:'Centro de actividad',icon:LayoutDashboard}] as const).map(t=><button key={t.id} className={tab===t.id?'active':''} onClick={()=>setTab(t.id)}><t.icon size={16}/>{t.label}</button>)}</nav>
  <div className="oasis-content">
   {error&&<p className="oasis-alert">{error}</p>}{notice&&<p className="oasis-notice"><CheckCircle2 size={15}/>{notice}</p>}
   {loading?<div className="oasis-loading"><LoaderCircle size={22}/> Conectando con tu central de negocios…</div>:null}
   {!loading&&tab==='estate'&&<>
    <div className="oasis-section-title"><div><span>01 / THE ESTATE</span><h2>Explorá tu mansión</h2><p>Elegí un ambiente para ver qué equipo trabaja ahí.</p></div><span className="oasis-weather-pill"><Waves size={14}/> Frente al mar</span></div>
    <div className="oasis-estate">
     <div className="oasis-villa-art"><div className="oasis-sun"/><div className="oasis-palm palm-one">🌴</div><div className="oasis-palm palm-two">🌴</div><div className="oasis-sea"/><div className="oasis-villa"><div className="villa-roof"/><div className="villa-upper"><i/><i/><i/></div><div className="villa-lower"><i/><i/><i/><i/></div><div className="villa-deck"/></div><div className="oasis-pool"/></div>
     <div className="oasis-room-grid">{rooms.map(r=><button key={r.id} onClick={()=>{setRoom(r.id);setTab('agents')}} className={room===r.id?'chosen':''}><span className="room-icon"><r.icon size={19}/></span><small>{r.tag}</small><b>{r.name}</b><span>{r.desc}</span><ChevronRight size={16}/></button>)}</div>
    </div>
    <div className="oasis-business-heading"><div><span>PORTFOLIO EMPRESARIAL</span><h3>Negocios conectados</h3><p>Tu estructura actual y las empresas que vayas sumando.</p></div><button className="oasis-primary" onClick={()=>setShowBusinessForm(v=>!v)}><Plus size={15}/> Agregar negocio</button></div>
    {showBusinessForm&&<form className="oasis-form oasis-business-form" onSubmit={addBusiness}><label>Nombre del negocio<input required value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="Ej. Nuevo comercio"/></label><label>Rubro<input value={businessType} onChange={e=>setBusinessType(e.target.value)} placeholder="Ej. Gastronomía, retail…"/></label><label>Nombre de la sucursal inicial<input value={branchName} onChange={e=>setBranchName(e.target.value)} placeholder="Casa central"/></label><label>Dirección o referencia<input value={branchAddress} onChange={e=>setBranchAddress(e.target.value)} placeholder="Dirección de la sucursal"/></label><div><button className="oasis-primary" disabled={saving}>{saving?'Guardando…':'Guardar negocio'}</button></div></form>}
    <div className="oasis-business-grid">{businesses.map(b=><article className="oasis-business-card" key={b.id}><span className="room-icon"><Building2 size={18}/></span><div><b>{b.name}</b><small>{b.business_type||'Negocio'}</small></div><span className="business-active">ACTIVO</span><div className="business-locations">{locations.filter(l=>l.business_id===b.id).map(l=><p key={l.id}><DoorOpen size={13}/><span>{l.name}{l.address?' · '+l.address:''}</span></p>)}</div></article>)}</div>
    <div className="oasis-bottom-grid"><div className="oasis-panel"><div className="oasis-panel-head"><div><span>GARAGE PRIVADO</span><h3>La colección</h3></div><CarFront size={21}/></div><div className="oasis-cars"><div><span>🏎️</span><b>Supercar</b><small>Espacio reservado</small></div><div><span>🚙</span><b>Luxury SUV</b><small>Espacio reservado</small></div><div><span>🏁</span><b>Grand tourer</b><small>Espacio reservado</small></div></div></div><div className="oasis-panel oasis-pool-panel"><div><span>AFTER HOURS</span><h3>Beach club</h3><p>Terraza, piscina infinita y lounge privado.</p></div><Coffee size={25}/></div></div>
   </>}
   {!loading&&tab==='agents'&&<>
    <div className="oasis-section-title"><div><span>02 / YOUR AI TEAM</span><h2>El equipo de la mansión</h2><p>Perfiles, responsabilidades y especialidades guardadas en la base de datos.</p></div><span className="oasis-weather-pill"><Bot size={14}/> {agents.length} perfiles</span></div>
    <div className="oasis-agent-layout"><div className="oasis-agent-list">{agents.map((a,i)=>{const Icon=agentIcons[i%agentIcons.length];return <button key={a.id} className={selected===a.id?'selected':''} onClick={()=>setSelected(a.id)}><span className="agent-avatar" style={{'--agent-color':agentColors[i%agentColors.length]} as React.CSSProperties}><Icon size={17}/></span><span><b>{a.name}</b><small>{a.job_title}</small></span><i>{a.status==='working'?'TRABAJANDO':a.status==='paused'?'PAUSADO':'DISPONIBLE'}</i></button>})}</div>
     {active?<div className="oasis-agent-detail"><div className="agent-detail-top"><span className="agent-avatar large" style={{'--agent-color':agentColors[Math.max(0,agents.findIndex(a=>a.id===active.id))%agentColors.length]} as React.CSSProperties}>{active.name[0]}</span><div><span>AGENTE · {active.department.toUpperCase()}</span><h3>{active.name}</h3><p>{active.job_title}</p></div><span className="agent-ready">GUARDADO EN HQ</span></div><div className="agent-duty"><small>ESPECIALIDAD</small><p>{active.specialty||'Responsabilidades generales del departamento.'}</p></div><div className="agent-duty"><small>INSTRUCCIONES DEL PERFIL</small><p>{active.instructions||'Sin instrucciones configuradas.'}</p></div><div className="oasis-chat"><div className="oasis-chat-head"><div><MessageSquare size={18}/><b>Conversación con {active.name}</b></div><small>Respuestas con IA · historial guardado</small></div><div className="oasis-chat-messages">{chatLoading?<p className="oasis-chat-empty">Cargando conversación…</p>:chatMessages.length?chatMessages.map(m=><div key={m.id} className={'oasis-chat-message '+(m.sender_type==='user'?'mine':'theirs')}><small>{m.sender_type==='user'?'Vos':active.name}</small><p>{m.content}</p></div>):<p className="oasis-chat-empty">Todavía no hay mensajes. Escribile a {active.name} para empezar.</p>}{chatSending&&<div className="oasis-chat-message theirs"><small>{active.name}</small><p>Estoy analizando tu consulta…</p></div>}</div>{chatError&&<p className="oasis-chat-error">{chatError}</p>}<form className="oasis-chat-compose" onSubmit={sendAgentMessage}><textarea value={chatDraft} onChange={e=>setChatDraft(e.target.value)} placeholder={'Escribile a '+active.name+'…'} maxLength={4000} rows={2}/><button className="oasis-primary" disabled={chatSending||!chatDraft.trim()}>{chatSending?'Enviando…':'Enviar'} <ArrowUpRight size={15}/></button></form><small className="oasis-chat-foot">El agente puede analizar y recomendar. No modifica caja, stock ni precios.</small></div><button className="oasis-primary" onClick={()=>setTab('activity')}>Asignar una tarea <ArrowUpRight size={15}/></button></div>:<div className="oasis-agent-detail">No hay perfiles activos configurados.</div>}
    </div>
   </>}
   {!loading&&tab==='activity'&&<>
    <div className="oasis-section-title"><div><span>03 / COMMAND CENTER</span><h2>Centro de actividad</h2><p>Creá tareas reales y asignáselas a los responsables de cada área.</p></div><span className="oasis-weather-pill"><ClipboardList size={14}/> {tasks.length} tareas</span></div>
    <div className="oasis-activity-grid"><div className="oasis-panel"><span>NUEVA TAREA</span><h3>Delegar al equipo</h3><form className="oasis-form" onSubmit={addTask}><label>Qué hay que hacer<input required value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="Ej. Revisar rentabilidad de la semana"/></label><label>Detalle<textarea value={taskDescription} onChange={e=>setTaskDescription(e.target.value)} placeholder="Contexto, alcance y resultado esperado…"/></label><div className="oasis-form-row"><label>Responsable<select value={taskAgent} onChange={e=>setTaskAgent(e.target.value)}>{agents.map(a=><option key={a.id} value={a.id}>{a.name} · {a.department}</option>)}</select></label><label>Negocio<select value={taskBusiness} onChange={e=>setTaskBusiness(e.target.value)}>{businesses.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label></div><label>Prioridad<select value={taskPriority} onChange={e=>setTaskPriority(e.target.value)}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><button className="oasis-primary" disabled={saving||!agents.length}>{saving?'Guardando…':'Crear tarea y asignar'} <ArrowUpRight size={15}/></button></form></div>
     <div className="oasis-panel oasis-next"><Sparkles size={24}/><h3>Actividad registrada</h3><p>Las tareas quedan guardadas en Supabase y visibles para los miembros autorizados de la organización.</p><div className="oasis-check"><CheckCircle2 size={16}/> {agents.length} perfiles de agentes conectados</div><div className="oasis-check"><CheckCircle2 size={16}/> {businesses.length} negocios registrados</div><div className="oasis-check"><CheckCircle2 size={16}/> {completed} tareas completadas</div><div className="oasis-check pending"><MessageSquare size={16}/> Chat IA pendiente de proveedor</div></div>
    </div>
    <div className="oasis-task-heading"><div><span>WORK QUEUE</span><h3>Tablero de tareas</h3></div><select value={taskFilter} onChange={e=>setTaskFilter(e.target.value)}><option value="all">Todas</option><option value="pending">Pendientes</option><option value="in_progress">En curso</option><option value="waiting_approval">Esperando aprobación</option><option value="completed">Completadas</option><option value="cancelled">Canceladas</option></select></div>
    <div className="oasis-task-list">{activeTasks.map(t=><article className="oasis-task" key={t.id}><div className="task-main"><b>{t.title}</b><p>{t.description||'Sin detalle adicional'}</p><small>{agents.find(a=>a.id===t.assigned_agent_id)?.name||'Sin asignar'} · {businesses.find(b=>b.id===t.business_id)?.name||'General'} · {moneyDate(t.created_at)}</small></div><span className={'task-priority '+t.priority}>{t.priority.toUpperCase()}</span><select aria-label="Estado de tarea" value={t.status} onChange={e=>void changeTaskStatus(t.id,e.target.value)}><option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="waiting_approval">Esperando aprobación</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option></select></article>)}{!activeTasks.length&&<div className="oasis-empty">Todavía no hay tareas en esta vista.</div>}</div>
   </>}
  </div>
  <footer className="oasis-footer"><span>OASIS HQ · PRIVATE BUSINESS ESTATE</span><span>SUMMER NEVER ENDS <Waves size={13}/></span></footer>
 </main>
}
