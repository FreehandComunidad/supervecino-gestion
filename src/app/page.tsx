"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateSubtotal, calculateDiscount, calculateTotal } from '@/lib/pos-calculations'
import { Search, ShoppingCart, Trash2, LogOut, Store, CreditCard, Banknote, Smartphone, X, Plus, Package } from 'lucide-react'
import ManagementPanel from './management-panel'
import OasisHQ from './oasis-hq'

type Product = { id: string; name: string; barcode: string | null; sku: string | null; sale_price: number; stock: number; unit: string; manages_stock: boolean }
type CartItem = Product & { quantity: number }
type Category = { id:string; name:string; parent_id:string|null }
type PaymentMethod = 'cash' | 'debit' | 'credit' | 'transfer' | 'wallet'

const money = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)

export default function Home() {
  const supabase = useMemo(() => createClient(), [])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [discount, setDiscount] = useState('0')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [cashOpen, setCashOpen] = useState<boolean | null>(null)
  const [cashAmount, setCashAmount] = useState('0')
  const [closeAmount, setCloseAmount] = useState('0')
  const [cashBusy, setCashBusy] = useState(false)
  const [profileRole, setProfileRole] = useState<string | null>(null)
  const [section, setSection] = useState<'pos'|'sales'|'cash'|'pricing'|'stats'|'oasis'>('oasis')
  const [showProductForm, setShowProductForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBarcode, setNewBarcode] = useState('')
  const [newSalePrice, setNewSalePrice] = useState('0')
  const [newCostPrice, setNewCostPrice] = useState('0')
  const [newVatRate, setNewVatRate] = useState('21')
  const [newStock, setNewStock] = useState('0')
  const [newUnit, setNewUnit] = useState('unidad')
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newSubcategoryId, setNewSubcategoryId] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [subcategoryName, setSubcategoryName] = useState('')

  const loadProducts = useCallback(async () => {
    const { data, error } = await supabase.from('products').select('id,name,barcode,sku,sale_price,stock,unit,manages_stock').eq('active', true).order('name').limit(500)
    if (error) setMessage(error.message)
    else setProducts((data ?? []) as Product[])
  }, [supabase])
  const loadCategories = useCallback(async () => {
    const { data, error } = await supabase.from('categories').select('id,name,parent_id').eq('active', true).order('name')
    if (!error) setCategories((data ?? []) as Category[])
  }, [supabase])
  const loadProfile = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) { setProfileRole(null); return }
    const { data } = await supabase.from('profiles').select('role,active').eq('id', authData.user.id).maybeSingle()
    setProfileRole(data?.active ? data.role : null)
  }, [supabase])
  const checkCash = useCallback(async () => {
    const { data, error } = await supabase.from('cash_sessions').select('id').is('closed_at', null).limit(1)
    if (error) setMessage(error.message)
    setCashOpen(Boolean(data?.length))
  }, [supabase])
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user?.email ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user?.email ?? null))
    return () => listener.subscription.unsubscribe()
  }, [supabase])
  useEffect(() => { if (user) { void loadProducts(); void checkCash(); void loadProfile(); void loadCategories() } }, [user, loadProducts, checkCash, loadProfile, loadCategories])
  const filtered = products.filter(p => [p.name, p.barcode ?? '', p.sku ?? ''].some(v => v.toLowerCase().includes(search.toLowerCase())))
  const subtotal = calculateSubtotal(cart)
  const discountValue = calculateDiscount(subtotal, discount)
  const total = calculateTotal(subtotal, discountValue)

  function add(product: Product) {
    if (product.manages_stock && product.stock <= 0) { setMessage('No hay stock disponible de ese producto.'); return }
    setCart(current => {
      const found = current.find(i => i.id === product.id)
      if (found) {
        if (product.manages_stock && found.quantity >= product.stock) { setMessage('La cantidad supera el stock disponible.'); return current }
        return current.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...current, { ...product, quantity: 1 }]
    })
    setMessage('')
  }
  function changeQty(id: string, qty: number) {
    if (qty <= 0) { setCart(c => c.filter(i => i.id !== id)); return }
    const p = products.find(x => x.id === id)
    if (p?.manages_stock && qty > p.stock) { setMessage('La cantidad supera el stock disponible.'); return }
    setCart(c => c.map(i => i.id === id ? { ...i, quantity: qty } : i))
  }
  async function saveProduct(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('')
    const { error } = await supabase.from('products').insert({ name: newName.trim(), barcode: newBarcode.trim() || null, category_id: newCategoryId || null, subcategory_id: newSubcategoryId || null, sale_price: Number(newSalePrice), cost_price: Number(newCostPrice), vat_rate: Number(newVatRate), stock: Number(newStock), unit: newUnit.trim() || 'unidad', manages_stock: true, active: true })
    setBusy(false)
    if (error) { setMessage(error.message); return }
    setNewName(''); setNewBarcode(''); setNewSalePrice('0'); setNewCostPrice('0'); setNewVatRate('21'); setNewStock('0'); setNewUnit('unidad'); setNewCategoryId(''); setNewSubcategoryId(''); setShowProductForm(false)
    setMessage('Producto agregado correctamente.'); await loadProducts()
  }
  async function addCategory(isSubcategory:boolean) {
    const name = (isSubcategory ? subcategoryName : categoryName).trim()
    if (!name || (isSubcategory && !newCategoryId)) return
    const { error } = await supabase.from('categories').insert({ name, parent_id: isSubcategory ? newCategoryId : null, active: true })
    if (error) { setMessage(error.message); return }
    if (isSubcategory) setSubcategoryName(''); else setCategoryName('')
    await loadCategories()
    setMessage(isSubcategory ? 'Subrubro creado.' : 'Rubro creado.')
  }
  async function openCash() {
    setCashBusy(true); setMessage('')
    const { error } = await supabase.rpc('open_cash_session', { p_opening_amount: Number(cashAmount) })
    setCashBusy(false)
    if (error) setMessage(error.message); else { setMessage('Caja abierta correctamente.'); await checkCash() }
  }
  async function closeCash() {
    setCashBusy(true); setMessage('')
    const { data, error } = await supabase.rpc('close_cash_session', { p_closing_amount: Number(closeAmount), p_notes: null })
    setCashBusy(false)
    if (error) setMessage(error.message); else { setMessage('Caja cerrada. Esperado: ' + money(Number(data.expected_amount)) + ' · Diferencia: ' + money(Number(data.difference))); await checkCash() }
  }
  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('')
    const normalizedUsername = username.trim().toLowerCase()
    const authEmail = normalizedUsername === 'administrador' ? 'administrador@supervecino.local' : `${normalizedUsername}@supervecino.local`
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password })
    setBusy(false); if (error) setMessage(error.message)
  }
  async function finishSale() {
    if (!cart.length || total <= 0) { setMessage('Agregá productos y verificá que el total sea mayor que cero.'); return }
    setBusy(true); setMessage('')
    const { data, error } = await supabase.rpc('create_pos_sale', {
      p_items: cart.map(i => ({ product_id: i.id, quantity: i.quantity })),
      p_payments: [{ method, amount: total }],
      p_discount: discountValue,
      p_customer_id: null,
      p_notes: null,
    })
    setBusy(false)
    if (error) { setMessage(error.message); return }
    setMessage('Venta registrada correctamente. N.º ' + (data?.sale_number ?? data?.id ?? ''))
    setCart([]); setDiscount('0'); await loadProducts(); await checkCash()
  }
  if (!user) return <main className="center-screen"><form className="login-card" onSubmit={login}><div className="brand-mark"><Store size={26}/></div><p className="eyebrow">SISTEMA COMERCIAL</p><h1>SÚPERVECINO <span>GESTIÓN</span></h1><p className="muted">Ingresá con tu usuario para abrir el punto de venta.</p><label>Usuario<input type="text" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required /></label><label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label><button className="primary full" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>{message && <p className="notice">{message}</p>}</form></main>
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Store size={22}/></div><div><strong>SÚPERVECINO</strong><small>GESTIÓN COMERCIAL</small></div></div><div className="top-actions"><span className="user-label">{user === 'administrador@supervecino.local' ? 'administrador' : user}</span><button className="icon-button" onClick={async()=>{await supabase.auth.signOut();setCart([])}} title="Cerrar sesión"><LogOut size={18}/></button></div></header>
    <nav className="main-nav">{([{id:"pos",label:"Punto de venta"},{id:"sales",label:"Historial de ventas"},{id:"cash",label:"Historial de cajas"},{id:"pricing",label:"Precios y rentabilidad"},{id:"stats",label:"Estadísticas y compras"},{id:"oasis",label:"OASIS HQ · Mansión"}] as const).map(item=><button key={item.id} className={section===item.id?"active":""} onClick={()=>setSection(item.id)}>{item.label}</button>)}</nav>
    {section === "oasis" ? <OasisHQ /> : section === "pos" ? <div className="workspace"><section className="catalog"><div className="section-heading"><div><p className="eyebrow">OPERACIONES</p><h1>Punto de venta</h1></div><div className="cash-controls">{cashOpen === null ? <span className="status">Verificando caja…</span> : cashOpen ? <><span className="status open">Caja abierta</span><input aria-label="Efectivo contado al cierre" type="number" min="0" value={closeAmount} onChange={e=>setCloseAmount(e.target.value)} placeholder="Efectivo contado"/><button className="secondary" disabled={cashBusy} onClick={closeCash}>Cerrar caja</button></> : <><span className="status closed">Caja cerrada</span><input aria-label="Monto inicial de caja" type="number" min="0" value={cashAmount} onChange={e=>setCashAmount(e.target.value)} placeholder="Fondo inicial"/><button className="primary compact" disabled={cashBusy} onClick={openCash}>Abrir caja</button></>}</div></div>
      <div className="catalog-toolbar"><div className="searchbox"><Search size={19}/><input autoFocus placeholder="Buscar por nombre, código o barras…" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){const match=products.find(p=>p.barcode===search.trim()||p.sku===search.trim());if(match){add(match);setSearch('')}}}}/>{search && <button className="icon-button" onClick={()=>setSearch('')}><X size={17}/></button>}</div>{(profileRole === 'owner' || profileRole === 'manager') && <button className="secondary add-product" onClick={()=>setShowProductForm(v=>!v)}><Plus size={16}/> Nuevo producto</button>}</div>
      {showProductForm && <form className="product-form" onSubmit={saveProduct}><div className="form-heading"><Package size={18}/><strong>Alta de producto</strong></div><div className="form-grid"><label>Nombre<input required value={newName} onChange={e=>setNewName(e.target.value)} /></label><label>Código de barras (lector USB/Bluetooth)<input value={newBarcode} inputMode="numeric" placeholder="Escaneá o escribí el código" onChange={e=>setNewBarcode(e.target.value)} /></label><label>Precio de venta con IVA<input required type="number" min="0.01" step="0.01" value={newSalePrice} onChange={e=>setNewSalePrice(e.target.value)} /></label><label>Costo sin IVA<input type="number" min="0" step="0.01" value={newCostPrice} onChange={e=>setNewCostPrice(e.target.value)} /></label><label>IVA (%)<input type="number" min="0" max="100" step="0.01" value={newVatRate} onChange={e=>setNewVatRate(e.target.value)} /></label><label>Stock inicial<input type="number" min="0" step="0.001" value={newStock} onChange={e=>setNewStock(e.target.value)} /></label><label>Unidad<input value={newUnit} onChange={e=>setNewUnit(e.target.value)} /></label><label>Rubro<select value={newCategoryId} onChange={e=>{setNewCategoryId(e.target.value);setNewSubcategoryId('')}}><option value="">Sin rubro</option>{categories.filter(c=>!c.parent_id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Subrubro<select value={newSubcategoryId} onChange={e=>setNewSubcategoryId(e.target.value)} disabled={!newCategoryId}><option value="">Sin subrubro</option>{categories.filter(c=>c.parent_id===newCategoryId).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div><div className="category-quick"><div><input placeholder="Nuevo rubro" value={categoryName} onChange={e=>setCategoryName(e.target.value)}/><button type="button" className="secondary" onClick={()=>void addCategory(false)}>Crear rubro</button></div><div><input placeholder="Nuevo subrubro" value={subcategoryName} onChange={e=>setSubcategoryName(e.target.value)} disabled={!newCategoryId}/><button type="button" className="secondary" disabled={!newCategoryId} onClick={()=>void addCategory(true)}>Crear subrubro</button></div></div><div className="form-actions"><button type="button" className="secondary" onClick={()=>setShowProductForm(false)}>Cancelar</button><button className="primary compact" disabled={busy}>Guardar producto</button></div></form>}
      <div className="product-grid">{filtered.map(p=><button className="product-card" key={p.id} onClick={()=>add(p)}><span className="product-name">{p.name}</span><strong>{money(Number(p.sale_price))}</strong><small>{p.barcode || p.sku || 'Sin código'} · Stock: {p.stock}</small></button>)}</div>
      {!filtered.length && <div className="empty">No se encontraron productos.</div>}
    </section>
    <aside className="sale-panel"><div className="sale-title"><div><p className="eyebrow">NUEVA OPERACIÓN</p><h2>Venta actual</h2></div><span className="cart-count">{cart.reduce((s,i)=>s+i.quantity,0)} artículos</span></div>
      <div className="cart-list">{cart.map(item=><div className="cart-row" key={item.id}><div className="cart-info"><strong>{item.name}</strong><small>{money(Number(item.sale_price))} c/u</small></div><div className="qty"><button onClick={()=>changeQty(item.id,item.quantity-1)}>−</button><input aria-label="Cantidad" type="number" min="1" value={item.quantity} onChange={e=>changeQty(item.id,Number(e.target.value))}/><button onClick={()=>changeQty(item.id,item.quantity+1)}>+</button></div><strong className="line-total">{money(Number(item.sale_price)*item.quantity)}</strong><button className="remove" onClick={()=>setCart(c=>c.filter(i=>i.id!==item.id))}><Trash2 size={16}/></button></div>)}
      {!cart.length && <div className="empty-cart"><ShoppingCart size={34}/><strong>Tu venta está vacía</strong><span>Buscá un producto y agregalo.</span></div>}</div>
      <div className="sale-bottom"><label className="discount-label">Descuento en pesos<input type="number" min="0" max={subtotal} value={discount} onChange={e=>setDiscount(e.target.value)}/></label><div className="totals"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Descuento</span><strong>− {money(discountValue)}</strong></div><div className="grand-total"><span>Total</span><strong>{money(total)}</strong></div></div>
        <p className="payment-heading">Medio de pago</p><div className="payment-options">{([{id:'cash',label:'Efectivo',icon:<Banknote size={17}/>},{id:'debit',label:'Débito',icon:<CreditCard size={17}/>},{id:'credit',label:'Crédito',icon:<CreditCard size={17}/>},{id:'transfer',label:'Transfer.',icon:<Smartphone size={17}/>},{id:'wallet',label:'Billetera',icon:<Smartphone size={17}/>} ] as const).map(m=><button key={m.id} className={method===m.id?'payment active':'payment'} onClick={()=>setMethod(m.id)}>{m.icon}{m.label}</button>)}</div>
        <button className="primary full checkout" disabled={busy || !cart.length || !cashOpen} onClick={finishSale}>{busy?'Procesando…': 'Cobrar ' + money(total)}</button>
        {!cashOpen && <p className="hint">Para registrar ventas primero debe existir una caja abierta.</p>}
      </div>
    </aside></div> : <ManagementPanel mode={section as 'sales'|'cash'|'pricing'|'stats'} />}
    {message && <div className="toast" role="status">{message}<button onClick={()=>setMessage('')}><X size={15}/></button></div>}
  </main>
}
