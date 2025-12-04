import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
} from "~/components/ui/dialog";
import logoWithTextUrl from "~/assets/logos/logo-with-text.svg";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import authClient from "~/lib/auth/auth-client";
import { authQueryOptions } from "~/lib/auth/queries";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthSuccess?: () => void;
  initialMode?: "login" | "signup";
}

export function AuthModal({ open, onOpenChange, onAuthSuccess, initialMode = "login" }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(initialMode === "login");
  const [prevOpen, setPrevOpen] = useState(open);
  const queryClient = useQueryClient();

  // Reset to initialMode when modal opens (from closed to open)
  // Using derived state pattern to avoid useEffect + setState
  if (open && !prevOpen) {
    setIsLogin(initialMode === "login");
  }
  if (open !== prevOpen) {
    setPrevOpen(open);
  }

  const { mutate: emailLoginMutate, isPending: isLoginPending } = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const result = await authClient.signIn.email({
          ...data,
          callbackURL: "/create",
      });
      if (result.error) {
        throw new Error(result.error.message || "An error occurred while signing in.");
      }
      return result;
        },
    onError: (error) => {
            toast.error(error.message || "An error occurred while signing in.");
          },
    onSuccess: async () => {
      // Invalidate and refetch user data to ensure session is established
      await queryClient.invalidateQueries({ queryKey: authQueryOptions().queryKey });
      await queryClient.refetchQueries({ queryKey: authQueryOptions().queryKey });
            onOpenChange(false);
            onAuthSuccess?.();
          },
  });

  const { mutate: signupMutate, isPending: isSignupPending } = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string }) => {
      const result = await authClient.signUp.email({
          ...data,
          callbackURL: "/create",
      });
      if (result.error) {
        throw new Error(result.error.message || "An error occurred while signing up.");
      }
      return result;
        },
    onError: (error) => {
            toast.error(error.message || "An error occurred while signing up.");
          },
    onSuccess: async () => {
      // Invalidate and refetch user data to ensure session is established
      await queryClient.invalidateQueries({ queryKey: authQueryOptions().queryKey });
      await queryClient.refetchQueries({ queryKey: authQueryOptions().queryKey });
            onOpenChange(false);
            onAuthSuccess?.();
    },
  });

  const handleLoginSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoginPending) return;

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) return;

    emailLoginMutate({ email, password });
  };

  const handleSignupSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSignupPending) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm_password") as string;

    if (!name || !email || !password || !confirmPassword) return;

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    signupMutate({ name, email, password });
  };

  const isPending = isLoginPending || isSignupPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] border-2 rounded-2xl" style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A' }}>
        <div className="flex justify-center mb-6">
          <img src={logoWithTextUrl} alt="aicall.tv" className="h-10" />
        </div>

        {isLogin ? (
          <div className="flex flex-col gap-6">
            <form onSubmit={handleLoginSubmit}>
              <div className="flex flex-col gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="email" style={{ color: '#1A1A1A' }}>Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="hello@example.com"
                    readOnly={isPending}
                    required
                    className="border-2"
                    style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A', color: '#1A1A1A' }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password" style={{ color: '#1A1A1A' }}>Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Enter password here"
                    readOnly={isPending}
                    required
                    className="border-2"
                    style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A', color: '#1A1A1A' }}
                  />
                </div>
                <Button type="submit" className="mt-2 w-full font-medium hover:opacity-80" size="lg" disabled={isPending} style={{ backgroundColor: '#1A1A1A', color: 'white' }}>
                  {isPending && <LoaderCircle className="animate-spin" />}
                  {isPending ? "Logging in..." : "Login"}
                </Button>
              </div>
            </form>
            <div className="text-center text-sm" style={{ color: '#1A1A1A' }}>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className="underline underline-offset-4 font-medium"
                style={{ color: '#1A1A1A' }}
              >
                Sign up
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <form onSubmit={handleSignupSubmit}>
              <div className="flex flex-col gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="signup-name" style={{ color: '#1A1A1A' }}>Name</Label>
                  <Input
                    id="signup-name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    readOnly={isPending}
                    required
                    className="border-2"
                    style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A', color: '#1A1A1A' }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="signup-email" style={{ color: '#1A1A1A' }}>Email</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    placeholder="hello@example.com"
                    readOnly={isPending}
                    required
                    className="border-2"
                    style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A', color: '#1A1A1A' }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="signup-password" style={{ color: '#1A1A1A' }}>Password</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    placeholder="Password"
                    readOnly={isPending}
                    required
                    className="border-2"
                    style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A', color: '#1A1A1A' }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="signup-confirm-password" style={{ color: '#1A1A1A' }}>Confirm Password</Label>
                  <Input
                    id="signup-confirm-password"
                    name="confirm_password"
                    type="password"
                    placeholder="Confirm Password"
                    readOnly={isPending}
                    required
                    className="border-2"
                    style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A', color: '#1A1A1A' }}
                  />
                </div>
                <Button type="submit" className="mt-2 w-full font-medium hover:opacity-80" size="lg" disabled={isPending} style={{ backgroundColor: '#1A1A1A', color: 'white' }}>
                  {isPending && <LoaderCircle className="animate-spin" />}
                  {isPending ? "Signing up..." : "Sign up"}
                </Button>
              </div>
            </form>
            <div className="text-center text-sm" style={{ color: '#1A1A1A' }}>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className="underline underline-offset-4 font-medium"
                style={{ color: '#1A1A1A' }}
              >
                Login
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

