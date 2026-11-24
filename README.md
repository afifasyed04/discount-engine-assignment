
## Live Demo

https://discount-engine-assignment-main.vercel.app

## Features

- Item-level brand and platform discounts
- Stackable discount rules
- Cart-level discounts with minimum thresholds
- Natural-language rule creation using Google Gemini
- Rule validation and confirmation before applying
- Shopping cart PDF upload and automatic recalculation
- Customer-facing discount explanations

## Running Locally

1. Install dependencies: `npm install`
2. Configure `GEMINI_API_KEY` in `.env.local`
3. Run `npx vercel dev`

The application runs at the URL shown in the terminal.

## Sample Data

Upload `sample-data/rules.csv` and `sample-data/cart.csv`.

Expected final cart total: Rs.5,339.

## PDF Testing

Use `sample-data/Opptra_Sample_Cart.pdf` to test PDF extraction.

## Architecture

- React and Vite for the frontend
- Pure JavaScript discount calculation engine
- Google Gemini for natural-language rule parsing
- PDF.js for PDF table extraction
- Vercel serverless API for secure AI requests
