/**
 * App.jsx
 *
 * Top-level component. Manages state for rules, cart items, and results.
 * Wires together CSV upload → parse → engine → display.
 */
import PdfUploader from './components/PdfUploader.jsx'
import AIRuleInput from './components/AIRuleInput.jsx'
import { useState } from 'react'
import CsvUploader from './components/CsvUploader.jsx'
import DataTable from './components/DataTable.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import { parseRulesCSV, parseCartCSV } from './engine/csvParser.js'
import { processCart, applyCartDiscounts } from './engine/discountEngine.js'

// ── Column definitions ───────────────────────────────────────────

const RULES_COLUMNS = [
  { key: 'ruleId',    label: 'Rule ID' },
  { key: 'scope',     label: 'Scope',      render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  { key: 'appliesTo', label: 'Applies To' },
  { key: 'type',      label: 'Type',       render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  {
    key: 'value',
    label: 'Value',
    render: (v, row) => row.type === 'percentage' ? `${v}% off` : `Rs.${v} off`,
  },
  { key: 'stackable', label: 'Stackable',  render: (v) => (v ? 'Yes' : 'No') },
]

const CART_COLUMNS = [
  { key: 'itemId',    label: 'Item' },
  { key: 'product',   label: 'Product' },
  { key: 'brand',     label: 'Brand' },
  { key: 'platform',  label: 'Platform' },
  { key: 'basePrice', label: 'Base Price', render: (v) => `Rs.${v.toLocaleString('en-IN')}` },
]

const RESULTS_COLUMNS = [
  { key: 'itemId',    label: 'Item' },
  { key: 'product',   label: 'Product' },
  { key: 'basePrice', label: 'Base Price',  render: (v) => `Rs.${v.toLocaleString('en-IN')}` },
  { key: 'finalPrice',label: 'Final Price',
    render: (v, row) => (
      <span style={{ fontWeight: 700, color: row.totalDiscount > 0 ? '#1e5c2c' : '#131A48' }}>
        Rs.{v.toLocaleString('en-IN')}
      </span>
    ),
  },
  {
    key: 'totalDiscount',
    label: 'You Save',
    render: (v) =>
      v > 0 ? (
        <span style={{ color: '#1e5c2c', fontWeight: 600 }}>Rs.{v.toLocaleString('en-IN')}</span>
      ) : (
        <span style={{ color: '#888' }}>—</span>
      ),
  },
  {
    key: 'reasoning',
    label: 'Offer Applied',
    render: (v) => (
      <span style={{ color: v === 'No offers available' ? '#888' : '#131A48', fontStyle: v === 'No offers available' ? 'italic' : 'normal' }}>
        {v}
      </span>
    ),
  },
]

// ── Styles ───────────────────────────────────────────────────────

const S = {
  page:    { minHeight: '100vh', background: '#f7f7f9', fontFamily: 'Arial, sans-serif' },
  header:  { background: '#131A48', padding: '0.85rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logoTxt: { fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' },
  logoSpan:{ color: '#FF5800' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' },
  main:    { maxWidth: 960, margin: '0 auto', padding: '1.8rem 1.5rem' },
  section: { background: '#fff', border: '1px solid #CECECE', borderRadius: 6, padding: '1.2rem 1.4rem', marginBottom: '1.2rem' },
  sectionTitle: { fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 14, color: '#131A48', marginBottom: '0.7rem', paddingBottom: 6, borderBottom: '2px solid #FF5800', display: 'inline-block' },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  btn:     {
    background: '#FF5800', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.65rem 2rem', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  btnDisabled: {
    background: '#CECECE', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.65rem 2rem', fontSize: 13, fontWeight: 700, cursor: 'not-allowed',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  totalRow: {
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
    gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem',
    borderTop: '2px solid #131A48',
  },
  totalLabel: { fontWeight: 700, fontSize: 14, color: '#131A48' },
  totalValue: { fontWeight: 700, fontSize: 16, color: '#131A48' },
  tag: (color, bg) => ({
    display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 6px',
    borderRadius: 20, background: bg, color, textTransform: 'uppercase', letterSpacing: '0.04em',
  }),
}

// ── Component ────────────────────────────────────────────────────

export default function App() {
  const [rules, setRules]           = useState([])
  const [rulesErrors, setRulesErr]  = useState([])
  const [rulesFileName, setRulesFileName] = useState('')

  const [cartItems, setCartItems]   = useState([])
  const [cartErrors, setCartErrors] = useState([])
  const [cartFileName, setCartFileName]   = useState('')

  const [results, setResults]       = useState(null)

  // ── Handlers ──

  function handleRulesLoad(csvText, fileName) {
    const { data, errors } = parseRulesCSV(csvText)
    setRules(data)
    setRulesErr(errors)
    setRulesFileName(fileName)
    setResults(null) // clear stale results
  }

  function handleCartLoad(csvText, fileName) {
    const { data, errors } = parseCartCSV(csvText)
    setCartItems(data)
    setCartErrors(errors)
    setCartFileName(fileName)
    setResults(null)
  }

  function handlePDFCartLoad(pdfItems, fileName) {
    // Replace the current cart
    setCartItems(pdfItems)
    setCartErrors([])
    setCartFileName(fileName)

    // Recalculate automatically with existing rules
    if (rules.length > 0) {
      const itemResults = processCart(pdfItems, rules)
      const cartSummary = applyCartDiscounts(
        itemResults,
        rules
      )

      setResults({
        items: itemResults,
        summary: cartSummary,
      })
    } else {
      setResults(null)
    }
  }


  function handleCalculate() {
  const itemResults = processCart(cartItems, rules)
  const cartSummary = applyCartDiscounts(itemResults, rules)

  setResults({
    items: itemResults,
    summary: cartSummary,
  })
}

function handleAddRule(newRule) {
  const updatedRules = [...rules, newRule]

  setRules(updatedRules)
  setRulesErr([])

  // Automatically recalculate with the newly confirmed rule
  if (cartItems.length > 0) {
    const itemResults = processCart(cartItems, updatedRules)
    const cartSummary = applyCartDiscounts(
      itemResults,
      updatedRules
    )

    setResults({
      items: itemResults,
      summary: cartSummary,
    })
  } else {
    setResults(null)
  }
}


  const canCalculate = rules.length > 0 && cartItems.length > 0

  // ── Render ──

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logoTxt}>O<span style={S.logoSpan}>pp</span>tra</div>
        <div style={S.headerSub}>Discount Engine</div>
      </div>

      <div style={S.main}>

        {/* Upload row */}
        <div style={S.grid2}>
          {/* Rules upload */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Discount Rules</div>
            <CsvUploader
              label="rules.csv"
              description="Upload your discount rules CSV"
              onLoad={handleRulesLoad}
              hasData={rules.length > 0}
              fileName={rulesFileName}
            />
            <ErrorBanner errors={rulesErrors} />
            {rules.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {rules.length} rule{rules.length > 1 ? 's' : ''} loaded
                </div>
                <DataTable columns={RULES_COLUMNS} rows={rules} />
              </div>
            )}
          </div>

          {/* Cart upload */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Items</div>
            <CsvUploader
              label="cart.csv"
              description="Upload your cart CSV"
              onLoad={handleCartLoad}
              hasData={cartItems.length > 0}
              fileName={cartFileName}
            />
            <ErrorBanner errors={cartErrors} />
            {cartItems.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {cartItems.length} item{cartItems.length > 1 ? 's' : ''} loaded
                </div>
                <DataTable columns={CART_COLUMNS} rows={cartItems} />
              </div>
            )}
          </div>
        </div>
            
          {/* PDF Cart Upload */}
          <div style={S.section}>
            <div style={S.sectionTitle}>
              Upload Cart from PDF
            </div>

            <PdfUploader onLoad={handlePDFCartLoad} />
          </div>

          {/* AI-powered natural language rule input */}
          <div style={S.section}>
            <div style={S.sectionTitle}>
              AI Discount Rule Creator
            </div>

            <AIRuleInput onAddRule={handleAddRule} />
          </div>

        {/* Calculate button */}
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <button
            style={canCalculate ? S.btn : S.btnDisabled}
            onClick={handleCalculate}
            disabled={!canCalculate}
          >
            Calculate Discounts
          </button>
          {!canCalculate && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
              Upload both files to calculate
            </div>
          )}
        </div>


{/* Results */}
{results && (
  <div style={S.section}>
    <div style={S.sectionTitle}>Cart Summary</div>

    {/* Individual item discounts */}
    <DataTable
      columns={RESULTS_COLUMNS}
      rows={results.items}
    />

    {/* Subtotal after item-level discounts */}
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: '1rem',
      padding: '0.75rem 0',
      borderTop: '1px solid #ddd',
    }}>
      <span>Subtotal after item discounts</span>
      <span>
        Rs.{results.summary.subtotal.toLocaleString('en-IN')}
      </span>
    </div>

    {/* Cart-level offer - only shown when eligible */}
    {results.summary.appliedCartRule && (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0.75rem',
        background: '#edf7ed',
        color: '#1e5c2c',
        borderRadius: 4,
        marginBottom: '0.75rem',
      }}>
        <span>
          Cart offer ({results.summary.appliedCartRule.ruleId}):
          {' '}
          {results.summary.appliedCartRule.type === 'percentage'
            ? `${results.summary.appliedCartRule.value}% off`
            : `Rs.${results.summary.appliedCartRule.value} off`}
        </span>

        <strong>
          - Rs.{results.summary.cartDiscount.toLocaleString('en-IN')}
        </strong>
      </div>
    )}

    {/* Final cart total */}
    <div style={S.totalRow}>
      <span style={S.totalLabel}>Final Cart Total</span>
      <span style={S.totalValue}>
        Rs.{results.summary.finalTotal.toLocaleString('en-IN')}
      </span>
    </div>
  </div>
)}


      </div>
    </div>
  )
}
