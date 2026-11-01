# Ruta Colombia

Aplicación web progresiva para coordinar las ocho estaciones del evento Ruta Colombia. Está construida con React, TypeScript, Vite, Tailwind CSS y Firebase.

## Desarrollo local

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Sin variables de Firebase, la interfaz funciona en modo de configuración de solo lectura. No usa equipos ni resultados ficticios, y no permite simular guardados. Completa `.env.local` con la configuración de una aplicación web de Firebase para habilitar autenticación y datos:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

Los valores de una app web Firebase identifican el proyecto; no son claves de cuenta de servicio. Nunca coloques credenciales del Admin SDK en el frontend.

## Configuración de Firebase

1. Crea un proyecto en Firebase Console y registra una aplicación web.
2. Activa el proveedor Email/Password en Authentication y crea Cloud Firestore.
3. Copia la configuración web en `.env.local`.
4. Crea la primera cuenta administradora en Authentication. En `users/{uid}` crea su perfil inicial desde la consola:

   ```json
   {
     "uid": "UID_DE_AUTHENTICATION",
     "email": "correo-del-admin",
     "name": "Administrador",
     "role": "admin",
     "stationIds": [],
     "active": true
   }
   ```

5. Instala y compila las funciones:

   ```powershell
   npm install --prefix functions
   npm run build --prefix functions
   ```

6. Vincula el proyecto Firebase de despliegue (el archivo `.firebaserc` se mantiene local):

   ```powershell
   firebase login
   firebase use --add
   ```

7. Despliega reglas, índices, funciones y hosting:

   ```powershell
   npm run build
   firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
   ```

Las funciones usan Node.js 22. Los resultados se confirman en transacciones del servidor; el cliente no puede escribir directamente resultados, perfiles, puntuaciones ni auditoría. La colección `publicTeams` solo contiene campos públicos, mientras que los nombres de participantes quedan en `teams` y solo los administradores pueden leerlos. Las evaluaciones privadas de Caribe se separan de `publicCaribeEvaluations`.

El administrador puede asignar roles y estaciones a cuentas existentes mediante `setUserAccess`. Primero crea la cuenta en Firebase Authentication; después se crea su perfil seguro. Un usuario no puede cambiar su propio rol.

## Modelo del evento

- 14 equipos, hasta seis integrantes cada uno.
- Siete estaciones competitivas con siete enfrentamientos por estación: **49 en total**.
- Caribe es una actividad colectiva independiente: **14 evaluaciones individuales, cero enfrentamientos**.
- Los puntos competitivos iniciales son 16/13/11 para victoria/empate/derrota.
- Caribe convierte la calificación consolidada de su escala configurable a puntos con dos decimales. Antes de confirmar resultados, administración puede elegir promedio simple o ponderado y ajustar los pesos de sus criterios.
- La clasificación se deriva de resultados confirmados. Las correcciones administrativas quedan registradas en auditoría; las reglas y los criterios se bloquean al confirmar resultados.

Las fichas de estaciones incluyen la información proporcionada y no inventan reglas aún pendientes. Las instrucciones de seguridad son visibles; en Llanos se destaca la alternativa sin levantar participantes.

## Comandos

```powershell
npm run build
npm run lint
npm test
npm run build --prefix functions
```

## Datos y modo sin conexión

Firestore conserva una caché local para lecturas compatibles. Los registros de resultados y evaluaciones requieren una confirmación online de Cloud Functions; un fallo de conexión se muestra como error y nunca se presenta como un resultado final. La PWA almacena el shell y los recursos de la aplicación, no respuestas autenticadas ni escrituras pendientes de Firestore.

## Estado de implementación

Incluye interfaz pública/operativa, fichas de estaciones, registro de equipos y resultados, cálculo de clasificación, rotación de enfrentamientos, exportaciones Excel de clasificación y reporte general, reglas Firestore, funciones transaccionales y PWA. Antes del evento real se debe configurar Firebase, desplegar las reglas y funciones, provisionar al administrador y verificar permisos y operación en el proyecto de destino.
