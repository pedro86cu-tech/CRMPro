# 🔐 Documentación del Sistema de Autenticación Externa

## Resumen

El CRM ahora utiliza un sistema de autenticación externa centralizado en lugar de Supabase Auth. Este sistema funciona de manera similar a Auth0 o OAuth2.

---

## 📋 Configuración

### Variables de Entorno (.env)

```env
# External Auth Configuration
VITE_AUTH_URL=https://auth-crmpro.netlify.app
VITE_AUTH_APP_ID=app_a6f840c5-bd1
VITE_AUTH_API_KEY=ak_production_042a5f866c7e35630a9340bd224cbdda
VITE_APP_URL=http://localhost:5173
```

**Importante:** Actualiza `VITE_APP_URL` con la URL de producción cuando despliegues.

---

## 🔄 Flujo de Autenticación

### 1. Inicio de Sesión
```
Usuario → Click "Iniciar Sesión"
       → Redirección a Auth System
       → Login en sistema externo
       → Callback con token
       → Usuario autenticado
```

### 2. URL de Login
```
https://auth-crmpro.netlify.app/login?
  app_id=app_a6f840c5-bd1&
  redirect_uri=https://crmpro.com/callback&
  api_key=ak_production_042a5f866c7e35630a9340bd224cbdda
```

### 3. URL de Callback (Respuesta exitosa)
```
https://crmpro.com/callback?
  token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...&
  refresh_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...&
  user_id=8486f404-93e3-4cb9-a7c3-12fd109e0df3&
  state=authenticated
```

---

## 🎫 Estructura del Token JWT

El token contiene la siguiente información:

```json
{
  "sub": "8486f404-93e3-4cb9-a7c3-12fd109e0df3",
  "email": "usuario@ejemplo.com",
  "name": "Pedro Ayala Ortiz",
  "app_id": "app_a6f840c5-bd1",
  "roles": ["agent"],
  "permissions": ["moderate", "analytics"],
  "iat": 1760282090,
  "exp": 1760368490,
  "iss": "AuthSystem",
  "aud": "crmpro.com"
}
```

### Campos del Token:
- **sub**: ID único del usuario
- **email**: Email del usuario
- **name**: Nombre completo
- **app_id**: ID de la aplicación
- **roles**: Array de roles (admin, manager, agent)
- **permissions**: Array de permisos específicos
- **iat**: Timestamp de emisión
- **exp**: Timestamp de expiración
- **iss**: Emisor del token
- **aud**: Audiencia (tu dominio)

---

## 📂 Archivos Principales

### 1. `/src/lib/externalAuth.ts`
Servicio principal de autenticación que maneja:
- ✅ Redirección a login externo
- ✅ Parsing de callback URL
- ✅ Decodificación de JWT
- ✅ Almacenamiento de tokens
- ✅ Refresh de tokens
- ✅ Logout
- ✅ Validación de expiración

### 2. `/src/components/Auth/CallbackHandler.tsx`
Componente que procesa el callback y:
- ✅ Valida el token
- ✅ Extrae información del usuario
- ✅ Sincroniza con base de datos (profiles)
- ✅ Redirige al dashboard
- ✅ Maneja errores

### 3. `/src/contexts/AuthContext.tsx`
Contexto de autenticación que provee:
- `user`: Información del usuario autenticado
- `isAuthenticated`: Boolean de estado
- `loading`: Estado de carga
- `signIn()`: Función para iniciar sesión
- `signOut()`: Función para cerrar sesión
- `refreshToken()`: Función para renovar token

### 4. `/src/components/Auth/LoginForm.tsx`
Formulario simplificado que solo muestra un botón para redirigir al sistema externo.

---

## 🔑 Funciones Principales

### `externalAuth.redirectToLogin()`
Redirige al usuario al sistema de autenticación externo.

```typescript
externalAuth.redirectToLogin();
// Redirige a: https://auth-crmpro.netlify.app/login?...
```

### `externalAuth.parseCallbackUrl(url)`
Extrae el token, refresh_token y user_id de la URL de callback.

```typescript
const data = externalAuth.parseCallbackUrl(window.location.href);
// { token, refreshToken, userId, state }
```

### `externalAuth.decodeToken(token)`
Decodifica el JWT y retorna el payload.

```typescript
const payload = externalAuth.decodeToken(token);
// { sub, email, name, roles, permissions, ... }
```

### `externalAuth.getUserFromToken(token)`
Extrae la información del usuario del token.

```typescript
const user = externalAuth.getUserFromToken(token);
// { id, email, name, roles, permissions }
```

