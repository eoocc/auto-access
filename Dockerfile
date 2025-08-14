FROM node:20-alpine3.20

WORKDIR /tmp

COPY . .

EXPOSE 7860/tcp

RUN apk add --no-cache curl bash && \
    npm install && \
    chmod +x index.js

CMD ["npm", "start"]
