import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { mockApi } from '../services/mockApi';
import * as storageUtils from '../utils/storage';
import { User, AuthResponse } from '../types';

interface AuthContextType {
  sign: {
    signIn: (email: string, password: string) => Promise<AuthResponse>;
    signUp: (email: string, password: string, name: string) => Promise<AuthResponse>;
    signOut: () => Promise<void>;
  };
  restoreToken: () => Promise<void>;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  isSigningIn: boolean;
  isSigningUp: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);

  // Check if user is already logged in
  const bootstrapAsync = useCallback(async () => {
    try {
      setIsLoading(true);

      // Check for existing Supabase session - safe access without destructuring
      try {
        let session = null;
        try {
          const result = await supabase.auth.getSession();
          session = result?.data?.session;
        } catch (supabaseErr) {
          console.warn('[AuthContext] Supabase getSession error:', supabaseErr);
        }

        if (session && session?.user) {
          const authUser = session.user;
          const user: User = {
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
            createdAt: new Date(authUser.created_at).getTime(),
          };

          await storageUtils.saveAuthToken(session.access_token);
          await storageUtils.saveCurrentUser(user);
          setUser(user);
        } else {
          // Fall back to local storage
          const token = await storageUtils.getAuthToken();
          const currentUser = await storageUtils.getCurrentUser();

          if (token && currentUser) {
            setUser(currentUser);
          }
        }
      } catch (sessionError) {
        console.warn('Failed to check Supabase session:', sessionError);
        // Fall back to local storage
        const token = await storageUtils.getAuthToken();
        const currentUser = await storageUtils.getCurrentUser();

        if (token && currentUser) {
          setUser(currentUser);
        }
      }

      // Initialize mock data on first app launch
      await mockApi.initializeMockData();
    } catch (e) {
      console.error('Failed to restore token:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await bootstrapAsync();
      } catch (error) {
        console.error('[AuthContext] bootstrapAsync error:', error);
        setIsLoading(false);
      }
    })();
  }, [bootstrapAsync]);

  const authContext: AuthContextType = {
    sign: {
      signIn: async (email: string, password: string) => {
        setIsSigningIn(true);
        setError(null);
        try {
          const result = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          const signInError = result?.error;
          const data = result?.data;

          if (signInError) throw signInError;
          if (!data?.user) throw new Error('No user returned from login');

          const authUser = data.user;
          const user: User = {
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
            createdAt: new Date(authUser.created_at).getTime(),
          };

          const token = data.session?.access_token || '';

          await storageUtils.saveAuthToken(token);
          await storageUtils.saveCurrentUser(user);
          setUser(user);

          return { user, token };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Login failed';
          setError(errorMessage);
          throw new Error(errorMessage);
        } finally {
          setIsSigningIn(false);
        }
      },

      signUp: async (email: string, password: string, name: string) => {
        setIsSigningUp(true);
        setError(null);
        try {
          const result = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                name,
              },
            },
          });

          const signUpError = result?.error;
          const data = result?.data;

          if (signUpError) throw signUpError;
          if (!data?.user) throw new Error('No user returned from signup');

          const authUser = data.user;
          const user: User = {
            id: authUser.id,
            email: authUser.email || '',
            name: name || authUser.email?.split('@')[0] || 'User',
            createdAt: new Date(authUser.created_at).getTime(),
          };

          const token = data.session?.access_token || '';

          // Try to create user profile in database (optional)
          try {
            await supabase.from('users').upsert({
              id: user.id,
              email: user.email,
              name: user.name,
              created_at: new Date().toISOString(),
            });
          } catch (profileError) {
            console.warn('Failed to create user profile:', profileError);
            // Don't fail signup if profile creation fails
          }

          await storageUtils.saveAuthToken(token);
          await storageUtils.saveCurrentUser(user);
          setUser(user);

          return { user, token };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Signup failed';
          setError(errorMessage);
          throw new Error(errorMessage);
        } finally {
          setIsSigningUp(false);
        }
      },

      signOut: async () => {
        console.log('[AuthContext] signOut() called');
        setError(null);
        try {
          // Try to sign out from Supabase
          try {
            console.log('[AuthContext] Calling supabase.auth.signOut()');
            await supabase.auth.signOut();
            console.log('[AuthContext] Supabase signOut successful');
          } catch (supabaseError) {
            console.warn('[AuthContext] Supabase signOut failed (may be offline):', supabaseError);
            // Continue with local logout even if Supabase fails
          }

          // Always clear local storage regardless of Supabase status
          console.log('[AuthContext] Clearing local storage');
          await storageUtils.removeAuthToken();
          await storageUtils.removeCurrentUser();
          console.log('[AuthContext] Setting user to null');
          setUser(null);
          console.log('[AuthContext] Logout completed');
        } catch (err) {
          console.error('[AuthContext] Local logout error:', err);
          throw err;
        }
      },
    },

    restoreToken: bootstrapAsync,
    user,
    isLoading,
    error,
    setError,
    isSigningIn,
    isSigningUp,
  };

  return (
    <AuthContext.Provider value={authContext}>
      {children}
    </AuthContext.Provider>
  );
};
