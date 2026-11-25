"use client"
import {useCallback,useEffect,useMemo,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {RefreshCw,TrendingUp,Wallet,Receipt,Truck,ChartNoAxesCombined} from 'lucide-react'
const money=(v:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(v||0))
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
const month=()=>today().slice(0,8)+'01'
export default function FinancialDashboard(){
 const db=useMemo(()=>createClient(),[])
 const [from,setFrom]=useState(month());const [to,setTo]=useState(today())
 const [sales,setSales]=useState(0);const [expenses,setExpenses]=useState(0);const [supplierPaid,setSupplierPaid]=useState(0);const [purchaseDebt,setPurchaseDebt]=useState(0)
 const [saleCount,setSaleCount]=useState(0);const [expenseCount,setExpenseCount]=useState(0);const [overdue,setOverdue]=useState(0)
 const [loading,setLoading]=useState(true);const [error,setError]=useState('')
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  const [s,e,p,allP,paid]=await Promise.all([
   db.from('sales').select('id,total').eq('status','completed').gte('sold_at',from+'T00:00:00').lte('sold_at',to+'T23:59:59'),
   db.from('operating_expenses').select('id,amount').gte('expense_date',from).lte('expense_date',to),
   db.from('supplier_payments').select('amount').gte('payment_date',from).lte('payment_date',to),
   db.from('purchases').select('id,total,due_date,status').eq('status','received'),
   db.from('supplier_payments').select('purchase_id,amount')
  ])
  const err=s.error||e.error||p.error||allP.error||paid.error
  if(err){setError(err.message);setLoading(false);return}
  const saleRows=s.data||[],expenseRows=e.data||[],paymentRows=p.data||[]
  setSales(saleRows.reduce((a,x)=>a+Number(x.total),0));setSaleCount(saleRows.length)
  setExpenses(expenseRows.reduce((a,x)=>a+Number(x.amount),0));setExpenseCount(expenseRows.length)
  setSupplierPaid(paymentRows.reduce((a,x)=>a+Number(x.amount),0))
  const paidBy=new Map<string,number>();(paid.data||[]).forEach(x=>paidBy.set(x.purchase_id,(paidBy.get(x.purchase_id)||0)+Number(x.amount)))
  const debts=(allP.data||[]).map(x=>({balance:Math.max(0,Number(x.total)-(paidBy.get(x.id)||0)),due:x.due_date}))
  setPurchaseDebt(debts.reduce((a,x)=>a+x.balance,0))
  setOverdue(debts.filter(x=>x.balance>.005&&x.due&&x.due<today()).reduce((a,x)=>a+x.balance,0))
  setLoading(false)
 },[db,from,to])
 useEffect(()=>{void load()},[load])
 const net=sales-expenses-supplierPaid
 return <section className="management finance-dashboard">
  <div className="management-head"><div><p className="eyebrow">DIRECCIÓN · SÚPERVECINO</p><h1>Panel del dueño</h1><p className="muted">Resumen financiero con ventas registradas, gastos operativos y pagos reales a proveedores.</p></div><button className="secondary refresh" onClick={()=>void load()}><RefreshCw size={15}/> Actualizar</button></div>
  <div className="finance-filters"><label>Desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
  {error&&<p className="notice">{error}</p>}
  {loading?<div className="empty">Calculando indicadores…</div>:<>
   <div className="finance-cards">
    <article><span><TrendingUp/></span><small>Ventas registradas</small><b>{money(sales)}</b><em>{saleCount} operaciones</em></article>
    <article><span><Receipt/></span><small>Gastos operativos</small><b>{money(expenses)}</b><em>{expenseCount} movimientos</em></article>
    <article><span><Truck/></span><small>Pagos a proveedores</small><b>{money(supplierPaid)}</b><em>Pagos efectuados en el período</em></article>
    <article className={net>=0?'finance-positive':'finance-negative'}><span><Wallet/></span><small>Flujo neto registrado</small><b>{money(net)}</b><em>Ventas − gastos − pagos a proveedores</em></article>
   </div>
   <div className="finance-lower">
    <article><div><ChartNoAxesCombined/><h2>Compromisos con proveedores</h2></div><strong>{money(purchaseDebt)}</strong><p>Saldo pendiente de facturas recibidas, descontando los pagos registrados.</p></article>
    <article className={overdue>0?'finance-overdue':''}><div><Receipt/><h2>Facturas vencidas pendientes</h2></div><strong>{money(overdue)}</strong><p>Saldo de facturas recibidas cuyo vencimiento ya pasó.</p></article>
   </div>
   <p className="finance-footnote">Importante: el flujo es un resumen de ventas y egresos registrados; no equivale al saldo bancario o efectivo físico. No incluye movimientos que todavía no se hayan cargado. La rentabilidad por producto se calcula aparte y puede variar según el costo actualizado.</p>
  </>}
 </section>
}
