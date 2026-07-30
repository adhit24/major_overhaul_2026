'use client';

import { useFormStatus } from 'react-dom';
import { MorphingSpinner } from '@/components/ui/morphing-spinner';

export function SubmitButton({
  children,
  className,
  pendingText,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type="submit"
      disabled={pending || props.disabled}
      className={className}
    >
      {pending ? (
        <>
          <MorphingSpinner size="sm" className="h-3.5 w-3.5 shrink-0" />
          <span>{pendingText ?? 'Memproses...'}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
