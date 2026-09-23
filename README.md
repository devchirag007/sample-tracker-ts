# sample-tracker-ts

Lab sample tracking REST API. TypeScript, Express 4, Zod, Pino, Jest. Targets Node 16.20.
Data lives in an in-memory repository behind an interface (swap for a real DB later).

## Getting started

```bash
nvm use            # Node 16.20 (see .nvmrc)
npm install
cp .env.example .env
npm run dev        # http://localhost:3000
```

## Scripts

| Script              | What it does                            |
| ------------------- | --------------------------------------- |
| `npm run dev`       | run with hot reload (nodemon + ts-node) |
| `npm test`          | run the Jest suite                      |
| `npm run typecheck` | `tsc --noEmit`                          |
| `npm run lint`      | ESLint (typescript-eslint)              |
| `npm run format`    | Prettier                                |
| `npm run build`     | compile to `dist/`                      |
| `npm start`         | run the compiled build                  |

## API (base `/api/v1`)

| Method | Path                | Description   |
| ------ | ------------------- | ------------- |
| GET    | /samples            | list samples  |
| GET    | /samples/:id        | get one       |
| POST   | /samples            | create        |
| PATCH  | /samples/:id/status | update status |
| DELETE | /samples/:id        | delete        |
| GET    | /health             | health check  |

Success: `{ "success": true, "data": ... }`
Error: `{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }`

## Architecture

```
src/
  config/        env (zod-validated) and logger
  errors/        AppError hierarchy
  middlewares/   error handler, 404
  modules/samples/
    sample.routes.ts      URL -> controller
    sample.controller.ts  HTTP in/out, request validation (zod)
    sample.service.ts     business rules (404s, duplicate check)
    sample.repository.ts  persistence interface + in-memory impl
    sample.schema.ts      zod schemas
    sample.types.ts       domain types
  app.ts         createApp(deps) factory
  server.ts      bootstrap + graceful shutdown
tests/           API (supertest) and service tests
```

Request flow: `routes -> controller -> service -> repository`.
