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

## Cómo Empezar

### Prerrequisitos

-   Node.js (v18 o superior)
-   npm o pnpm

### 1. Clonar el Repositorio

```bash
git clone https://github.com/<tu-usuario>/kolegio-profesores.git
cd kolegio-profesores
