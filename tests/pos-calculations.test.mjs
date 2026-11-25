import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateSubtotal, calculateDiscount, calculateTotal } from '../src/lib/pos-calculations.js'

test('subtotal handles integer quantities and decimal prices', () => {
  assert.equal(calculateSubtotal([{ sale_price: 1250.5, quantity: 2 }, { sale_price: 99.99, quantity: 3 }]), 2800.97)
})

test('discount is clamped to zero and subtotal', () => {
  assert.equal(calculateDiscount(100, -5), 0)
  assert.equal(calculateDiscount(100, 500), 100)
  assert.equal(calculateDiscount(100, 'invalid'), 0)
})

test('total rounds to cents', () => {
  assert.equal(calculateTotal(100.1, 0.05), 100.05)
  assert.equal(calculateTotal(100, 101), 0)
})

test('weighted quantities round each line to cents', () => {
  assert.equal(calculateSubtotal([{ sale_price: 1000.99, quantity: 0.1 }]), 100.1)
})
