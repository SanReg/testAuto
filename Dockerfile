FROM node:20-slim

# Install qpdf for fast PDF page removal (preserves compression)
RUN apt-get update && \
    apt-get install -y qpdf build-essential python3 && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
