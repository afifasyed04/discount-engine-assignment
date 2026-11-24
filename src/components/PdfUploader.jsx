
import { useState } from 'react'
import { parseCartPDF } from '../engine/pdfParser.js'

export default function PdfUploader({ onLoad }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')

  async function handleFileChange(event) {
    const file = event.target.files?.[0]

    // Allow selecting the same file again.
    event.target.value = ''

    if (!file) return

    setLoading(true)
    setError('')

    try {
      const { data, errors } = await parseCartPDF(file)

      if (errors.length > 0) {
        setError(errors.join(' '))
        return
      }

      if (data.length === 0) {
        setError('No cart items found in this PDF.')
        return
      }

      // Only replace cart after successful parsing.
      onLoad(data, file.name)
      setFileName(file.name)

    } catch (err) {
      setError(err.message || 'PDF upload failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p style={{
        fontSize: 13,
        color: '#555',
        marginBottom: 10,
      }}>
        Upload a shopping cart PDF to replace the
        current cart and automatically recalculate.
      </p>

      <label style={{
        display: 'inline-block',
        background: '#131A48',
        color: '#fff',
        padding: '10px 16px',
        borderRadius: 4,
        cursor: loading ? 'wait' : 'pointer',
        fontSize: 13,
        fontWeight: 700,
      }}>
        {loading ? 'Reading PDF...' : 'Upload Cart PDF'}

        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          disabled={loading}
          style={{ display: 'none' }}
        />
      </label>

      {fileName && (
        <p style={{
          color: '#1e5c2c',
          fontSize: 12,
        }}>
          Last successful upload: {fileName}
        </p>
      )}

      {error && (
        <p role="alert" style={{
          color: '#b42318',
          fontSize: 12,
        }}>
          {error}
        </p>
      )}
    </div>
  )
}
