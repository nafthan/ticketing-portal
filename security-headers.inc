# Security headers for helpdesk. Included in each location in nginx.conf.
# The page keeps its script and styles inline, so 'unsafe-inline' is needed.
# If you self-host the fonts, drop the two Google Fonts hosts.
# Add your API's address to connect-src if it lives on another domain.
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' wss: https:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header X-Frame-Options "SAMEORIGIN" always;
