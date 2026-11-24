
import { useState } from 'react'

export default function AIRuleInput({ onAddRule }) {
  const [instruction, setInstruction] = useState('')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleParse() {
    setError('')
    setPreview(null)
    setLoading(true)

    try {
      const response = await fetch('/api/parse-rule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: instruction }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to parse rule')
      }

      setPreview(data.rule)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleConfirm() {
    if (!preview) return

    onAddRule(preview)
    setInstruction('')
    setPreview(null)
    setError('')
  }

  const inputStyle = {
    width: '100%',
    minHeight: 80,
    padding: 12,
    border: '1px solid #ccc',
    borderRadius: 5,
    boxSizing: 'border-box',
    fontFamily: 'Arial, sans-serif',
    fontSize: 13,
    resize: 'vertical',
  }

  const buttonStyle = {
    background: '#FF5800',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    padding: '10px 18px',
    fontWeight: 700,
    cursor: 'pointer',
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#555' }}>
        Describe a discount in plain English.
        AI will convert it into a rule for your approval.
      </p>

      <textarea
        style={inputStyle}
        value={instruction}
        maxLength={500}
        placeholder="20% off Natura Casa products, stackable with other offers"
        onChange={(e) => {
          setInstruction(e.target.value)
          setPreview(null)
          setError('')
        }}
      />

      <div style={{ marginTop: 10 }}>
        <button
          style={{
            ...buttonStyle,
            opacity: loading || !instruction.trim() ? 0.5 : 1,
          }}
          disabled={loading || !instruction.trim()}
          onClick={handleParse}
        >
          {loading ? 'Parsing rule...' : 'Parse with AI'}
        </button>
      </div>

      {error && (
        <p role="alert" style={{ color: '#b42318', fontSize: 13 }}>
          {error}
        </p>
      )}

      {preview && (
        <div style={{
          marginTop: 16,
          padding: 16,
          border: '1px solid #ccc',
          borderRadius: 6,
          background: '#fafafa',
        }}>
          <h4 style={{ marginTop: 0 }}>
            Confirm New Discount Rule
          </h4>

          <p><strong>Scope:</strong> {preview.scope}</p>

          {preview.scope !== 'cart' && (
            <p>
              <strong>Applies to:</strong> {preview.appliesTo}
            </p>
          )}

          <p><strong>Type:</strong> {preview.type}</p>

          <p>
            <strong>Value:</strong>{' '}
            {preview.type === 'percentage'
              ? `${preview.value}% off`
              : `Rs.${preview.value} off`}
          </p>

          <p>
            <strong>Stackable:</strong>{' '}
            {preview.stackable ? 'Yes' : 'No'}
          </p>

          {preview.scope === 'cart' && (
            <p>
              <strong>Minimum cart value:</strong>{' '}
              Rs.{preview.minCartValue.toLocaleString('en-IN')}
            </p>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              style={buttonStyle}
              onClick={handleConfirm}
            >
              Confirm & Apply
            </button>

            <button
              onClick={() => setPreview(null)}
              style={{
                padding: '10px 18px',
                cursor: 'pointer',
                border: '1px solid #aaa',
                borderRadius: 4,
                background: 'white',
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
