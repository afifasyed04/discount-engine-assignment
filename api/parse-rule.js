
/**
 * Opptra AI Discount Rule Parser
 * Powered by Google Gemini free-tier API.
 * Runs server-side to protect the API key.
 */

import { randomUUID } from 'node:crypto'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Only POST requests are allowed',
    })
  }

  const text = req.body?.text

  if (
    typeof text !== 'string' ||
    !text.trim() ||
    text.length > 500
  ) {
    return res.status(400).json({
      error: 'Enter a discount instruction (max 500 characters).',
    })
  }

  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return res.status(500).json({
      error: 'Gemini API key is not configured.',
    })
  }

  const prompt = `
You are a discount rule parser for an ecommerce application.

Convert the user's instruction into a structured discount rule.

Rules:
- scope must be brand, platform, or cart.
- type must be percentage or flat.
- value must be a positive number.
- Percentage must not exceed 100.
- Brand scope requires a brand name.
- Platform scope requires a platform name.
- Cart scope requires a numeric minimum cart value.
- Cart scope appliesTo must be an empty string.
- minCartValue is 0 for non-cart rules.
- stackable defaults to false unless explicitly stated.
- Do not invent missing amounts, brands, platforms or thresholds.
- If the request is ambiguous, set valid=false.
- For invalid rules explain the problem in error.
- For valid rules set valid=true and error="".
- Interpret "more than Rs.5000" as threshold 5000.

Examples:

Input: "20% off Natura Casa brand, stackable"
Output: brand, Natura Casa, percentage, 20, true

Input: "Rs.100 off all Flipkart items"
Output: platform, Flipkart, flat, 100, false

Input: "10% off if cart value is over Rs.5000"
Output: cart, "", percentage, 10, false, 5000

Input: "Give discounts for big orders"
Output: invalid because amount and threshold are missing.

User instruction:
${text}
`

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                valid: { type: 'BOOLEAN' },
                error: { type: 'STRING' },
                scope: { type: 'STRING' },
                appliesTo: { type: 'STRING' },
                type: { type: 'STRING' },
                value: { type: 'NUMBER' },
                stackable: { type: 'BOOLEAN' },
                minCartValue: { type: 'NUMBER' },
              },
              required: [
                'valid',
                'error',
                'scope',
                'appliesTo',
                'type',
                'value',
                'stackable',
                'minCartValue',
              ],
            },
          },
        }),
      }
    )

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Gemini API error:', response.status, errorBody)

      return res.status(502).json({
        error: response.status === 429
          ? 'Gemini free-tier limit reached. Try again later.'
          : 'Gemini API request failed. Check your API key and model access.',
      })
    }

    const data = await response.json()

    const output = data.candidates?.[0]
      ?.content?.parts
      ?.map(part => part.text || '')
      .join('')

    if (!output) {
      return res.status(502).json({
        error: 'Gemini returned no usable response.',
      })
    }

    const parsed = JSON.parse(output)

    if (!parsed.valid) {
      return res.status(422).json({
        error: parsed.error || 'Please provide a more specific rule.',
      })
    }

    // Validate AI output before applying it
    if (
      !['brand', 'platform', 'cart'].includes(parsed.scope) ||
      !['percentage', 'flat'].includes(parsed.type) ||
      !Number.isFinite(parsed.value) ||
      parsed.value <= 0 ||
      (parsed.type === 'percentage' && parsed.value > 100) ||
      typeof parsed.stackable !== 'boolean' ||
      typeof parsed.appliesTo !== 'string' ||
      (
        parsed.scope !== 'cart' &&
        !parsed.appliesTo.trim()
      ) ||
      (
        parsed.scope === 'cart' &&
        (
          !Number.isFinite(parsed.minCartValue) ||
          parsed.minCartValue < 0
        )
      )
    ) {
      return res.status(422).json({
        error: 'AI returned an invalid rule. Please rephrase.',
      })
    }

    const rule = {
      ruleId: `AI-${randomUUID()}`,
      scope: parsed.scope,
      appliesTo: parsed.scope === 'cart'
        ? ''
        : parsed.appliesTo.trim(),
      type: parsed.type,
      value: parsed.value,
      stackable: parsed.stackable,
      minCartValue: parsed.scope === 'cart'
        ? parsed.minCartValue
        : null,
    }

    return res.status(200).json({ rule })

  } catch (error) {
    console.error('Rule parsing error:', error)

    return res.status(500).json({
      error: 'Unable to parse discount rule. Please try again.',
    })
  }
}
