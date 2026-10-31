# Serves the helpdesk page with nginx. This hosts the front end only:
# connect a backend through platform.js (see DEPLOYMENT.md) to share data.
#
#   docker build -t helpdesk .
#   docker run -p 8080:8080 helpdesk
#   open http://localhost:8080
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.inc /etc/nginx/conf.d/security-headers.inc
COPY index.html adapter-test.html /usr/share/nginx/html/
# Include platform.js only if you've created one from platform.example.js.
COPY platform*.js /usr/share/nginx/html/

EXPOSE 8080
