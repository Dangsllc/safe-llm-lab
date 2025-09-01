// Login form component for multi-user authentication

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { InputSanitizer } from '@/lib/security/input-sanitizer';
import { logSecurity } from '@/lib/security/secure-logger';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [requiresMFA, setRequiresMFA] = useState(false);
  
  const { login, verifyMFA } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Sanitize inputs
      const sanitizedEmail = InputSanitizer.sanitizeEmail(email);
      const sanitizedPassword = InputSanitizer.sanitizeInput(password);

      if (!sanitizedEmail || !sanitizedPassword) {
        setError('Please provide valid email and password');
        return;
      }

      let result;
      
      if (requiresMFA) {
        // MFA verification step
        const sanitizedMfaToken = InputSanitizer.sanitizeInput(mfaToken);
        if (!sanitizedMfaToken) {
          setError('Please provide a valid MFA token');
          return;
        }
        
        result = await verifyMFA(sanitizedEmail, sanitizedPassword, sanitizedMfaToken);
      } else {
        // Initial login attempt
        result = await login({
          email: sanitizedEmail,
          password: sanitizedPassword,
          rememberMe
        });
      }

      if (result.success) {
        logSecurity('Login successful via form', { email: sanitizedEmail });
        // Navigation will be handled by AuthContext/App component
      } else if (result.requiresMFA) {
        setRequiresMFA(true);
        setError('');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (error) {
      setError('Login request failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>
          {requiresMFA 
            ? 'Enter your MFA token to complete login'
            : 'Enter your credentials to access Safe LLM Lab'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!requiresMFA ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                />
                <Label htmlFor="remember" className="text-sm">
                  Remember me
                </Label>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="mfaToken">MFA Token</Label>
              <Input
                id="mfaToken"
                type="text"
                value={mfaToken}
                onChange={(e) => setMfaToken(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                required
                disabled={isLoading}
              />
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : requiresMFA ? 'Verify MFA' : 'Sign In'}
          </Button>

          {!requiresMFA && (
            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={onSwitchToRegister}
                disabled={isLoading}
              >
                Don't have an account? Sign up
              </Button>
            </div>
          )}

          {requiresMFA && (
            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setRequiresMFA(false);
                  setMfaToken('');
                  setError('');
                }}
                disabled={isLoading}
              >
                Back to login
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
