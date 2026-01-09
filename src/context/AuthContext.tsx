import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../services/supabase';
import { mockApi } from '../services/mockApi';
import { supabaseApi } from '../services/supabaseApi';
import * as storageUtils from '../utils/storage';
import { User, AuthResponse, PaymentMethod } from '../types';
import { getDeviceId, registerForPushNotifications } from '../services/notificationService';

interface UpdateProfileData {
  name?: string;
  phone?: string;
  paymentMethod?: PaymentMethod;
}

interface AuthContextType {
  sign: {
    signIn: (email: string, password: string) => Promise<AuthResponse>;
    signUp: (email: string, password: string, name: string, phone?: string, paymentMethod?: PaymentMethod) => Promise<AuthResponse>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    confirmPasswordReset: (newPassword: string) => Promise<void>;
  };
  updateProfile: (data: UpdateProfileData) => Promise<void>;
  restoreToken: () => Promise<void>;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  isSigningIn: boolean;
  isSigningUp: boolean;
  isResettingPassword: boolean;
  isConfirmingReset: boolean;
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
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

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

          // Fetch user profile from database
          let userProfile = await supabaseApi.getUserProfile(authUser.id);

          // If no profile exists, create one from user_metadata (backwards compatibility)
          if (!userProfile) {
            console.log('[AuthContext] No user_profiles record found, creating from metadata');
            const name = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User';
            const phone = authUser.user_metadata?.phone;
            const paymentMethod = authUser.user_metadata?.payment_method;

            try {
              await supabase.schema('amot').from('user_profiles').insert({
                id: authUser.id,
                email: authUser.email || '',
                display_name: name,
                phone: phone || null,
                payment_method: paymentMethod || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              console.log('[AuthContext] User profile created from metadata');

              // Fetch the newly created profile
              userProfile = await supabaseApi.getUserProfile(authUser.id);
            } catch (profileError) {
              console.error('[AuthContext] Failed to create profile from metadata:', profileError);
            }
          }

          const user: User = userProfile || {
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
            phone: authUser.user_metadata?.phone,
            paymentMethod: authUser.user_metadata?.payment_method,
            createdAt: new Date(authUser.created_at).getTime(),
          };

          await storageUtils.saveAuthToken(session.access_token);
          await storageUtils.saveCurrentUser(user);
          setUser(user);

          // Register for push notifications on session restore
          try {
            const pushToken = await registerForPushNotifications();
            if (pushToken) {
              const deviceId = getDeviceId();
              await supabaseApi.savePushToken({
                userId: user.id,
                token: pushToken,
                deviceId,
                platform: Platform.OS as 'ios' | 'android' | 'web',
              });
              console.log('[AuthContext] Push token updated on session restore');

              // Check for pending poke notifications
              try {
                console.log('[AuthContext] Checking for pending pokes on restore...');
                await supabaseApi.sendPendingPokeNotifications(user.id, pushToken);
              } catch (pokeError) {
                console.warn('[AuthContext] Failed to send pending pokes on restore:', pokeError);
              }
            }
          } catch (pushError) {
            console.warn('[AuthContext] Could not update push token on restore:', pushError);
          }
        } else {
          // Fall back to local storage
          const token = await storageUtils.getAuthToken();
          const currentUser = await storageUtils.getCurrentUser();

          if (token && currentUser) {
            // Try to fetch latest profile from database
            try {
              const userProfile = await supabaseApi.getUserProfile(currentUser.id);
              if (userProfile) {
                await storageUtils.saveCurrentUser(userProfile);
                setUser(userProfile);
              } else {
                setUser(currentUser);
              }
            } catch (profileError) {
              console.warn('[AuthContext] Could not fetch user profile, using cached:', profileError);
              setUser(currentUser);
            }

            // Register for push notifications on session restore
            try {
              const pushToken = await registerForPushNotifications();
              if (pushToken) {
                const deviceId = getDeviceId();
                await supabaseApi.savePushToken({
                  userId: currentUser.id,
                  token: pushToken,
                  deviceId,
                  platform: Platform.OS as 'ios' | 'android' | 'web',
                });
                console.log('[AuthContext] Push token updated on local storage restore');

                // Check for pending poke notifications
                try {
                  console.log('[AuthContext] Checking for pending pokes on restore...');
                  await supabaseApi.sendPendingPokeNotifications(currentUser.id, pushToken);
                } catch (pokeError) {
                  console.warn('[AuthContext] Failed to send pending pokes on restore:', pokeError);
                }
              }
            } catch (pushError) {
              console.warn('[AuthContext] Could not update push token on restore:', pushError);
            }
          }
        }
      } catch (sessionError) {
        console.warn('Failed to check Supabase session:', sessionError);
        // Fall back to local storage
        const token = await storageUtils.getAuthToken();
        const currentUser = await storageUtils.getCurrentUser();

        if (token && currentUser) {
          // Try to fetch latest profile from database
          try {
            const userProfile = await supabaseApi.getUserProfile(currentUser.id);
            if (userProfile) {
              await storageUtils.saveCurrentUser(userProfile);
              setUser(userProfile);
            } else {
              setUser(currentUser);
            }
          } catch (profileError) {
            console.warn('[AuthContext] Could not fetch user profile, using cached:', profileError);
            setUser(currentUser);
          }

          // Register for push notifications on session restore
          try {
            const pushToken = await registerForPushNotifications();
            if (pushToken) {
              const deviceId = getDeviceId();
              await supabaseApi.savePushToken({
                userId: currentUser.id,
                token: pushToken,
                deviceId,
                platform: Platform.OS as 'ios' | 'android' | 'web',
              });
              console.log('[AuthContext] Push token updated on error fallback restore');
            }
          } catch (pushError) {
            console.warn('[AuthContext] Could not update push token on restore:', pushError);
          }
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

          // Fetch user profile from database
          let userProfile = await supabaseApi.getUserProfile(authUser.id);

          // If no profile exists, create one from user_metadata (backwards compatibility)
          if (!userProfile) {
            console.log('[AuthContext] No user_profiles record found on login, creating from metadata');
            const name = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User';
            const phone = authUser.user_metadata?.phone;
            const paymentMethod = authUser.user_metadata?.payment_method;

            try {
              await supabase.schema('amot').from('user_profiles').insert({
                id: authUser.id,
                email: authUser.email || '',
                display_name: name,
                phone: phone || null,
                payment_method: paymentMethod || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              console.log('[AuthContext] User profile created from metadata on login');

              // Fetch the newly created profile
              userProfile = await supabaseApi.getUserProfile(authUser.id);
            } catch (profileError) {
              console.error('[AuthContext] Failed to create profile from metadata on login:', profileError);
            }
          }

          const user: User = userProfile || {
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
            phone: authUser.user_metadata?.phone,
            paymentMethod: authUser.user_metadata?.payment_method,
            createdAt: new Date(authUser.created_at).getTime(),
          };
		  console.log('Authenticated user:', user);

          const token = data.session?.access_token || '';

          await storageUtils.saveAuthToken(token);
          await storageUtils.saveCurrentUser(user);
          setUser(user);

          // Register for push notifications and save token
          try {
            console.log('[AuthContext] Registering for push notifications...');
            const pushToken = await registerForPushNotifications();

            if (pushToken) {
              console.log('[AuthContext] Push token received:', pushToken);
              const deviceId = getDeviceId();
              await supabaseApi.savePushToken({
                userId: user.id,
                token: pushToken,
                deviceId,
                platform: Platform.OS as 'ios' | 'android' | 'web',
              });
              console.log('[AuthContext] Push token saved successfully');

              // Check for pending poke notifications and send them
              try {
                console.log('[AuthContext] Checking for pending poke notifications...');
                await supabaseApi.sendPendingPokeNotifications(user.id, pushToken);
              } catch (pokeError) {
                console.warn('[AuthContext] Failed to send pending poke notifications:', pokeError);
                // Non-critical, don't block login
              }
            } else {
              console.warn('[AuthContext] Failed to get push token (might be simulator/web)');
            }
          } catch (pushError) {
            console.error('[AuthContext] Error saving push token:', pushError);
            // Don't fail login if push token registration fails
          }

          return { user, token };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Login failed';
          setError(errorMessage);
          throw new Error(errorMessage);
        } finally {
          setIsSigningIn(false);
        }
      },

      signUp: async (email: string, password: string, name: string, phone?: string, paymentMethod?: PaymentMethod) => {
        setIsSigningUp(true);
        setError(null);
        try {
          const result = await supabase.auth.signUp({
            email,
            password,
			phone,
            options: {
              data: {
                name,
                phone,
                payment_method: paymentMethod,
              },
            },
          });

          const signUpError = result?.error;
          const data = result?.data;

          if (signUpError) throw signUpError;
          if (!data?.user) throw new Error('No user returned from signup');

          const authUser = data.user;

          // Check if email confirmation is required
          if (!data.session) {
            // No session means email confirmation is required
            console.log('[AuthContext] Signup successful - email confirmation required');
            console.log('[AuthContext] User will need to confirm email before logging in');
            console.log('[AuthContext] User profile will be created upon first login');

            // Don't auto-login - user needs to confirm email first
            // Return a minimal user object just for the UI to show success message
            const user: User = {
              id: authUser.id,
              email: authUser.email || '',
              name: name || authUser.email?.split('@')[0] || 'User',
              phone,
              paymentMethod,
              createdAt: new Date(authUser.created_at).getTime(),
            };

            return { user, token: '' };
          }

          // If session exists (email confirmation disabled), proceed with auto-login
          console.log('[AuthContext] Signup successful with session - auto-login enabled');

          const user: User = {
            id: authUser.id,
            email: authUser.email || '',
            name: name || authUser.email?.split('@')[0] || 'User',
            phone,
            paymentMethod,
            createdAt: new Date(authUser.created_at).getTime(),
          };

          const token = data.session.access_token;

          // Create user profile in database (only if authenticated)
          try {
            await supabase.schema('amot').from('user_profiles').insert({
              id: authUser.id,
              email: authUser.email || '',
              display_name: name || authUser.email?.split('@')[0] || 'User',
              phone: phone || null,
              payment_method: paymentMethod || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            console.log('[AuthContext] User profile created successfully');
          } catch (profileError) {
            console.error('[AuthContext] Failed to create user profile:', profileError);
            // Don't fail signup if profile creation fails - user can update later
          }

          await storageUtils.saveAuthToken(token);
          await storageUtils.saveCurrentUser(user);
          setUser(user);

          // Register for push notifications and save token
          try {
            console.log('[AuthContext] Registering for push notifications...');
            const pushToken = await registerForPushNotifications();

            if (pushToken) {
              console.log('[AuthContext] Push token received:', pushToken);
              const deviceId = getDeviceId();
              await supabaseApi.savePushToken({
                userId: user.id,
                token: pushToken,
                deviceId,
                platform: Platform.OS as 'ios' | 'android' | 'web',
              });
              console.log('[AuthContext] Push token saved successfully');

              // Check for pending poke notifications and send them
              try {
                console.log('[AuthContext] Checking for pending poke notifications...');
                await supabaseApi.sendPendingPokeNotifications(user.id, pushToken);
              } catch (pokeError) {
                console.warn('[AuthContext] Failed to send pending poke notifications:', pokeError);
                // Non-critical, don't block login
              }
            } else {
              console.warn('[AuthContext] Failed to get push token (might be simulator/web)');
            }
          } catch (pushError) {
            console.error('[AuthContext] Error saving push token:', pushError);
            // Don't fail signup if push token registration fails
          }

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
          // Note: We don't delete push tokens on logout anymore
          // This allows multiple users to have tokens for the same device
          // Each user will have their own record in push_tokens table

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

      resetPassword: async (email: string) => {
        setIsResettingPassword(true);
        setError(null);
        try {
          const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://jackstone02.github.io/split-pay/password-reset.html',
          });

          if (resetError) throw resetError;

          console.log('[AuthContext] Password reset email sent successfully');
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email';
          setError(errorMessage);
          throw new Error(errorMessage);
        } finally {
          setIsResettingPassword(false);
        }
      },

      confirmPasswordReset: async (newPassword: string) => {
        setIsConfirmingReset(true);
        setError(null);
        try {
          const { error: updateError } = await supabase.auth.updateUser({
            password: newPassword,
          });

          if (updateError) throw updateError;

          console.log('[AuthContext] Password updated successfully');
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to reset password';
          setError(errorMessage);
          throw new Error(errorMessage);
        } finally {
          setIsConfirmingReset(false);
        }
      },
    },

    updateProfile: async (data: UpdateProfileData) => {
      if (!user) throw new Error('Not authenticated');

      try {
        setError(null);

        // Update user metadata in Supabase
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            name: data.name,
            phone: data.phone,
            paymentMethod: data.paymentMethod,
          },
        });

        if (updateError) throw updateError;

        // Update user profile in database
        try {
          await supabase.schema('amot').from('user_profiles').upsert({
            id: user.id,
            email: user.email,
            display_name: data.name || user.name,
            phone: data.phone,
            payment_method: data.paymentMethod,
            updated_at: new Date().toISOString(),
          });
        } catch (profileError) {
          console.warn('Failed to update user profile in database:', profileError);
        }

        // Update local user state
        const updatedUser: User = {
          ...user,
          name: data.name || user.name,
          phone: data.phone,
          paymentMethod: data.paymentMethod,
        };

        await storageUtils.saveCurrentUser(updatedUser);
        setUser(updatedUser);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },

    restoreToken: bootstrapAsync,
    user,
    isLoading,
    error,
    setError,
    isSigningIn,
    isSigningUp,
    isResettingPassword,
    isConfirmingReset,
  };

  return (
    <AuthContext.Provider value={authContext}>
      {children}
    </AuthContext.Provider>
  );
};
