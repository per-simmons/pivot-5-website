
## 10. Docker Instructions

A Dockerfile and docker-compose.yml are included in `p5-dashboard/`.

Build image (multi-stage, Node 20 alpine):
```bash
cd /Users/patsimmons/client-coding/pivot-5-website_11.19.25/p5-dashboard
docker build -t p5-dashboard .
```

Run container:
```bash
# maps container 3000 -> host 3000
cd /Users/patsimmons/client-coding/pivot-5-website_11.19.25/p5-dashboard
docker run -p 3000:3000 --env NODE_ENV=production --name p5dash p5-dashboard
# then open http://localhost:3000
```

Using docker-compose:
```bash
cd /Users/patsimmons/client-coding/pivot-5-website_11.19.25/p5-dashboard
docker compose up --build
```

Notes:
- The Dockerfile copies the current hard-coded Airtable constants. For production, move the PAT/base/table IDs into env vars (see commented env in docker-compose.yml) and read via `process.env` in `page.tsx`.
- Build requires network to fetch Google Geist fonts (Next.js default). Ensure outbound HTTPS is allowed during `docker build`.
- If another service is on host port 3000, adjust `-p 3000:3000` to another host port.
