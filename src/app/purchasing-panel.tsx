"use client"
import {useCallback,useEffect,useMemo,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {RefreshCw,Plus,Truck,ArrowDownToLine} from 'lucide-react'
const money=(v:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(Number(v||0))
type Supplier={id:string;name:string;phone:string|null;tax_id:string|null}
type Product={id:string;name:string;brand:string|null;presentation:string|null;stock:number;unit:string}
type Quote={id:string;supplier_id:string;product_id:string;last_cost_net:number;vat_rate:number;lead_time_days:number;minimum_order_qty:number}
export default function PurchasingPanel(){
 const db=useMemo(()=>createClient(),[])
 const [suppliers,setSuppliers]=useState<Supplier[]>([])
 const [products,setProducts]=useState<Product[]>([])
 const [quotes,setQuotes]=useState<Quote[]>([])
 const [purchases,setPurchases]=useState<any[]>([])
 const [name,setName]=useState('');const [phone,setPhone]=useState('');const [tax,setTax]=useState('')
 const [supplier,setSupplier]=useState('');const [product,setProduct]=useState('');const [cost,setCost]=useState('');const [vat,setVat]=useState('21');const [lead,setLead]=useState('2');const [minimum,setMinimum]=useState('1')
 const [buySupplier,setBuySupplier]=useState('');const [buyProduct,setBuyProduct]=useState('');const [buyQty,setBuyQty]=useState('');const [buyCost,setBuyCost]=useState('');const [buyVat,setBuyVat]=useState('21')
 const [invoiceNumber,setInvoiceNumber]=useState('');const [purchaseDate,setPurchaseDate]=useState(new Date().toISOString().slice(0,10));const [dueDate,setDueDate]=useState('');const [purchaseNotes,setPurchaseNotes]=useState('')
 const [cart,setCart]=useState<Array<{product_id:string;name:string;quantity:number;unit_cost_net:number;vat_rate:number;unit:string}>>([])
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [query,setQuery]=useState('')
 const load=useCallback(async()=>{
  setBusy(true)
  const [a,b,c,d]=await Promise.all([
   db.from('suppliers').select('id,name,phone,tax_id').eq('active',true).order('name'),
   db.from('products').select('id,name,brand,presentation,stock,unit').eq('active',true).order('name'),
   db.from('supplier_products').select('id,supplier_id,product_id,last_cost_net,vat_rate,lead_time_days,minimum_order_qty'),
   db.from('purchases').select('id,invoice_number,purchase_date,due_date,status,total,supplier_id').order('created_at',{ascending:false}).limit(100)
  ])
  setSuppliers(a.data||[]);setProducts(b.data||[]);setQuotes(c.data||[]);setPurchases(d.data||[])
  if(a.error||b.error||c.error||d.error)setMessage((a.error||b.error||c.error||d.error)?.message||'Error cargando datos')
  setBusy(false)
 },[db])
 useEffect(()=>{void load()},[load])
 async function addSupplier(e:React.FormEvent){e.preventDefault();const {error}=await db.from('suppliers').insert({name:name.trim(),phone:phone.trim()||null,tax_id:tax.trim()||null});if(error){setMessage(error.message);return}setName('');setPhone('');setTax('');setMessage('Proveedor guardado.');await load()}
 async function saveQuote(e:React.FormEvent){e.preventDefault();const {error}=await db.from('supplier_products').upsert({supplier_id:supplier,product_id:product,last_cost_net:Number(cost),vat_rate:Number(vat),lead_time_days:Number(lead),minimum_order_qty:Number(minimum),updated_at:new Date().toISOString()},{onConflict:'supplier_id,product_id'});if(error){setMessage(error.message);return}setMessage('Precio del proveedor actualizado.');await load()}
 function addPurchaseLine(){
  const p=products.find(x=>x.id===buyProduct)
  if(!p||Number(buyQty)<=0||Number(buyCost)<0||!Number.isFinite(Number(buyVat))||Number(buyVat)<0||Number(buyVat)>100){setMessage('Completá producto, cantidad, costo e IVA válidos.');return}
  setCart(v=>[...v,{product_id:p.id,name:`${p.name} ${p.presentation||''}`.trim(),quantity:Number(buyQty),unit_cost_net:Number(buyCost),vat_rate:Number(buyVat),unit:p.unit}])
  setBuyProduct('');setBuyQty('');setBuyCost('');setMessage('')
 }
 async function createPurchase(e:React.FormEvent){
  e.preventDefault()
  if(!buySupplier||!cart.length){setMessage('Elegí un proveedor y agregá al menos un producto.');return}
  setBusy(true)
  const {data,error}=await db.rpc('create_purchase_with_items',{p_supplier_id:buySupplier,p_invoice_number:invoiceNumber||null,p_purchase_date:purchaseDate||null,p_due_date:dueDate||null,p_notes:purchaseNotes||null,p_items:cart.map(x=>({product_id:x.product_id,quantity:x.quantity,unit_cost_net:x.unit_cost_net,vat_rate:x.vat_rate}))})
  setBusy(false)
  if(error){setMessage(error.message);return}
  setMessage('Compra registrada como borrador con todos sus artículos. Recibila para ingresar el stock.')
  setCart([]);setInvoiceNumber('');setDueDate('');setPurchaseNotes('');await load()
 }
 async function receive(id:string){const {error}=await db.rpc('receive_purchase',{p_purchase_id:id});setMessage(error?.message||'Compra recibida y stock actualizado.');await load()}
 const comparisons=quotes.filter(q=>products.find(p=>p.id===q.product_id)?.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.last_cost_net*(1+a.vat_rate/100)-b.last_cost_net*(1+b.vat_rate/100))
 return <section className="management"><div className="management-head"><div><p className="eyebrow">ABASTECIMIENTO</p><h1>Proveedores y compras</h1><p className="muted">Compará costos finales, registrá compras y actualizá el inventario al recibir mercadería.</p></div><button className="secondary refresh" onClick={()=>void load()}><RefreshCw size={15}/> Actualizar</button></div>
 {message&&<p className="notice">{message}</p>}
 <div className="purchase-grid"><form className="purchase-card" onSubmit={addSupplier}><h2><Truck size={18}/> Alta de proveedor</h2><input required placeholder="Nombre / razón social" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="CUIT" value={tax} onChange={e=>setTax(e.target.value)}/><input placeholder="Teléfono" value={phone} onChange={e=>setPhone(e.target.value)}/><button className="primary compact"><Plus size={15}/> Guardar proveedor</button></form>
 <form className="purchase-card" onSubmit={saveQuote}><h2>Registrar / actualizar precio</h2><select required value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="">Proveedor</option>{suppliers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select required value={product} onChange={e=>setProduct(e.target.value)}><option value="">Producto / presentación</option>{products.map(x=><option key={x.id} value={x.id}>{x.name} {x.presentation||''}</option>)}</select><div className="purchase-fields"><input required type="number" min="0" step=".01" placeholder="Costo sin IVA" value={cost} onChange={e=>setCost(e.target.value)}/><input type="number" min="0" max="100" placeholder="IVA %" value={vat} onChange={e=>setVat(e.target.value)}/><input type="number" min="0" placeholder="Entrega (días)" value={lead} onChange={e=>setLead(e.target.value)}/><input type="number" min=".001" step=".001" placeholder="Compra mínima" value={minimum} onChange={e=>setMinimum(e.target.value)}/></div><button className="primary compact">Guardar precio</button></form></div>
 <h2 className="subheading">Comparador de proveedores</h2><div className="searchbox"><input placeholder="Filtrar por producto…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="data-table"><div className="table-row supplier-table table-head"><span>Producto</span><span>Proveedor</span><span>Costo neto</span><span>IVA</span><span>Costo final</span><span>Entrega</span></div>{comparisons.map(q=>{const p=products.find(x=>x.id===q.product_id);const sp=suppliers.find(x=>x.id===q.supplier_id);return <div className="table-row supplier-table" key={q.id}><b>{p?.name} {p?.presentation||''}</b><span>{sp?.name||'—'}</span><span>{money(q.last_cost_net)}</span><span>{q.vat_rate}%</span><b>{money(q.last_cost_net*(1+q.vat_rate/100))}</b><span>{q.lead_time_days} días</span></div>})}{!comparisons.length&&<p className="empty">Cargá precios de proveedores para compararlos. El menor costo final aparece primero.</p>}</div>
 <h2 className="subheading">Registrar factura de compra</h2><form className="purchase-card purchase-create" onSubmit={createPurchase}>
 <div className="purchase-fields"><select required value={buySupplier} onChange={e=>setBuySupplier(e.target.value)}><option value="">Proveedor</option>{suppliers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><input placeholder="Número de factura" value={invoiceNumber} onChange={e=>setInvoiceNumber(e.target.value)}/><input type="date" aria-label="Fecha de compra" value={purchaseDate} onChange={e=>setPurchaseDate(e.target.value)}/><input type="date" aria-label="Vencimiento" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div>
 <h3>Agregar artículos</h3><div className="purchase-fields"><select value={buyProduct} onChange={e=>{setBuyProduct(e.target.value);const q=quotes.find(x=>x.product_id===e.target.value&&x.supplier_id===buySupplier);if(q){setBuyCost(String(q.last_cost_net));setBuyVat(String(q.vat_rate))}}}><option value="">Producto / presentación</option>{products.map(x=><option key={x.id} value={x.id}>{x.name} {x.presentation||''}</option>)}</select><input type="number" min=".001" step=".001" placeholder="Cantidad" value={buyQty} onChange={e=>setBuyQty(e.target.value)}/><input type="number" min="0" step=".01" placeholder="Costo unitario sin IVA" value={buyCost} onChange={e=>setBuyCost(e.target.value)}/><input type="number" min="0" max="100" step=".01" placeholder="IVA %" value={buyVat} onChange={e=>setBuyVat(e.target.value)}/><button type="button" className="secondary compact" onClick={addPurchaseLine}><Plus size={15}/> Agregar artículo</button></div>
 {cart.length>0&&<div className="data-table"><div className="table-row purchase-table table-head"><span>Artículo</span><span>Cantidad</span><span>Costo neto</span><span>IVA</span><span>Total línea</span><span></span></div>{cart.map((x,i)=><div className="table-row purchase-table" key={i}><span>{x.name}</span><span>{x.quantity} {x.unit}</span><span>{money(x.unit_cost_net)}</span><span>{x.vat_rate}%</span><b>{money(x.quantity*x.unit_cost_net*(1+x.vat_rate/100))}</b><button type="button" className="secondary compact" onClick={()=>setCart(v=>v.filter((_,n)=>n!==i))}>Quitar</button></div>)}</div>}
 <textarea placeholder="Observaciones de la factura (opcional)" value={purchaseNotes} onChange={e=>setPurchaseNotes(e.target.value)}/>
 <div className="purchase-total"><span>{cart.length} artículos · Total factura</span><b>{money(cart.reduce((s,x)=>s+x.quantity*x.unit_cost_net*(1+x.vat_rate/100),0))}</b></div>
 <button className="primary compact" disabled={busy||!cart.length||!buySupplier}>{busy?'Guardando…':'Guardar factura como borrador'}</button>
 </form>
 <h2 className="subheading">Historial de compras</h2><div className="data-table"><div className="table-row purchase-table table-head"><span>Fecha</span><span>Proveedor</span><span>Vencimiento</span><span>Estado</span><span>Total</span><span>Acción</span></div>{purchases.map(p=><div className="table-row purchase-table" key={p.id}><span>{new Date(p.purchase_date+'T12:00:00').toLocaleDateString('es-AR')}</span><span>{suppliers.find(s=>s.id===p.supplier_id)?.name||'—'}</span><span>{p.due_date?new Date(p.due_date+'T12:00:00').toLocaleDateString('es-AR'):'—'}</span><span>{p.status}</span><b>{money(p.total)}</b>{p.status==='draft'?<button className="secondary compact" onClick={()=>void receive(p.id)}><ArrowDownToLine size={15}/> Recibir</button>:<span>—</span>}</div>)}</div>
 </section>
}
