"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, Search, TrendingUp, Package, Receipt, Wallet, History, Save, FileUp, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

type Mode = 'sales' | 'cash' | 'pricing' | 'stats' | 'inventory'
type Product = { id:string; name:string; brand?:string|null; presentation?:string|null; barcode:string|null; sale_price:number; cost_price:number; vat_rate:number; stock:number; min_stock:number; unit:string; manages_stock:boolean }
type Sale = { id:string; sale_number:number; sold_at:string; status:string; subtotal:number; discount:number; total:number; cashier_id:string|null }
type Cash = { id:string; opened_by:string; opened_at:string; opening_amount:number; closed_by:string|null; closed_at:string|null; closing_amount:number|null; expected_amount:number|null; notes:string|null }
type CashMovement = { id:string; session_id:string; movement_type:string; amount:number; description:string; created_by:string|null; created_at:string }
const money=(v:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(Number(v||0))
const date=(v:string|null)=>v?new Date(v).toLocaleString('es-AR'):'—'
const pct=(v:number)=>`${v.toFixed(1)}%`

export default function ManagementPanel({mode}:{mode:Mode}) {
 const db=useMemo(()=>createClient(),[])
 const [products,setProducts]=useState<Product[]>([])
 const [sales,setSales]=useState<Sale[]>([])
 const [cash,setCash]=useState<Cash[]>([])
 const [cashMovements,setCashMovements]=useState<CashMovement[]>([])
 const [profiles,setProfiles]=useState<Record<string,string>>({})
 const [priceEdits,setPriceEdits]=useState<Record<string,{cost:string;sale:string;vat:string}>>({})
 const [importing,setImporting]=useState(false)
 const [importMessage,setImportMessage]=useState('')
 const [items,setItems]=useState<Record<string,any[]>>({})
 const [payments,setPayments]=useState<Record<string,any[]>>({})
 const [expanded,setExpanded]=useState<string|null>(null)
 const [priceHistory,setPriceHistory]=useState<any[]>([])
 const [query,setQuery]=useState('')
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [movements,setMovements]=useState<any[]>([])
 const [adjustProduct,setAdjustProduct]=useState('')
 const [adjustQty,setAdjustQty]=useState('')
 const [adjustNotes,setAdjustNotes]=useState('')
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  if(mode==='pricing'||mode==='stats'||mode==='inventory'){
   const {data,error}=await db.rpc('get_products_management')
   if(error)setError(error.message);else setProducts(((data||[]) as Product[]).sort((a,b)=>a.name.localeCompare(b.name)))
  }
  if(mode==='sales'||mode==='stats'){
   const {data,error}=await db.from('sales').select('id,sale_number,sold_at,status,subtotal,discount,total,cashier_id').order('sold_at',{ascending:false}).limit(500)
   if(error)setError(error.message);else setSales((data||[]) as Sale[])
  }
  if(mode==='inventory'){
   const {data,error}=await db.from('stock_movements').select('id,product_id,movement_type,quantity_delta,notes,created_by,created_at').order('created_at',{ascending:false}).limit(250)
   if(error)setError(error.message);else setMovements(data||[])
  }
  if(mode==='cash'){
   const [sessionsResult,movementsResult]=await Promise.all([
    db.from('cash_sessions').select('id,opened_by,opened_at,opening_amount,closed_by,closed_at,closing_amount,expected_amount,notes').order('opened_at',{ascending:false}).limit(300),
    db.from('cash_movements').select('id,session_id,movement_type,amount,description,created_by,created_at').order('created_at',{ascending:false}).limit(500)
   ])
   if(sessionsResult.error)setError(sessionsResult.error.message);else setCash((sessionsResult.data||[]) as Cash[])
   if(movementsResult.error)setError(movementsResult.error.message);else setCashMovements((movementsResult.data||[]) as CashMovement[])
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
 async function submitStockAdjustment(){
  const qty=Number(adjustQty)
  if(!adjustProduct||!Number.isFinite(qty)||qty===0){setError('Elegí un producto e ingresá una cantidad distinta de cero.');return}
  const {error}=await db.rpc('adjust_product_stock',{p_product_id:adjustProduct,p_quantity_delta:qty,p_notes:adjustNotes.trim()||null})
  if(error){setError(error.message);return}
  setAdjustQty('');setAdjustNotes('');setAdjustProduct('');await load()
 }
 async function savePrice(p:Product){
  const edit=priceEdits[p.id];if(!edit)return
  const cost=Number(edit.cost),sale=Number(edit.sale)
  if(!Number.isFinite(cost)||!Number.isFinite(sale)||cost<0||sale<=0){setError('Ingresá costo válido y precio de venta mayor que cero.');return}
  const vat=Number(edit.vat);if(!Number.isFinite(vat)||vat<0||vat>100){setError('IVA inválido.');return}
  const {error}=await db.from('products').update({cost_price:cost,sale_price:sale,vat_rate:vat}).eq('id',p.id)
  if(error)setError(error.message);else{setPriceEdits(v=>{const n={...v};delete n[p.id];return n});await load()}
 }
 async function importPriceFile(file:File){
  setImporting(true);setImportMessage('Leyendo archivo…');setError('')
  try{
   const buffer=await file.arrayBuffer()
   const workbook=XLSX.read(buffer,{type:'array'})
   const sheet=workbook.Sheets[workbook.SheetNames[0]]
   const rows:any[]=XLSX.utils.sheet_to_json(sheet,{defval:''})
   if(!rows.length)throw new Error('El archivo no contiene filas de productos.')
   const normalize=(v:string)=>v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')
   const pick=(row:any,keys:string[])=>{const found=Object.keys(row).find(k=>keys.includes(normalize(k)));return found?row[found]:''}
   const num=(v:any)=>{if(typeof v==='number')return v;const t=String(v??'').trim().replace(/[$\s]/g,'');if(!t)return 0;const normalized=t.includes(',')?t.replace(/\./g,'').replace(',','.'):t;const n=Number(normalized);return Number.isFinite(n)?n:0}
   const prepared=rows.map((r:any)=>{const name=String(pick(r,['articulo','producto','descripcion','nombre'])).trim();if(!name)return null;
    const vat=num(pick(r,['iva','alicuota','tasaiva'])||21)
    const grossCost=num(pick(r,['costoconiva','preciocompraconiva','compraconiva'])||0)
    const netCost=num(pick(r,['costosiniva','preciocomprasiniva','comprasiniva','costo','preciocompra'])||0) || (grossCost/(1+vat/100))
    const sale=num(pick(r,['precioventaconiva','precioventa','venta','preciofinal'])||0)
    const margin=num(pick(r,['margen','margenganancia','porcentajeganancia'])||0)
    const finalSale=sale>0?sale:netCost*(1+margin/100)*(1+vat/100)
    return {name,barcode:String(pick(r,['codigobarra','codigodebarra','codigo','sku'])||'').trim()||null,cost_price:netCost,sale_price:finalSale,vat_rate:vat,active:true,manages_stock:true}
   }).filter(Boolean) as any[]
   if(!prepared.length)throw new Error('No encontré una columna Artículo/Producto/Descripción.')
   let created=0,updated=0
   for(const item of prepared){
    const existing=products.find(p=>(item.barcode&&p.barcode===item.barcode)||p.name.toLowerCase()===item.name.toLowerCase())
    if(existing){const {error}=await db.from('products').update({cost_price:item.cost_price,sale_price:item.sale_price,vat_rate:item.vat_rate,barcode:item.barcode||existing.barcode}).eq('id',existing.id);if(error)throw error;updated++}
    else{const {error}=await db.from('products').insert(item);if(error)throw error;created++}
   }
   setImportMessage('Importación finalizada: '+created+' nuevos y '+updated+' actualizados.');await load()
  }catch(e:any){setError(e.message||'No se pudo importar el archivo.');setImportMessage('')}
  finally{setImporting(false)}
 }
 const title={sales:'Historial de ventas',cash:'Historial de cajas',pricing:'Listas de precios y rentabilidad',stats:'Estadísticas y reposición',inventory:'Inventario y movimientos'}[mode]
 return <section className="management">
  <div className="management-head"><div><p className="eyebrow">GESTIÓN COMERCIAL</p><h1>{title}</h1><p className="muted">{mode==='stats'?'Rotación, ventas por producto y alertas para planificar compras.':mode==='pricing'?'Costos, precios de venta, márgenes y auditoría de cambios.':'Consultá operaciones registradas en el sistema.'}</p></div><button className="secondary refresh" onClick={()=>void load()}><RefreshCw size={15}/> Actualizar</button></div>
  {error&&<p className="notice">{error}</p>}
  {loading?<div className="empty">Cargando información…</div>:null}
  {!loading&&mode==='inventory'&&<><div className="stats-cards"><div><Package/><small>Productos activos</small><b>{products.length}</b></div><div><Wallet/><small>Con stock bajo</small><b>{products.filter(p=>p.manages_stock&&Number(p.stock)<=Number(p.min_stock)).length}</b></div><div><TrendingUp/><small>Unidades en inventario</small><b>{products.reduce((a,p)=>a+Number(p.stock),0).toLocaleString('es-AR')}</b></div><div><Receipt/><small>Movimientos recientes</small><b>{movements.length}</b></div></div><h2 className="subheading">Ajustar inventario</h2><p className="muted">Ingresá cantidades positivas para sumar stock y negativas para registrar mermas, roturas o correcciones. Cada ajuste queda auditado con usuario y fecha.</p><div className="stock-adjust"><select value={adjustProduct} onChange={e=>setAdjustProduct(e.target.value)}><option value="">Seleccionar producto</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.presentation||p.unit} · Stock: {p.stock}</option>)}</select><input type="number" step="0.001" value={adjustQty} onChange={e=>setAdjustQty(e.target.value)} placeholder="Cantidad (+ / -)"/><input value={adjustNotes} onChange={e=>setAdjustNotes(e.target.value)} placeholder="Motivo: rotura, conteo, vencimiento…"/><button className="primary compact" onClick={()=>void submitStockAdjustment()}>Registrar ajuste</button></div><h2 className="subheading">Stock actual y alertas</h2><div className="data-table"><div className="table-row stock-table table-head"><span>Producto</span><span>Código</span><span>Stock</span><span>Mínimo</span><span>Estado</span></div>{products.map(p=>{const low=p.manages_stock&&Number(p.stock)<=Number(p.min_stock);return <div className="table-row stock-table" key={p.id}><span><b>{p.name}</b><small>{[p.brand,p.presentation].filter(Boolean).join(' · ')}</small></span><span>{p.barcode||'—'}</span><b>{p.stock} {p.unit}</b><span>{p.min_stock} {p.unit}</span><b className={low?'negative':'positive'}>{low?'Reponer':'Correcto'}</b></div>})}</div><h2 className="subheading"><History size={17}/> Historial de movimientos</h2><div className="data-table"><div className="table-row movement-table table-head"><span>Fecha</span><span>Producto</span><span>Movimiento</span><span>Cantidad</span><span>Responsable</span></div>{movements.map(m=><div className="table-row movement-table" key={m.id}><span>{date(m.created_at)}</span><span>{products.find(p=>p.id===m.product_id)?.name||'Producto'}</span><span>{m.movement_type}</span><b className={Number(m.quantity_delta)>=0?'positive':'negative'}>{Number(m.quantity_delta)>0?'+':''}{m.quantity_delta}</b><span>{profiles[m.created_by||'']||'—'}</span></div>)}{!movements.length&&<div className="empty">Todavía no hay movimientos de inventario.</div>}</div></>}
  {!loading&&mode==='sales'&&<div className="data-table"><div className="table-row table-head"><span>N.º / Fecha</span><span>Vendedor</span><span>Estado</span><span>Total</span></div>{sales.map(s=><div key={s.id}><button className="table-row table-button" onClick={()=>void expandSale(s)}><span><b>#{s.sale_number}</b><small>{date(s.sold_at)}</small></span><span>{profiles[s.cashier_id||'']||'—'}</span><span>{s.status}</span><b>{money(s.total)}</b></button>{expanded===s.id&&<div className="sale-detail"><b>Productos vendidos</b>{(items[s.id]||[]).map((i,n)=><div className="detail-line" key={n}><span>{i.product_name} · {i.quantity} {i.unit}</span><b>{money(i.line_total)}</b></div>)}<b>Medios de pago</b>{(payments[s.id]||[]).map((p,n)=><div className="detail-line" key={n}><span>{p.method}</span><b>{money(p.amount)}</b></div>)}</div>}</div>)}{!sales.length&&<div className="empty">Todavía no hay ventas registradas.</div>}</div>}
  {!loading&&mode==='cash'&&<>
   <div className="data-table">
    <div className="table-row table-head cash-table"><span>Apertura</span><span>Responsable</span><span>Cierre</span><span>Diferencia</span></div>
    {cash.map(c=>{const diff=c.closing_amount===null||c.expected_amount===null?null:Number(c.closing_amount)-Number(c.expected_amount);return <div className="table-row cash-table" key={c.id}><span><b>{money(c.opening_amount)}</b><small>{date(c.opened_at)}</small></span><span>{profiles[c.opened_by]||'—'}</span><span>{c.closed_at?<><b>{money(Number(c.closing_amount))}</b><small>{date(c.closed_at)}</small></>:'Caja abierta'}</span><b className={diff===null?'':diff===0?'positive':'negative'}>{diff===null?'—':money(diff)}</b></div>})}
    {!cash.length&&<div className="empty">Todavía no hay aperturas de caja.</div>}
   </div>
   <h2 className="subheading">Movimientos de caja</h2>
   <div className="data-table">
    <div className="table-row cash-movement-table table-head"><span>Fecha</span><span>Tipo</span><span>Detalle</span><span>Responsable</span><span>Importe</span></div>
    {cashMovements.map(m=><div className="table-row cash-movement-table" key={m.id}><span>{date(m.created_at)}</span><b>{m.movement_type}</b><span>{m.description}</span><span>{profiles[m.created_by||'']||'Usuario'}</span><b className={m.movement_type==='in'||m.movement_type==='sale'?'positive':'negative'}>{money(Number(m.amount))}</b></div>)}
    {!cashMovements.length&&<div className="empty">Todavía no hay movimientos de caja.</div>}
   </div>
  </>}{!loading&&mode==='pricing'&&<><div className="price-toolbar"><div className="searchbox"><Search size={17}/><input placeholder="Buscar producto…" value={query} onChange={e=>setQuery(e.target.value)}/></div><label className="primary import-button"><FileUp size={16}/> {importing?'Importando…':'Importar Excel'}<input type="file" accept=".xlsx,.xls,.csv" disabled={importing} onChange={e=>{const file=e.target.files?.[0];if(file)void importPriceFile(file);e.currentTarget.value=''}}/></label></div>{importMessage&&<p className="positive import-note">{importMessage}</p>}<p className="muted import-help">Subí un Excel con columnas como Artículo, Código, Costo sin IVA, IVA, Margen y Precio de venta con IVA. Se actualizan los productos existentes por código o nombre.</p><div className="data-table"><div className="table-row price-table table-head"><span>Producto</span><span>Costo s/IVA</span><span>IVA %</span><span>Costo c/IVA</span><span>Margen s/costo</span><span>Venta c/IVA</span><span>Ganancia</span><span></span></div>{filteredProducts.map(p=>{const edit=priceEdits[p.id];const cost=Number(edit?.cost??p.cost_price);const vat=Number(edit?.vat??p.vat_rate??21);const sale=Number(edit?.sale??p.sale_price);const costGross=cost*(1+vat/100);const saleNet=sale/(1+vat/100);const margin=cost>0?((saleNet-cost)/cost)*100:0;const gain=sale-costGross;return <div className="table-row price-table" key={p.id}><span><b>{p.name}</b><small>Stock: {p.stock} {p.unit}</small></span><input aria-label="Costo sin IVA" type="number" min="0" value={edit?.cost??String(p.cost_price)} onChange={e=>setPriceEdits(v=>({...v,[p.id]:{cost:e.target.value,vat:edit?.vat??String(p.vat_rate??21),sale:edit?.sale??String(p.sale_price)}}))}/><input aria-label="IVA porcentaje" type="number" min="0" max="100" value={edit?.vat??String(p.vat_rate??21)} onChange={e=>setPriceEdits(v=>({...v,[p.id]:{cost:edit?.cost??String(p.cost_price),vat:e.target.value,sale:edit?.sale??String(p.sale_price)}}))}/><b>{money(costGross)}</b><b>{pct(margin)}</b><input aria-label="Precio venta con IVA" type="number" min="0.01" value={edit?.sale??String(p.sale_price)} onChange={e=>setPriceEdits(v=>({...v,[p.id]:{cost:edit?.cost??String(p.cost_price),vat:edit?.vat??String(p.vat_rate??21),sale:e.target.value}}))}/><b>{money(gain)}</b><button className="icon-button" title="Guardar precios" onClick={()=>void savePrice(p)}><Save size={16}/></button></div>})}{!filteredProducts.length&&<div className="empty">No hay productos para mostrar.</div>}</div><h2 className="subheading"><History size={17}/> Últimos cambios de precios</h2><div className="data-table">{priceHistory.map(h=><div className="history-line" key={h.id}><span>{products.find(p=>p.id===h.product_id)?.name||'Producto'}</span><span>{money(h.old_sale_price)} → {money(h.new_sale_price)}</span><small>{date(h.changed_at)} · {profiles[h.changed_by||'']||'Usuario'}</small></div>)}{!priceHistory.length&&<p className="empty">Los cambios de precio que realices quedarán registrados aquí.</p>}</div></>}
  {!loading&&mode==='stats'&&<><div className="stats-cards"><div><TrendingUp/><small>Ventas registradas</small><b>{sales.length}</b></div><div><Receipt/><small>Facturación histórica</small><b>{money(sales.reduce((a,s)=>a+Number(s.total),0))}</b></div><div><Package/><small>Productos activos</small><b>{products.length}</b></div><div><Wallet/><small>Unidades vendidas</small><b>{sales.length?'Ver detalle por producto':''}{sales.length? '': '0'}</b></div></div><h2 className="subheading">Venta por producto y sugerencia de compra</h2><p className="muted">El sistema usa las ventas de los últimos 30 días, suma el plazo de entrega del proveedor más 14 días de seguridad y recomienda la cantidad necesaria. También considera la compra mínima y prioriza el menor costo final con IVA.</p><div className="data-table"><div className="table-row stats-table table-head"><span>Producto</span><span>Unidades / 30 días</span><span>Promedio diario</span><span>Stock actual</span><span>Cobertura</span><span>Reponer</span><span>Proveedor sugerido</span><span>Inversión estimada</span></div>{products.map(p=><ProductStat key={p.id} product={p} db={db}/>)}</div></>}
 </section>
}
function ProductStat({product:p,db}:{product:Product;db:any}){
 const [qty,setQty]=useState(0)
 const [quotes,setQuotes]=useState<any[]>([])
 useEffect(()=>{let active=true;Promise.all([
  db.from('sale_items').select('quantity,sales!inner(sold_at)').eq('product_id',p.id).gte('sales.sold_at',new Date(Date.now()-30*86400000).toISOString()),
  db.from('supplier_products').select('last_cost_net,vat_rate,lead_time_days,minimum_order_qty,suppliers(name)').eq('product_id',p.id)
 ]).then(([salesResult,quoteResult]:any[])=>{if(!active)return;setQty((salesResult.data||[]).reduce((a:number,x:any)=>a+Number(x.quantity),0));setQuotes(quoteResult.data||[])});return()=>{active=false}},[db,p.id])
 const daily=qty/30
 const best=[...quotes].sort((a,b)=>Number(a.last_cost_net)*(1+Number(a.vat_rate)/100)-Number(b.last_cost_net)*(1+Number(b.vat_rate)/100))[0]
 const lead=best?Math.max(0,Number(best.lead_time_days)||0):0
 const target=Math.ceil(daily*(lead+14))
 const needed=Math.max(0,target-Number(p.stock))
 const minimum=best?Math.max(0,Number(best.minimum_order_qty)||0):0
 const buy=needed>0?Math.max(needed,minimum):0
 const days=daily>0?Number(p.stock)/daily:null
 const unitCost=best?Number(best.last_cost_net)*(1+Number(best.vat_rate)/100):0
 const supplierName=best?.suppliers?.name||'—'
 return <div className="table-row stats-table"><span><b>{p.name}</b><small>{p.brand||''} {p.presentation||p.barcode||''}</small></span><b>{qty.toLocaleString('es-AR')}</b><span>{daily.toFixed(2)}</span><span>{p.stock} {p.unit}</span><span className={days!==null&&days<lead+7?'negative':''}>{days===null?'Sin ventas':`${days.toFixed(0)} días`}</span><b className={buy>0?'negative':'positive'}>{buy>0?`${buy} ${p.unit}`:'No comprar'}</b><span>{supplierName}{best?<small>Entrega: {lead} días · mínimo: {minimum}</small>:<small>Sin cotizaciones</small>}</span><b>{buy>0&&best?money(buy*unitCost):'—'}</b></div>
}
