import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, LogIn } from 'lucide-react';

interface SessionExpiredDialogProps {
  open: boolean;
  onReLogin: () => void;
}

export function SessionExpiredDialog({ open, onReLogin }: SessionExpiredDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
            <Clock className="w-6 h-6 text-warning" />
          </div>
          <AlertDialogTitle className="text-center">Session Expired</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Your session has expired for security reasons. Don't worry - any form data you've
            entered has been saved locally. Please sign in again to continue.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction onClick={onReLogin} className="gap-2">
            <LogIn className="w-4 h-4" />
            Sign in again
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
