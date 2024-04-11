FROM node:18-slim

WORKDIR /opt/app

COPY ./server/vue3_server .
RUN mkdir lib
COPY ./lib ./lib
RUN sed -i -e 's|\.\./\.\.|.|g' package.json
RUN npm install -g npm@latest
RUN (cd ./lib; npm install)
RUN npm install

EXPOSE 8080
CMD ["npm", "run", "serve"]
