FROM node:22.14.0-alpine

# Install Python and pip for pdfplumber
RUN apk add --no-cache python3 py3-pip

# Install pdfplumber and its dependencies
RUN pip3 install --no-cache-dir pdfplumber==0.11.0 --break-system-packages

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --force

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]