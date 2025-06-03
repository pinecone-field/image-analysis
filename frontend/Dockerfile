FROM node:20

WORKDIR /app

# Only copy package files first for better Docker caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Expose the default CRA port
EXPOSE 3000

# Start the development server
CMD ["npm", "start"]