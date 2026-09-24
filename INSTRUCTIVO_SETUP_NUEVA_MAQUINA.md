# 🚀 Instructivo de Instalación y Setup — Ecosistema Monorepo

Este documento contiene todos los pasos, comandos automatizados, repositorios, variables de entorno y configuración necesaria para clonar y configurar el proyecto **Ecosistema** en una nueva máquina desde cero con **Antigravity / VS Code / Claude Code**.

---

## 📋 1. Datos Clave del Repositorio y Credenciales

| Parámetro | Valor |
| :--- | :--- |
| **Repositorio GitHub** | `https://github.com/klebertoapantadev/ecosistema.git` |
| **Usuario GitHub** | `klebertoapantadev` |
| **Proyecto Supabase** | `ecosistema` (`oaybbpdxhlxjbpwnoymy`) |
| **Supabase URL** | `https://oaybbpdxhlxjbpwnoymy.supabase.co` |
| **Supabase Publishable Key** | `sb_publishable_vC-t-FcOQ2Q5_XkTCcPKdQ_bveIh5YS` |

---

## 🛠️ 2. Prerrequisitos de Software en la Nueva Máquina

Instalar las siguientes herramientas (versiones recomendadas):
1. **Node.js**: `v20.x` o superior (LTS).
2. **pnpm**: `9.15.0` (o `v9.x`).
3. **Git**: Versión reciente para Windows.
4. **Supabase CLI**: Última versión (`npm install -g supabase`).

### Habilitar ejecución de scripts en Windows PowerShell:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📦 3. Script de Clonación y Setup (PowerShell)

Ejecuta el siguiente bloque en tu terminal **PowerShell** en el directorio donde desees alojar el proyecto (por ejemplo `C:\@Antigravity`):

```powershell
# 1. Crear carpeta base y clonar el repositorio
New-Item -ItemType Directory -Force -Path "C:\@Antigravity"
cd "C:\@Antigravity"

# Si usas GitHub CLI / Personal Access Token / HTTPS:
git clone https://github.com/klebertoapantadev/ecosistema.git
cd "C:\@Antigravity\ecosistema"

# 2. Configurar identidad Git
git config user.name "Kleber Toapanta"
git config user.email "kleber.toapanta.ch@gmail.com"

# 3. Habilitar e instalar dependencias con pnpm
corepack enable
pnpm install
```

---

## 🔐 4. Creación Automática de Archivos `.env.local`

Ejecuta el siguiente script en PowerShell dentro de `C:\@Antigravity\ecosistema` para autogenerar los archivos de entorno:

```powershell
# ─── 4.1. tranqi-web ───
@'
# Proyecto Supabase "ecosistema" (oaybbpdxhlxjbpwnoymy)
NEXT_PUBLIC_SUPABASE_URL=https://oaybbpdxhlxjbpwnoymy.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_vC-t-FcOQ2Q5_XkTCcPKdQ_bveIh5YS

# Agentes ARIA (Landing y Consola)
ARIA_BASE=https://logs-testing.mysatcomla.com/agentes
ARIA_AGENT_ID=
ARIA_AGENT_KEY=
ARIA_GATE_KEY=
ARIA_TENANT_KEY=

# Asistentes por Perfil (TRQ-009)
TRQ_CLIENTE_BASE=https://logs-testing.mysatcomla.com/agentes
TRQ_CLIENTE_AGENT_ID=
TRQ_CLIENTE_AGENT_KEY=
TRQ_ABOGADO_BASE=https://logs-testing.mysatcomla.com/agentes
TRQ_ABOGADO_AGENT_ID=
TRQ_ABOGADO_AGENT_KEY=

# Identidad y Cifrado
ASISTENTE_CAPSULA_SECRETO=
SUPABASE_JWT_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=

# SMTP Propio (Zoho Mail)
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=info@tranqi24.com
SMTP_PASS=
SMTP_FROM_NOMBRE=tranqi
'@ | Out-File -FilePath "apps\tranqi-web\.env.local" -Encoding utf8

# ─── 4.2. tinkay-web ───
@'
NEXT_PUBLIC_SUPABASE_URL=https://oaybbpdxhlxjbpwnoymy.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_vC-t-FcOQ2Q5_XkTCcPKdQ_bveIh5YS
'@ | Out-File -FilePath "apps\tinkay-web\.env.local" -Encoding utf8

# ─── 4.3. fastfix-web ───
@'
NEXT_PUBLIC_SUPABASE_URL=https://oaybbpdxhlxjbpwnoymy.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_vC-t-FcOQ2Q5_XkTCcPKdQ_bveIh5YS
'@ | Out-File -FilePath "apps\fastfix-web\.env.local" -Encoding utf8

# ─── 4.4. margaritas-web ───
@'
NEXT_PUBLIC_SUPABASE_URL=https://oaybbpdxhlxjbpwnoymy.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_vC-t-FcOQ2Q5_XkTCcPKdQ_bveIh5YS
'@ | Out-File -FilePath "apps\margaritas-web\.env.local" -Encoding utf8

Write-Host "✅ Archivos .env.local creados correctamente en todas las apps." -ForegroundColor Green
```

---

## ⚡ 5. Comandos de Verificación y Desarrollo

```powershell
# Levantar todas las apps del monorepo en paralelo:
pnpm dev

# O levantar una app individual:
pnpm --filter tranqi-web dev       # Tranqi
pnpm --filter fastfix-web dev      # FastFix Home
pnpm --filter tinkay-web dev       # Tinkay
pnpm --filter margaritas-web dev   # Margaritas Floristería

# Verificar tipos y compilación:
pnpm typecheck
pnpm build
```

---

## 🤖 6. Prompt para Antigravity en la Nueva Máquina

Cuando abras la carpeta `c:\@Antigravity\ecosistema` en Antigravity en tu nueva máquina, puedes enviar este prompt inicial:

> *"Hola Antigravity. He clonado el repositorio del ecosistema en esta nueva máquina. Por favor lee `AGENTS.md`, `.claude/COMMON_MISTAKES.md`, `gobernanza/arquitectura/marco-de-trabajo.md` y confirma que el entorno, ramas y dependencias estén listos para continuar con el desarrollo."*
