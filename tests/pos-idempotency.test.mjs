import test from 'node:test'
import assert from 'node:assert/strict'
import { clearPendingSaleKey, getPendingSaleKey, PENDING_SALE_STORAGE_KEY } from '../src/lib/pos-idempotency.mjs'
function memoryStorage() { const values = new Map(); return { getItem:k=>values.get(k)??null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k) } }
test('same pending checkout reuses its idempotency key after a retry',()=>{const s=memoryStorage();let n=0;const create=()=> 'key-'+(++n);const a=getPendingSaleKey(s,'cart-A',create);assert.equal(getPendingSaleKey(s,'cart-A',create),a);assert.equal(n,1)})
test('a new checkout gets a new key and replaces the previous pending operation',()=>{const s=memoryStorage();let n=0;const create=()=> 'key-'+(++n);const a=getPendingSaleKey(s,'cart-A',create);const b=getPendingSaleKey(s,'cart-B',create);assert.notEqual(a,b);assert.equal(JSON.parse(s.getItem(PENDING_SALE_STORAGE_KEY)).fingerprint,'cart-B')})
test('in-memory pending key survives storage failures during a timeout retry',()=>{const s={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};assert.equal(getPendingSaleKey(s,'cart-A',()=> 'new-key',{fingerprint:'cart-A',key:'stable-key'}),'stable-key')})
test('successful checkout clears the persisted pending key',()=>{const s=memoryStorage();getPendingSaleKey(s,'cart-A',()=> 'key-1');clearPendingSaleKey(s);assert.equal(s.getItem(PENDING_SALE_STORAGE_KEY),null)})
