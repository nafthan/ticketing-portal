# Builds the app and serves it with nginx. This hosts the front end only:
# connect a backend through platform.js (see DEPLOYMENT.md) to share data.
#
#   docker build -t helpdesk .
#   docker run -p 8080:8080 helpdesk
#   open http://localhost:8080            (the app)
#   open http://localhost:8080/single-file/  (the single-file edition)

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.inc /etc/nginx/conf.d/security-headers.inc
COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY single-file/index.html /usr/share/nginx/html/single-file/index.html
# Put your adapter next to index.html as platform.js and uncomment its <script> tag.
EXPOSE 8080
