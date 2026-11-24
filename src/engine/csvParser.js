
/**
 * csvParser.js
 *
 * Converts CSV text into structured objects for the discount engine.
 * Supports brand, platform, and cart-level discount rules.
 */

import Papa from 'papaparse'

/**
 * Parses discount rules from CSV.
 * Returns { data, errors }.
 */
export function parseRulesCSV(csvText) {
  const { data: rows, errors: parseErrors } = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parseErrors.length > 0) {
    return {
      data: [],
      errors: parseErrors.map((e) => e.message),
    }
  }

  const data = []
  const errors = []

  rows.forEach((row, i) => {
    const rowNum = i + 2
    const missing = []

    const scope = (row.scope ?? '').trim().toLowerCase()

    if (!row.rule_id?.trim()) missing.push('rule_id')
    if (!row.scope?.trim()) missing.push('scope')

    // Cart rules do not require applies_to
    if (scope !== 'cart' && !row.applies_to?.trim()) {
      missing.push('applies_to')
    }

    if (!row.type?.trim()) missing.push('type')

    if (row.value === undefined || row.value.trim() === '') {
      missing.push('value')
    }

    if (row.stackable === undefined || row.stackable.trim() === '') {
      missing.push('stackable')
    }

    // Cart rules require a minimum cart value
    if (
      scope === 'cart' &&
      (row.min_cart_value === undefined ||
        row.min_cart_value.trim() === '')
    ) {
      missing.push('min_cart_value')
    }

    if (missing.length > 0) {
      errors.push(
        `Row ${rowNum}: missing fields — ${missing.join(', ')}`
      )
      return
    }

    // Validate rule scope
    if (!['brand', 'platform', 'cart'].includes(scope)) {
      errors.push(
        `Row ${rowNum}: invalid scope "${row.scope}"`
      )
      return
    }

    // Validate discount type
    const type = row.type.trim().toLowerCase()

    if (!['percentage', 'flat'].includes(type)) {
      errors.push(
        `Row ${rowNum}: invalid discount type "${row.type}"`
      )
      return
    }

    // Validate discount value
    const value = Number(row.value)

    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      (type === 'percentage' && value > 100)
    ) {
      errors.push(
        `Row ${rowNum}: invalid discount value "${row.value}"`
      )
      return
    }

    // Validate stackable value
    const stackableStr = row.stackable.trim().toLowerCase()

    const validBooleans = [
      'true',
      'false',
      '1',
      '0',
      'yes',
      'no',
    ]

    if (!validBooleans.includes(stackableStr)) {
      errors.push(
        `Row ${rowNum}: invalid stackable value "${row.stackable}"`
      )
      return
    }

    const stackable = ['true', '1', 'yes'].includes(stackableStr)

    // Parse cart-level minimum threshold
    let minCartValue = null

    if (scope === 'cart') {
      minCartValue = Number(row.min_cart_value)

      if (
        !Number.isFinite(minCartValue) ||
        minCartValue < 0
      ) {
        errors.push(
          `Row ${rowNum}: invalid min_cart_value`
        )
        return
      }
    }

    // Convert CSV row into DiscountRule object
    data.push({
      ruleId: row.rule_id.trim(),
      scope,
      appliesTo:
        scope === 'cart' ? '' : row.applies_to.trim(),
      type,
      value,
      stackable,
      minCartValue,
    })
  })

  return { data, errors }
}

/**
 * Parses cart items from CSV.
 * Returns { data, errors }.
 */
export function parseCartCSV(csvText) {
  const { data: rows, errors: parseErrors } = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parseErrors.length > 0) {
    return {
      data: [],
      errors: parseErrors.map((e) => e.message),
    }
  }

  const data = []
  const errors = []

  rows.forEach((row, i) => {
    const rowNum = i + 2
    const missing = []

    if (!row.item_id?.trim()) missing.push('item_id')
    if (!row.product?.trim()) missing.push('product')
    if (!row.brand?.trim()) missing.push('brand')
    if (!row.platform?.trim()) missing.push('platform')

    if (
      row.base_price === undefined ||
      row.base_price.trim() === ''
    ) {
      missing.push('base_price')
    }

    if (missing.length > 0) {
      errors.push(
        `Row ${rowNum}: missing fields — ${missing.join(', ')}`
      )
      return
    }

    // Validate item price
    const basePrice = Number(row.base_price)

    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      errors.push(
        `Row ${rowNum}: base_price must be a positive number, got "${row.base_price}"`
      )
      return
    }

    // Convert CSV row into CartItem object
    data.push({
      itemId: row.item_id.trim(),
      product: row.product.trim(),
      brand: row.brand.trim(),
      platform: row.platform.trim(),
      basePrice: Math.round(basePrice),
    })
  })

  return { data, errors }
}
