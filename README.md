## Screenshot Service (refactor)

### Structure
- `apps/web` – Next.js + shadcn-style UI
- `apps/api` – Express API
- `apps/worker` – Playwright worker
- `packages/shared` – shared validators
- `docker/` – unified Docker image (ROLE-based)

### Dev
```
npm run install:all
npm run dev
```

### Docker
```
docker compose up --build
```

Services:
- API: `http://localhost:8081`
- Web: `http://localhost:3000`

### Notes
- API supports `/api` and `/api/v1`.
- Worker pulls jobs from Redis and uploads screenshots to MinIO.
