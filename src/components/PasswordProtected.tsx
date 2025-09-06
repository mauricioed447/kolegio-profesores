// RUTA: src/components/PasswordProtected.tsx

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PasswordProtectedProps {
  children: React.ReactNode;
}

const PasswordProtected: React.FC<PasswordProtectedProps> = ({ children }) => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // En una aplicación real, esta verificación sería más robusta.
    // Para este proyecto, usaremos sessionStorage para simplicidad.
    const sessionAuth = sessionStorage.getItem('kolegio-profesores-auth');
    if (sessionAuth === 'true') {
      setIsAuthenticated(true);
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  if (!isAuthenticated) {
    // Muestra un loader o nada mientras se redirige para evitar un parpadeo
    return null;
  }

  return <>{children}</>;
};

export default PasswordProtected;
