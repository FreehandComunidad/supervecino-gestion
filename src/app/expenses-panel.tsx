"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, Receipt, Wallet, CalendarDays, PlusCircle } from 'lucide-react'

type Expense = { id:string; expense_date:string; category:string; description:string; amount:number; payment_method:string; reference:string|null; notes:string|null; created_by:string|null; created_at:string }
const categories = ['Alquiler','Electricidad','Agua','Internet y teléfono','Sueldos','Combustible','Impuestos','Mantenimiento','Limpieza','Fletes y logística','Comisiones','Otros']
const methods = [{value:'cash',label:'Efectivo'},{value:'debit',label:'Débito'},{value:'credit',label:'Crédito'},{value:'transfer',label:'Transferencia'},{value:'wallet',label:'Billetera virtual'},{value:'other',label:'Otro'}]
const money=(v:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(Number(v||0))
const todayLocal=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
const monthStart=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),'01'].join('-')}
const methodLabel=(v:string)=>methods.find(m=>m.value===v)?.label||v

export default function ExpensesPanel(){
 const db=useMemo(()=>createClient(),[])
 const [rows,setRows]=useState<Expense[]>([])
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [from,setFrom]=useState(monthStart())
 const [to,setTo]=useState(todayLocal())
 const [category,setCategory]=useState('all')
 const [date,setDate]=useState(todayLocal())
 const [newCategory,setNewCategory]=useState('Alquiler')
 const [description,setDescription]=useState('')
 const [amount,setAmount]=useState('')
 const [payment,setPayment]=useState('cash')
 const [reference,setReference]=useState('')
 const [notes,setNotes]=useState('')
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  let query=db.from('operating_expenses').select('id,expense_date,category,description,amount,payment_method,reference,notes,created_by,created_at').gte('expense_date',from).lte('expense_date',to).order('expense_date',{ascending:false}).order('created_at',{ascending:false}).limit(500)
  if(category!=='all')query=query.eq('category',category)
  const {data,error}=await query
  if(error)setError(error.message);else setRows((data||[]) as Expense[])
  setLoading(false)
 },[db,from,to,category])
 useEffect(()=>{void load()},[load])
 async function save(e:React.FormEvent){
  e.preventDefault();setError('');setNotice('')
  const value=Number(amount)
  if(!description.trim()||!Number.isFinite(value)||value<=0){setError('Completá una descripción y un importe mayor que cero.');return}
  setSaving(true)
  const {data:userData,error:userError}=await db.auth.getUser()
  if(userError||!userData.user){setSaving(false);setError('La sesión venció. Volvé a ingresar.');return}
  const {error}=await db.from('operating_expenses').insert({expense_date:date,category:newCategory,description:description.trim(),amount:value,payment_method:payment,reference:reference.trim()||null,notes:notes.trim()||null,created_by:userData.user.id})
  setSaving(false)
  if(error){setError(error.message);return}
  setDescription('');setAmount('');setReference('');setNotes('');setNotice('Gasto registrado correctamente.');await load()
 }
 const total=rows.reduce((s,r)=>s+Number(r.amount),0)
 const count=rows.length
 return <section className="management">
  <div className="management-head"><div><p className="eyebrow">CONTROL FINANCIERO</p><h1>Gastos del negocio</h1><p className="muted">Registrá y consultá los gastos operativos sin alterar ventas, cajas ni compras a proveedores.</p></div><button className="secondary refresh" onClick={()=>void load()}><RefreshCw size={15}/> Actualizar</button></div>
  {error&&<p className="notice">{error}</p>}{notice&&<p className="positive import-note">{notice}</p>}
  <div className="stats-cards"><div><Receipt/><small>Gastos del período</small><b>{money(total)}</b></div><div><CalendarDays/><small>Movimientos registrados</small><b>{count}</b></div><div><Wallet/><small>Período consultado</small><b>{from} a {to}</b></div></div>
  <div className="expense-layout">
   <form className="purchase-card expense-form" onSubmit={save}><h2><PlusCircle size={18}/> Registrar gasto</h2>
    <label>Fecha<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label>
    <label>Categoría<select value={newCategory} onChange={e=>setNewCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Descripción<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ej. factura de electricidad" required maxLength={160}/></label>
    <label>Importe en pesos<input type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0,00" required/></label>
    <label>Medio de pago<select value={payment} onChange={e=>setPayment(e.target.value)}>{methods.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
    <label>Comprobante / referencia<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="N.º de factura o comprobante" maxLength={100}/></label>
    <label>Notas<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Detalle adicional (opcional)" maxLength={500}/></label>
    <button className="primary compact" disabled={saving}>{saving?'Guardando…':'Guardar gasto'}</button>
   </form>
   <div className="expense-history"><div className="expense-filters"><label>Desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><label>Categoría<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Todas</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div>
    <div className="data-table"><div className="table-row expense-table table-head"><span>Fecha / Categoría</span><span>Descripción</span><span>Medio de pago</span><span>Importe</span></div>
    {loading?<div className="empty">Cargando gastos…</div>:rows.map(r=><div className="table-row expense-table" key={r.id}><span><b>{new Date(r.expense_date+'T12:00:00').toLocaleDateString('es-AR')}</b><small>{r.category}</small></span><span><b>{r.description}</b>{r.reference&&<small>Ref.: {r.reference}</small>}{r.notes&&<small>{r.notes}</small>}</span><span>{methodLabel(r.payment_method)}</span><b>{money(r.amount)}</b></div>)}
    {!loading&&!rows.length&&<div className="empty">No hay gastos en el período seleccionado.</div>}
    </div>
   </div>
  </div>
 </section>
}
