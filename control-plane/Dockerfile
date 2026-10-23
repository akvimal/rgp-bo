FROM node:22.14.0-alpine
RUN apk add --no-cache postgresql17-client && mkdir -p /data
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --force
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["npm", "run", "start"]
