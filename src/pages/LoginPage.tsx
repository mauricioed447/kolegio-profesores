// RUTA: src/pages/LoginPage.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const LoginPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // La contraseña maestra se obtiene de las variables de entorno de Vercel
    const masterPassword = import.meta.env.VITE_APP_PASSWORD;

    if (!masterPassword) {
      setError('La aplicación no está configurada correctamente. Contacte al administrador.');
      return;
    }

    if (password === masterPassword) {
      sessionStorage.setItem('kolegio-profesores-auth', 'true');
      navigate('/', { replace: true });
    } else {
      setError('Contraseña incorrecta. Inténtelo de nuevo.');
      setPassword('');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <img src="/kolegio-logo.png" alt="Kolegio Logo" className="h-16" />
          </div>
          <CardTitle className="text-center text-2xl">Kolegio Profesores</CardTitle>
          <CardDescription className="text-center">
            Acceso al Generador de Pruebas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña Maestra</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Ingrese la contraseña"
              />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" className="w-full">
              Acceder
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
