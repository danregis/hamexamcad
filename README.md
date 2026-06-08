# Canadian Amateur Radio — Basic Qualification Exam

A Cloudflare Workers web app for practicing the Canadian Amateur Radio **Basic Qualification** exam.

## Features

- **984 questions** from the official ISED Basic Qualification question bank (effective 15 July 2025)
- **100-question exam** drawn randomly — one question per topic (matching the real exam format)
- 8 sections: Regulations, Operating, Station Assembly, Circuit Components, Electronics, Feedlines, Propagation, Interference
- Pass threshold: **70%** (Basic) / **80%** (Basic with Honours)
- Section-by-section score breakdown and full review of incorrect answers
- Optional email results via [Resend](https://resend.com) (requires API key)

## Project Structure

```
src/
  worker.js          Cloudflare Worker — serves the exam UI and handles /submit
  questions_data.js  Auto-generated from Basic_Qualification_Question_Bank.docx
wrangler.toml
package.json
```

## Development

```bash
npm install
npm run dev      # runs wrangler dev — opens on http://localhost:8787
```

## Deploy

```bash
npm run deploy   # deploys to Cloudflare Workers
```

## Email Results (optional)

Email delivery uses the [Resend](https://resend.com) API. Set up as a Worker secret:

```bash
wrangler secret put RESEND_API_KEY   # your Resend API key
wrangler secret put FROM_EMAIL       # e.g. "HAM Exam <results@yourdomain.com>"
```

Without these secrets, the exam still works — results are shown on-screen and users see a note that email delivery requires server configuration.

## Regenerating Questions

If you update `Basic_Qualification_Question_Bank.docx`, regenerate `src/questions_data.js` by running the PowerShell extraction script in the repo history.
