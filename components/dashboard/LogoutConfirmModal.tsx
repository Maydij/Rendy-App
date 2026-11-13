'use client';

/**
 * @file LogoutConfirmModal.tsx
 * @description [UI Component]: Accessible confirmation modal that prompts administrative users
 * before terminating their active session, ensuring zero-trust credential clearing and
 * programmatic redirection to the Rendy authentication portal (/login).
 */

import React, { useState, useCallback } from 'react';
import { LogOut, X, Loader2 } from 'lucide-react';
import { useEscapeClose } from '@/lib/hooks/use-escape-close';
import { supabase } from '@/lib/supabase';
import { logoutAction } from '@/app/actions/auth.actions';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * @name LogoutConfirmModal
 * @description [Business Logic]: Modal dialog preventing accidental account logouts.
 * Upon confirmation, revokes session refresh token families in the backend, purges
 * client-side tokens, and navigates the user back to the sign-in screen.
 */
export function LogoutConfirmModal({ isOpen, onClose }: LogoutConfirmModalProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleClose = useCallback(() => {
    if (isLoggingOut) return;
    onClose();
  }, [isLoggingOut, onClose]);

  useEscapeClose(handleClose, isOpen);

  if (!isOpen) return null;

  const handleConfirmLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      // 1. Terminate client-side Supabase authentication state
      await supabase.auth.signOut().catch(() => {});

      // 2. Clear any browser storage caches
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('rendy_auth_user');
          sessionStorage.clear();
        } catch {
          // Ignore storage access restrictions if any
        }
      }

      // 3. Execute server action: revokes refresh tokens & wipes HttpOnly session cookies
      await logoutAction();
    } catch (error: unknown) {
      const isRedirect =
        (typeof error === 'object' &&
          error !== null &&
          'digest' in error &&
          String((error as { digest: string }).digest).startsWith('NEXT_REDIRECT')) ||
        (error instanceof Error && error.message.includes('NEXT_REDIRECT'));

      if (!isRedirect) {
        console.error('❌ [LogoutConfirmModal] Unexpected error during logout:', error);
      }
    } finally {
      // Hard redirect ensures full browser cache clearing and fresh session evaluation
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 7, 15, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        animation: 'modal-fade-in 0.2s ease forwards',
      }}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-dialog-title"
      aria-describedby="logout-dialog-description"
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: '18px',
          maxWidth: '440px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(239, 68, 68, 0.1)',
          animation: 'entrance-fade-scale 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--bg-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--rendy-danger, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LogOut size={16} />
            </div>
            <h3
              id="logout-dialog-title"
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Cerrar sesión
            </h3>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isLoggingOut}
            aria-label="Cerrar ventana emergente"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: isLoggingOut ? 'not-allowed' : 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color var(--transition-fast)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px 20px 20px 20px' }}>
          <p
            id="logout-dialog-description"
            style={{
              fontSize: '14px',
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
              margin: '0 0 8px 0',
            }}
          >
            ¿Estás seguro de que deseas salir de tu cuenta de Rendy?
          </p>
          <p
            style={{
              fontSize: '12px',
              lineHeight: 1.45,
              color: 'var(--text-muted)',
              margin: 0,
            }}
          >
            Se cerrará tu sesión activa de forma segura y tendrás que volver a introducir tus credenciales para acceder a la plataforma.
          </p>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '24px',
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoggingOut}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)',
                borderRadius: '8px',
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                transition: 'var(--transition-fast)',
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmLogout}
              disabled={isLoggingOut}
              style={{
                background: isLoggingOut
                  ? 'var(--bg-overlay)'
                  : 'var(--rendy-danger, #ef4444)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isLoggingOut ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isLoggingOut
                  ? 'none'
                  : '0 4px 14px rgba(239, 68, 68, 0.35)',
                transition: 'var(--transition-fast)',
              }}
            >
              {isLoggingOut ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Cerrando sesión...
                </>
              ) : (
                <>
                  <LogOut size={15} />
                  Cerrar sesión
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
