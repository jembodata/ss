FROM node:20-bullseye

WORKDIR /app

COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install -g npm@10.9.2
RUN npm install --prefix packages/shared
RUN npm install --prefix apps/api
RUN npm install --prefix apps/worker
RUN npm install --prefix apps/web

COPY . .

RUN npx playwright install --with-deps
RUN npm run build --no-workspaces --prefix apps/web

ENV NODE_ENV=production

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
