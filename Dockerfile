FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

# Copy all source code
COPY . .

# Explicitly copy your local .env file into the container as '.env.production'
# Vite automatically looks for .env.production during production builds
COPY .env ./.env.production

# Now when this runs, Vite will find the file and bake the keys into the JS
RUN npm run build

RUN npm install -g serve
EXPOSE 80
CMD ["serve", "-s", "dist", "-l", "80"]

