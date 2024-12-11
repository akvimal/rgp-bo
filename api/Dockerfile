# DEVELOPMENT

FROM node:16.19.0 as development

WORKDIR /app

COPY *.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:dev"]

# PRODUCTION

FROM node:16.19.0 as production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

COPY --from=development /app .

EXPOSE 3001

CMD ["node", "dist/main"]