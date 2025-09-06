# Kolegio Profesores - Test Builder

**Kolegio Test Builder** es una herramienta web minimalista diseñada para que los profesores puedan crear pruebas en formato PDF de alta calidad en menos de un minuto, utilizando el banco de preguntas existente en la base de datos de la aplicación principal de Kolegio.

## Visión del Proyecto

La filosofía se centra en la **simplicidad radical y la velocidad**. El objetivo es eliminar toda la fricción posible del proceso de creación de evaluaciones, transformando el contenido digital interactivo de los quizzes en material tangible y listo para imprimir.

-   **Independiente pero Conectado:** Una aplicación completamente nueva que se conecta a la base de datos de quizzes existente sin modificarla.
-   **Flujo de Trabajo Intuitivo:** Una interfaz de una sola página que guía al usuario a través de un proceso lógico y visual.
-   **Generación en el Navegador:** Utiliza `react-pdf/renderer` para construir los archivos PDF directamente en el navegador del cliente, sin necesidad de un backend complejo.
-   **Acceso Controlado:** Protegido por una única contraseña maestra para simplificar la gestión.

## Stack Tecnológico

-   **Framework:** Vite + React + TypeScript
-   **UI:** Tailwind CSS con componentes de shadcn/ui
-   **Base de Datos:** Conexión de solo lectura a Supabase con `@supabase/supabase-js`
-   **Generación de PDF:** `@react-pdf/renderer`
-   **Drag-and-Drop:** `@dnd-kit`

---

## Instrucciones de Despliegue (Vercel)

Este proyecto está diseñado para ser desplegado directamente desde GitHub a Vercel sin necesidad de comandos locales.

### Paso 1: Crear el Proyecto en Vercel

1.  Ve a tu dashboard de Vercel.
2.  Haz clic en **"Add New..."** y selecciona **"Project"**.
3.  Importa tu repositorio de GitHub `kolegio-profesores`.
4.  Vercel detectará automáticamente que es un proyecto **Vite** y configurará los ajustes de build. No necesitas cambiar nada en esa sección.

### Paso 2: Configurar las Variables de Entorno

Antes de desplegar, es **crucial** añadir las siguientes variables de entorno. Vercel las inyectará de forma segura en tu aplicación.

1.  Dentro de la configuración de tu nuevo proyecto en Vercel, busca la sección **"Environment Variables"**.
2.  Añade las siguientes tres variables:

| Nombre de la Variable        | Valor                                                                | Descripción                                                              |
| ---------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `VITE_SUPABASE_URL`          | La URL de tu proyecto de Supabase.                                   | Se encuentra en `Project Settings > API > Project URL`.                  |
| `VITE_SUPABASE_ANON_KEY`     | La clave `anon` (pública) de tu proyecto.                            | Se encuentra en `Project Settings > API > Project API Keys`.             |
| `VITE_APP_PASSWORD`          | La contraseña maestra que usarás para acceder a la aplicación.       | Elige una contraseña segura.                                             |

### Paso 3: Desplegar

1.  Una vez añadidas las variables, haz clic en el botón **"Deploy"**.
2.  Vercel se encargará de instalar las dependencias (el equivalente a `npm install`) y construir el proyecto automáticamente.
3.  ¡Listo! Una vez finalizado el despliegue, podrás acceder a tu aplicación desde la URL proporcionada por Vercel.

---
