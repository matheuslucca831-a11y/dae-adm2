const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- Iniciando Build e Empacotamento para HostGator ---');

// 1. Compilar Next.js em modo standalone
console.log('1. Executando next build...');
execSync('npx next build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

// 2. Definir pasta de destino com a regra rigorosa de versionamento
const versionTag = 'dist-[v3.23.0 - SIGER DAE] - 15-10-2026';
const rootDir = path.join(__dirname, '..');
const destDir = path.join(rootDir, versionTag);
const standaloneDir = path.join(rootDir, '.next', 'standalone');

console.log(`2. Preparando diretório de distribuição: ${versionTag}...`);
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir, { recursive: true });

// 3. Copiar o standalone (server.js, node_modules, .next compilado)
console.log('3. Copiando arquivos standalone...');
fs.cpSync(standaloneDir, destDir, { recursive: true });

// 4. Copiar assets estáticos (public e .next/static)
console.log('4. Copiando assets estáticos (public e .next/static)...');
const destPublic = path.join(destDir, 'public');
const destStatic = path.join(destDir, '.next', 'static');
const srcPublic = path.join(rootDir, 'public');
const srcStatic = path.join(rootDir, '.next', 'static');

fs.cpSync(srcPublic, destPublic, { recursive: true });
fs.cpSync(srcStatic, destStatic, { recursive: true });

// 5. Copiar .htaccess para Apache HostGator e .env.production
console.log('5. Copiando .htaccess e .env.production...');
const srcHtaccess = path.join(rootDir, '.htaccess');
const srcEnv = path.join(rootDir, '.env.local');

if (fs.existsSync(srcHtaccess)) {
  fs.copyFileSync(srcHtaccess, path.join(destDir, '.htaccess'));
}
if (fs.existsSync(srcEnv)) {
  fs.copyFileSync(srcEnv, path.join(destDir, '.env.production'));
}

// 6. Remover diretório antigo dist-v3.22.0 se existir para manter a raiz limpa
const oldDist = path.join(rootDir, 'dist-[v3.22.0 - SIGER DAE] - 15-10-2026');
if (fs.existsSync(oldDist)) {
  fs.rmSync(oldDist, { recursive: true, force: true });
}

console.log(`--- Build HostGator concluída com sucesso em: ${destDir} ---`);
