# DEVELOPMENT

FROM node:16.19.0

WORKDIR /app

COPY *.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
