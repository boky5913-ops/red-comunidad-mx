# Red Comunidad MX — guía de herramientas y paquetes

## Herramientas para programar

- **Visual Studio Code**: editor recomendado para TypeScript, React Native y Node.js.
- **Node.js 22 LTS**: runtime para Expo, Express y las herramientas de compilación.
- **pnpm**: gestor de dependencias usado por este proyecto.
- **Expo CLI / Expo Go**: ejecutar y probar la aplicación móvil en Android o iOS.
- **Android Studio**: emulador Android, SDK y generación de builds Android.
- **Xcode**: simulador y compilación iOS; requiere macOS.
- **Git + GitHub/GitLab**: control de versiones, respaldos y colaboración.
- **Postman o Insomnia**: probar manualmente los endpoints de la API.

## Herramientas para paneles de control y visitantes

La versión actual tiene un panel móvil de Perfil para que el usuario autenticado administre sus publicaciones. Para un panel administrativo web se recomienda crear una aplicación separada con **React/Next.js** o una interfaz web del mismo proyecto.

- **Panel de administración**: React/Next.js con TanStack Query o tRPC para publicaciones, usuarios, moderación y reportes.
- **Base de datos**: MySQL administrado; Drizzle Kit sirve para migraciones y consultas tipadas.
- **Imágenes**: almacenamiento S3-compatible para fotos, con CDN si el volumen crece.
- **Analítica de visitantes**: Google Analytics 4, Matomo o PostHog; configurar consentimiento y privacidad.
- **Monitoreo**: Sentry para errores y Better Stack/Uptime Kuma para disponibilidad.
- **Diseño y prototipos**: Figma para pantallas y flujos antes de programar cambios.

## Estructura de los paquetes

| Paquete | Contenido |
|---|---|
| `01-app-movil.zip` | Pantallas Expo/React Native, componentes, navegación, tema y configuración visual. |
| `02-backend-api.zip` | Servidor Express, tRPC, autenticación, almacenamiento cloud y reglas de negocio. |
| `03-base-datos.zip` | Esquema Drizzle, migraciones y helpers de base de datos. |
| `04-pruebas-config.zip` | Pruebas Vitest, scripts, TypeScript y configuración de validación. |
| `codigo-completo.zip` | Proyecto completo sin `node_modules`, cachés ni archivos temporales. |

## Comandos principales

```bash
pnpm install
pnpm dev
pnpm check
pnpm lint
pnpm test
pnpm build
```

No se incluyen archivos `.env` ni credenciales. Deben configurarse de forma segura en el entorno de despliegue.
