"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, Search, TrendingUp, Package, Receipt, Wallet, History, Save } from 'lucide-react'

type Mode = 'sales' | 'cash' | 'pricing' | 'stats'
type Product = { id:string; name:string; barcode:string|null; sale_price:number; cost_price:number; stock:number; unit:string; manages_stock:boolean }
type Sale = { id:string; sale_number:number; sold_at:string; status:string; subtotal:number; discount:number; total:number; cashier_id:string|null }
type Cash = { id:string; opened_by:string; opened_at:string; opening_amount:number; closed_by:string|null; closed_at:string|null; closing_amount:number|null; expected_amount:number|null; notes:string|null }
const money=(v:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(Number(v||0))
const date=(v:string|null)=>v?new Date(v).toLocaleString('es-AR'):'—'
const pct=(v:number)=>`${v.toFixed(1)}%`

export default function ManagementPanel({mode}:{mode:Mode}) {
 const db=useMemo(()=>createClient(),[])
 const [products,setProducts]=useState<Product[]>([])
 const [sales,setSales]=useState<Sale[]>([])
 const [cash,setCash]=useState<Cash[]>([])
 const [profiles,setProfiles]=useState<Record<string,string>>({})
 const [priceEdits,setPriceEdits]=useState<Record<string,{cost:string;sale:string}>>({})
 const [items,setItems]=useState<Record<string,any[]>>({})
 const [payments,setPayments]=useState<Record<string,any[]>>({})
 const [expanded,setExpanded]=useState<string|null>(null)
 const [priceHistory,setPriceHistory]=useState<any[]>([])
 const [query,setQuery]=useState('')
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  if(mode==='pricing'||mode==='stats'){
   const {data,error}=await db.from('products').select('id,name,barcode,sale_price,cost_price,stock,unit,manages_stock').eq('active',true).order('name').limit(1000)
   if(error)setError(error.message);else setProducts((data||[]) as Product[])
  }
  if(mode==='sales'||mode==='stats'){
   const {data,error}=await db.from('sales').select('id,sale_number,sold_at,status,subtotal,discount,total,cashier_id').order('sold_at',{ascending:false}).limit(500)
   if(error)setError(error.message);else setSales((data||[]) as Sale[])
  }
  if(mode==='cash'){
   const {data,error}=await db.from('cash_sessions').select('id,opened_by,opened_at,opening_amount,closed_by,closed_at,closing_amount,expected_amount,notes').order('opened_at',{ascending:false}).limit(300)
   if(error)setError(error.message);else setCash((data||[]) as Cash[])
  }
  if(mode==='pricing'){
   const {data}=await db.from('product_price_history').select('id,product_id,old_cost_price,new_cost_price,old_sale_price,new_sale_price,changed_at,changed_by').order('changed_at',{ascending:false}).limit(100)
   setPriceHistory(data||[])
  }
  const {data:people}=await db.from('profiles').select('id,full_name')
  setProfiles(Object.fromEntries((people||[]).map((p:any)=>[p.id,p.full_name||'Usuario'])))
  setLoading(false)
 },[db,mode])
 useEffect(()=>{void load()},[load])
 const filteredProducts=products.filter(p=>p.name.toLowerCase().includes(query.toLowerCase())||(p.barcode||'').includes(query))
 async function expandSale(s:Sale){
  if(expanded===s.id){setExpanded(null);return}
  setExpanded(s.id)
  const [{data:a},{data:b}]=await Promise.all([db.from('sale_items').select('product_name,barcode,quantity,unit,unit_price,line_total').eq('sale_id',s.id),db.from('payments').select('method,amount,reference').eq('sale_id',s.id)])
  setItems(v=>({...v,[s.id]:a||[]}));setPayments(v=>({...v,[s.id]:b||[]}))
 }
 async function savePrice(p:Product){
  const edit=priceEdits[p.id];if(!edit)return
  const cost=Number(edit.cost),sale=Number(edit.sale)
  if(!Number.isFinite(cost)||!Number.isFinite(sale)||cost<0||sale<=0){setError('Ingresá costo válido y precio de venta mayor que cero.');return}
  const {error}=await db.from('products').update({cost_price:cost,sale_price:sale}).eq('id',p.id)
  if(error)setError(error.message);else{setPriceEdits(v=>{const n={...v};delete n[p.id];return n});await load()}
 }
 const title={sales:'Historial de ventas',cash:'Historial de cajas',pricing:'Listas de precios y rentabilidad',stats:'Estadísticas y reposición'}[mode]
 return <section className="management">
  <div className="management-head"><div><p className="eyebrow">GESTIÓN COMERCIAL</p><h1>{title}</h1><p className="muted">{mode==='stats'?'Rotación, ventas por producto y alertas para planificar compras.':mode==='pricing'?'Costos, precios de venta, márgenes y auditoría de cambios.':'Consultá operaciones registradas en el sistema.'}</p></div><button className="secondary refresh" onClick={()=>void load()}><RefreshCw size={15}/> Actualizar</button></div>
  {error&&<p className="notice">{error}</p>}
  {loading?<div className="empty">Cargando información…</div>:null}
  {!loading&&mode==='sales'&&<div className="data-table"><div className="table-row table-head"><span>N.º / Fecha</span><span>Vendedor</span><span>Estado</span><span>Total</span></div>{sales.map(s=><div key={s.id}><button className="table-row table-button" onClick={()=>void expandSale(s)}><span><b>#{s.sale_number}</b><small>{date(s.sold_at)}</small></span><span>{profiles[s.cashier_id||'']||'—'}</span><span>{s.status}</span><b>{money(s.total)}</b></button>{expanded===s.id&&<div className="sale-detail"><b>Productos vendidos</b>{(items[s.id]||[]).map((i,n)=><div className="detail-line" key={n}><span>{i.product_name} · {i.quantity} {i.unit}</span><b>{money(i.line_total)}</b></div>)}<b>Medios de pago</b>{(payments[s.id]||[]).map((p,n)=><div className="detail-line" key={n}><span>{p.method}</span><b>{money(p.amount)}</b></div>)}</div>}</div>)}{!sales.length&&<div className="empty">Todavía no hay ventas registradas.</div>}</div>}
  {!loading&&mode==='cash'&&<div className="data-table"><div className="table-row table-head cash-table"><span>Apertura</span><span>Responsable</span><span>Cierre</span><span>Diferencia</span></div>{cash.map(c=>{const diff=c.closing_amount===null||c.expected_amount===null?null:Number(c.closing_amount)-Number(c.expected_amount);return <div className="table-row cash-table" key={c.id}><span><b>{money(c.opening_amount)}</b><small>{date(c.opened_at)}</small></span><span>{profiles[c.opened_by]||'—'}</span><span>{c.closed_at?<><b>{money(Number(c.closing_amount))}</b><small>{date(c.closed_at)}</small></>:'Caja abierta'}</span><b className={diff===null?'':diff===0?'positive':'negative'}>{diff===null?'—':money(diff)}</b></div>})}{!cash.length&&<div className="empty">Todavía no hay aperturas de caja.</div>}</div>}
  {!loading&&mode==='pricing'&&<><div className="searchbox"><Search size={17}/><input placeholder="Buscar producto…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="data-table"><div className="table-row price-table table-head"><span>Producto</span><span>Costo</span><span>Venta</span><span>Margen</span><span>Ganancia</span><span></span></div>{filteredProducts.map(p=>{const margin=p.sale_price?((p.sale_price-p.cost_price)/p.sale_price)*100:0;const gain=p.sale_price-p.cost_price;const edit=priceEdits[p.id];return <div className="table-row price-table" key={p.id}><span><b>{p.name}</b><small>Stock: {p.stock} {p.unit}</small></span><input aria-label="Costo" type="number" min="0" value={edit?.cost??String(p.cost_price)} onChange={e=>setPriceEdits(v=>({...v,[p.id]:{cost:e.target.value,sale:edit?.sale??String(p.sale_price)}}))}/><input aria-label="Venta" type="number" min="0.01" value={edit?.sale??String(p.sale_price)} onChange={e=>setPriceEdits(v=>({...v,[p.id]:{cost:edit?.cost??String(p.cost_price),sale:e.target.value}}))}/><b>{pct(margin)}</b><b>{money(gain)}</b><button className="icon-button" title="Guardar precios" onClick={()=>void savePrice(p)}><Save size={16}/></button></div>})}{!filteredProducts.length&&<div className="empty">No hay productos para mostrar.</div>}</div><h2 className="subheading"><History size={17}/> Últimos cambios de precios</h2><div className="data-table">{priceHistory.map(h=><div className="history-line" key={h.id}><span>{products.find(p=>p.id===h.product_id)?.name||'Producto'}</span><span>{money(h.old_sale_price)} → {money(h.new_sale_price)}</span><small>{date(h.changed_at)} · {profiles[h.changed_by||'']||'Usuario'}</small></div>)}{!priceHistory.length&&<p className="empty">Los cambios de precio que realices quedarán registrados aquí.</p>}</div></>}
  {!loading&&mode==='stats'&&<><div className="stats-cards"><div><TrendingUp/><small>Ventas registradas</small><b>{sales.length}</b></div><div><Receipt/><small>Facturación histórica</small><b>{money(sales.reduce((a,s)=>a+Number(s.total),0))}</b></div><div><Package/><small>Productos activos</small><b>{products.length}</b></div><div><Wallet/><small>Unidades vendidas</small><b>{sales.length?'Ver detalle por producto':''}{sales.length? '': '0'}</b></div></div><h2 className="subheading">Venta por producto y sugerencia de compra</h2><p className="muted">Cálculo sobre los últimos 30 días disponibles. La sugerencia contempla 14 días de cobertura; ajustala según el plazo real de cada proveedor.</p><div className="data-table"><div className="table-row stats-table table-head"><span>Producto</span><span>Unidades / 30 días</span><span>Promedio diario</span><span>Stock actual</span><span>Alcanza para</span><span>Comprar</span></div>{products.map(p=>{const sold=sales.filter(s=>new Date(s.sold_at).getTime()>Date.now()-30*86400000).reduce((sum,s)=>sum,0);return <ProductStat key={p.id} product={p} db={db} soldFallback={sold}/>})}</div></>}
 </section>
}
function ProductStat({product:p,db,soldFallback}:{product:Product;db:any;soldFallback:number}){
 const [qty,setQty]=useState(0)
 useEffect(()=>{let active=true;db.from('sale_items').select('quantity,sale_id,sales!inner(sold_at)').eq('product_id',p.id).gte('sales.sold_at',new Date(Date.now()-30*86400000).toISOString()).then(({data}:any)=>{if(active)setQty((data||[]).reduce((a:number,x:any)=>a+Number(x.quantity),0))});return()=>{active=false}},[db,p.id])
 const daily=qty/30;const days=daily>0?Number(p.stock)/daily:null;const target=Math.ceil(daily*14);const buy=Math.max(0,target-Number(p.stock))
 return <div className="table-row stats-table"><span><b>{p.name}</b><small>{p.barcode||'Sin código'}</small></span><b>{qty}</b><span>{daily.toFixed(2)}</span><span>{p.stock} {p.unit}</span><span className={days!==null&&days<7?'negative':''}>{days===null?'Sin ventas':`${days.toFixed(0)} días`}</span><b className={buy>0?'negative':'positive'}>{buy>0?`${buy} ${p.unit}`:'No comprar'}</b></div>
}