### `externalAuth.isTokenExpired(token)`
Verifica si el token ha expirado.

```typescript
const expired = externalAuth.isTokenExpired(token);
// true o false
```

### `externalAuth.storeAuthData(token, refreshToken, userId)`
Almacena los datos de autenticación en localStorage.

```typescript
externalAuth.storeAuthData(token, refreshToken, userId);
```

### `externalAuth.refreshAccessToken(refreshToken)`
Obtiene un nuevo access token usando el refresh token.

```typescript
const newToken = await externalAuth.refreshAccessToken(refreshToken);
```

### `externalAuth.logout()`
Cierra sesión y limpia todos los datos almacenados.

```typescript
await externalAuth.logout();
```

---

## 🛡️ Roles y Permisos

### Roles Disponibles:
1. **admin** - Acceso completo al sistema
2. **manager** - Gestión de equipo y supervisión
3. **agent** - Operaciones básicas del día a día

El sistema automáticamente detecta el rol más alto del usuario basado en el array de roles del token.

### Mapeo de Roles:
```typescript
const roleMap = {
  admin: 3,    // Mayor prioridad
  manager: 2,
  agent: 1     // Menor prioridad
};
```

---

## 🔄 Ciclo de Vida de la Sesión

### Inicio de Sesión:
1. Usuario hace click en "Iniciar Sesión"
2. Redirigido a sistema externo
3. Sistema externo valida credenciales
4. Callback con token JWT
5. Token decodificado y validado
6. Usuario almacenado en localStorage
7. Perfil sincronizado en Supabase
8. Redirigido al dashboard

### Navegación:
1. Cada request verifica si hay token válido
2. Si token expiró, intenta refresh automático
3. Si refresh falla, redirige a login

### Cierre de Sesión:
1. Usuario hace click en "Cerrar Sesión"
2. Request a endpoint de logout externo
3. Limpieza de localStorage
4. Redirigido a página de login

---

## 🔒 Seguridad

### Almacenamiento:
- **access_token**: 24 horas de validez
- **refresh_token**: 30 días de validez
- Almacenados en localStorage (considera httpOnly cookies en producción)

### Validación:
- ✅ Verificación de firma JWT
- ✅ Validación de expiración
- ✅ Verificación de issuer y audience
- ✅ Refresh automático de tokens

### Protección de Rutas:
```typescript
<ProtectedRoute>
  <MainApp />
</ProtectedRoute>
```

Solo usuarios autenticados pueden acceder a rutas protegidas.

---

## 🚀 Deployment

### Variables de Producción:

```env
VITE_AUTH_URL=https://auth-crmpro.netlify.app
VITE_AUTH_APP_ID=app_a6f840c5-bd1
VITE_AUTH_API_KEY=ak_production_042a5f866c7e35630a9340bd224cbdda
VITE_APP_URL=https://tudominio.com  # ⚠️ Cambiar a tu URL de producción
```

### Configuración en Sistema Externo:
1. Registra tu aplicación en el sistema de auth
2. Configura la URL de callback permitida: `https://tudominio.com/callback`
3. Obtén tu `app_id` y `api_key`
4. Actualiza las variables de entorno

---

## 🧪 Testing

### Test Manual:
1. Inicia la aplicación: `npm run dev`
2. Navega a `/login`
3. Click en "Iniciar Sesión"
4. Deberías ser redirigido al sistema externo
5. Después de autenticarte, serás redirigido a `/callback`
6. Finalmente, llegarás al dashboard

### Verificar Token:
```javascript
// En DevTools Console
const token = localStorage.getItem('auth_token');
const parts = token.split('.');
const payload = JSON.parse(atob(parts[1]));
console.log(payload);
```

---

## ❓ FAQ

### ¿Qué pasa si el token expira?
El sistema automáticamente intenta refrescarlo usando el refresh_token.

### ¿Puedo usar múltiples roles?
Sí, el token puede contener múltiples roles. El sistema usa el de mayor prioridad.

### ¿Cómo actualizo el perfil del usuario?
El perfil se sincroniza automáticamente en el callback. También puedes actualizarlo manualmente en la tabla `profiles` de Supabase.

### ¿Necesito configurar CORS?
Sí, el sistema externo debe permitir requests desde tu dominio.

### ¿Puedo personalizar el flujo de login?
No directamente, pero puedes agregar lógica pre/post autenticación en `CallbackHandler.tsx`.

---

## 📞 Soporte

Para más información sobre el sistema de autenticación externo:
- URL: https://auth-crmpro.netlify.app
- Documentación: Consultar con el proveedor del servicio

---

**Última actualización:** Octubre 2025
