# Kairotic relay in a container: docker build -t kairotic-relay relay/
#                                 docker run -p 8765:8765 -v kairotic-radata:/data kairotic-relay
FROM node:22-alpine
RUN apk add --no-cache git
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js ./
ENV PORT=8765 RADATA=/data
VOLUME /data
EXPOSE 8765
CMD ["node", "server.js"]
