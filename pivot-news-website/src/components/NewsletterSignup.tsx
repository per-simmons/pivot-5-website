'use client';

import { useState, useCallback, FormEvent } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const MAUTIC_BASE_URL = 'https://app.pivotnews.com';
const MAUTIC_FORM_ID = 1;

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

interface NewsletterSignupProps {
  className?: string;
}

export function NewsletterSignup({ className = '' }: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const trackEvent = useCallback((eventName: string, data?: Record<string, unknown>) => {
    // Analytics event hook - can be extended with Google Analytics, Mixpanel, etc.
    if (typeof window !== 'undefined') {
      // Google Analytics 4
      if ('gtag' in window && typeof (window as unknown as { gtag: (...args: unknown[]) => void }).gtag === 'function') {
        (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', eventName, data);
      }
      // Console log for debugging
      console.log('[Newsletter]', eventName, data);
    }
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Bot detection - if honeypot is filled, silently "succeed"
    if (honeypot) {
      trackEvent('newsletter_bot_detected');
      setStatus('success');
      return;
    }

    // Client-side validation
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      setStatus('error');
      trackEvent('newsletter_validation_error', { reason: 'empty_email' });
      return;
    }

    if (!validateEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      setStatus('error');
      trackEvent('newsletter_validation_error', { reason: 'invalid_email' });
      return;
    }

    setStatus('loading');
    setErrorMessage('');
    trackEvent('newsletter_submit_started');

    try {
      // Submit to Mautic form endpoint
      const formData = new FormData();
      formData.append('mauticform[formId]', MAUTIC_FORM_ID.toString());
      formData.append('mauticform[email]', email);
      formData.append('mauticform[return]', '');
      formData.append('mauticform[formName]', 'pivotai');

      const response = await fetch(`${MAUTIC_BASE_URL}/form/submit?formId=${MAUTIC_FORM_ID}`, {
        method: 'POST',
        body: formData,
        mode: 'no-cors', // Mautic doesn't support CORS by default
      });

      // With no-cors mode, we can't read the response, so we assume success
      // if no network error occurred
      setStatus('success');
      setEmail('');
      trackEvent('newsletter_signup_success');
    } catch (error) {
      console.error('Newsletter signup error:', error);
      setErrorMessage('Something went wrong. Please try again.');
      setStatus('error');
      trackEvent('newsletter_signup_error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [email, honeypot, trackEvent]);

  const handleRetry = useCallback(() => {
    setStatus('idle');
    setErrorMessage('');
  }, []);

  return (
    <div className={`w-full ${className}`}>
      <div className="rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 p-6 sm:p-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
            Get the Daily Brief
          </h2>
          <p className="text-slate-600 mb-6">
            Join thousands of professionals who start their day with Pivot 5.
          </p>

          {status === 'success' ? (
            <div className="flex items-center justify-center gap-3 py-4">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <p className="text-green-700 font-medium">
                You&apos;re in! Check your inbox to confirm your subscription.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              {/* Honeypot field - hidden from real users */}
              <input
                type="text"
                name="website_url"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] opacity-0 pointer-events-none"
              />

              <div className="flex-1 relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={status === 'loading'}
                  className={`w-full px-4 py-3 rounded-xl border text-base text-slate-900 transition-colors outline-none placeholder:text-slate-400 ${
                    status === 'error'
                      ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                      : 'border-slate-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                  aria-label="Email address"
                  aria-invalid={status === 'error'}
                  aria-describedby={status === 'error' ? 'email-error' : undefined}
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[140px]"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Subscribing...
                  </>
                ) : (
                  'Subscribe'
                )}
              </button>
            </form>
          )}

          {status === 'error' && errorMessage && (
            <div
              id="email-error"
              className="flex items-center justify-center gap-2 mt-3 text-red-600"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{errorMessage}</span>
              <button
                onClick={handleRetry}
                className="text-sm underline hover:no-underline ml-1"
              >
                Try again
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
