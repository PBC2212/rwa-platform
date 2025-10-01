'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface ExtendedUser extends User {
  wallet_address?: string;
}

interface AuthContextType {
  user: ExtendedUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const { data: { session } } = await supabase.auth.getSession();
        clearTimeout(timeoutId);
        
        if (session?.user) {
          // Load wallet from profiles
          const { data: profile } = await supabase
            .from('profiles')
            .select('wallet_address')
            .eq('user_id', session.user.id)
            .single();
          
          if (profile?.wallet_address) {
            (session.user as any).wallet_address = profile.wallet_address;
          }
        }
        
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Auth initialization error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        // Load wallet from profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('user_id', session.user.id)
          .single();
        
        if (profile?.wallet_address) {
          (session.user as any).wallet_address = profile.wallet_address;
        }
      }
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting sign in for:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        throw error;
      }

      console.log('Sign in successful:', data.user?.id);

      // Load wallet address from profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('wallet_address')
        .eq('user_id', data.user.id)
        .single();

      if (profileError) {
        console.log('Profile not found, creating...');
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: data.user.id,
            wallet_address: 'GDPM2NHX3QJ3RX2E4R7VNVHXJ672D474XXVE3ZW5NYVWFF2EXFWYQ5BC',
          });

        if (insertError) {
          console.error('Profile creation error:', insertError);
        }
        
        (data.user as any).wallet_address = 'GDPM2NHX3QJ3RX2E4R7VNVHXJ672D474XXVE3ZW5NYVWFF2EXFWYQ5BC';
      } else {
        console.log('Loaded wallet from profile:', profile.wallet_address);
        (data.user as any).wallet_address = profile.wallet_address;
      }

      setUser(data.user);
    } catch (error: any) {
      console.error('Sign in failed:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}