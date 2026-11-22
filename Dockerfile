# Build on native arch ($BUILDPLATFORM): ng build output is arch-neutral, so
# skip arm64 emulation — only the nginx stage below is per-arch.
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder
WORKDIR /app
# Pin pnpm to a 9.x release. pnpm 10 introduced ERR_PNPM_IGNORED_BUILDS as a
# hard error during `pnpm install --frozen-lockfile` even for transitive deps
# we explicitly never need to build, and the pnpm-lock.yaml in this repo is
# at lockfileVersion 9.0 which both 9.x and 10.x understand.
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist/flui.dashboard/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
