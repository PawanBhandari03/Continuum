# Continuum web app

Next.js 15 (TypeScript, Tailwind v4). See the repository README for setup, architecture and AI-use disclosure.

```
npm install
npm run dev            # mock data by default
NEXT_PUBLIC_USE_MOCKS=false NEXT_PUBLIC_API_URL=<api> npm run dev   # real API
npx playwright test    # browser tests
```
