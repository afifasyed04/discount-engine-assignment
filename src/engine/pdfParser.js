
/**
 * PDF cart parser.
 *
 * Extracts a simple text-based PDF table with columns:
 * Product | Brand | Platform | Base Price
 *
 * Returns { data, errors }.
 */

import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

function getTokens(textContent) {
  const tokens = []

  for (const item of textContent.items) {
    if (!item.str || !item.str.trim()) continue

    const text = item.str
    const x = item.transform[4]
    const y = item.transform[5]
    const width = item.width || 0

    // Split text runs while retaining approximate coordinates.
    const matches = [...text.matchAll(/\S+/g)]

    for (const match of matches) {
      tokens.push({
        text: match[0],
        x: x + width * (match.index / text.length),
        y,
      })
    }
  }

  return tokens
}

function groupLines(tokens) {
  const lines = []

  const sorted = [...tokens].sort(
    (a, b) => b.y - a.y || a.x - b.x
  )

  for (const token of sorted) {
    const line = lines.find(
      (existing) => Math.abs(existing.y - token.y) < 3
    )

    if (line) {
      line.tokens.push(token)
    } else {
      lines.push({
        y: token.y,
        tokens: [token],
      })
    }
  }

  return lines.map((line) => ({
    ...line,
    tokens: line.tokens.sort((a, b) => a.x - b.x),
  }))
}

function findColumnPositions(tokens) {
  const find = (word) =>
    tokens.find(
      (token) => token.text.toLowerCase() === word
    )

  const product = find('product')
  const brand = find('brand')
  const platform = find('platform')
  const price = find('price')

  if (!product || !brand || !platform || !price) {
    return null
  }

  const positions = [
    product.x,
    brand.x,
    platform.x,
    price.x,
  ]

  if (!positions.every((x, i) =>
    i === 0 || x > positions[i - 1]
  )) {
    return null
  }

  // Midpoints separate the four table columns.
  return [
    (positions[0] + positions[1]) / 2,
    (positions[1] + positions[2]) / 2,
    (positions[2] + positions[3]) / 2,
  ]
}

function parseTableRow(tokens, boundaries) {
  const columns = [[], [], [], []]

  for (const token of tokens) {
    const column =
      token.x < boundaries[0] ? 0 :
      token.x < boundaries[1] ? 1 :
      token.x < boundaries[2] ? 2 : 3

    columns[column].push(token.text)
  }

  const values = columns.map((parts) =>
    parts.join(' ').trim()
  )

  const [product, brand, platform, priceText] = values

  if (!product || !brand || !platform || !priceText) {
    return null
  }

  const cleanPrice = priceText
    .replace(/Rs\.?/gi, '')
    .replace(/₹/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')

  if (!/^\d+(\.\d{1,2})?$/.test(cleanPrice)) {
    return null
  }

  const basePrice = Number(cleanPrice)

  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return null
  }

  return {
    product,
    brand,
    platform,
    basePrice: Math.round(basePrice),
  }
}

export async function parseCartPDF(file) {
  const errors = []
  const data = []

  if (!file || file.type !== 'application/pdf') {
    return {
      data: [],
      errors: ['Please upload a valid PDF file.'],
    }
  }

  if (file.size > 5 * 1024 * 1024) {
    return {
      data: [],
      errors: ['PDF must be smaller than 5 MB.'],
    }
  }

  let pdf

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())

    pdf = await pdfjs.getDocument({ data: bytes }).promise

    if (pdf.numPages > 20) {
      return {
        data: [],
        errors: ['PDF exceeds the 20-page limit.'],
      }
    }

    let boundaries = null

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const lines = groupLines(getTokens(textContent))

      for (const line of lines) {
        const text = line.tokens
          .map((token) => token.text)
          .join(' ')
          .trim()

        // Identify the table header.
        const header = findColumnPositions(line.tokens)

        if (header) {
          boundaries = header
          continue
        }

        if (!boundaries) continue

        // Skip horizontal separators and empty lines.
        if (!text || /^[\s\-─_]+$/.test(text)) {
          continue
        }

        
        // Stop parsing when we reach a totals or footer section.
        // These lines are not shopping cart products.
        if (
        /^(subtotal|grand total|cart total|total amount|order total)\b/i.test(text) ||
        /^sample data for opptra/i.test(text) ||
        /^upload this file using/i.test(text)
        ) {
        boundaries = null
        continue
        }


        const item = parseTableRow(line.tokens, boundaries)

        if (!item) {
          errors.push(
            `Page ${pageNum}: Could not read table row "${text.slice(0, 90)}".`
          )
          continue
        }

        data.push({
          itemId: `PDF-${String(data.length + 1).padStart(3, '0')}`,
          ...item,
        })
      }
    }

    if (data.length === 0) {
      return {
        data: [],
        errors: [
          'No valid cart table found. Expected Product, Brand, Platform and Base Price columns.',
          ...errors,
        ],
      }
    }

    // Avoid silently loading an incomplete cart.
    if (errors.length > 0) {
      return { data: [], errors }
    }

    return { data, errors: [] }

  } catch (error) {
    console.error('PDF parsing error:', error)

    return {
      data: [],
      errors: [
        'Unable to read PDF. Use a text-based, unencrypted PDF with a simple cart table.',
      ],
    }
  } finally {
    if (pdf) {
      await pdf.destroy()
    }
  }
}
