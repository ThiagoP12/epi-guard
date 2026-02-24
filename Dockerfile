# 1. Constrói o site (Build)
FROM node:20-alpine as build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# --- SUAS CHAVES DO SUPABASE (Substitua abaixo!) ---
ENV VITE_SUPABASE_URL="https://euqpoknexixqhqfqgvns.supabase.co"
ENV VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1cXBva25leGl4cWhxZnFndm5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3OTg3NTUsImV4cCI6MjA4NzM3NDc1NX0.D_pZnKVvoV20UazlXXMwsEukzCA04bNjnHqht2UtBdc"
# ---------------------------------------------------

RUN npm run build

# 2. Serve o site (Nginx)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Configuração para React Router (não quebrar ao atualizar página)
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; index index.html index.htm; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
