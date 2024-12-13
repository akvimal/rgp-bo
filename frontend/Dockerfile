FROM nginx:latest AS ngi
# Copying compiled code and nginx config to different folder
# NOTE: This path may change according to your project's output folder 
COPY /dist/frontend/. /usr/share/nginx/html
COPY /nginx.conf  /etc/nginx/conf.d/default.conf
# Exposing a port, here it means that inside the container 
# the app will be using Port 80 while running
EXPOSE 80

# FROM node:16.19.0
# # Create a Virtual directory inside the docker image
# WORKDIR /dist/src/app

# # Copy files from local machine to virtual directory in docker image
# COPY package*.json ./

# RUN npm install

# RUN npm install -g @angular/cli@12.0.0

# COPY . .

# RUN npm run build

# EXPOSE 4200