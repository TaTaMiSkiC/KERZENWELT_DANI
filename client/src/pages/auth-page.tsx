import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Helmet } from 'react-helmet';
import Layout from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  Mail 
} from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type LoginFormValues = {
  username: string;
  password: string;
};

type RegisterFormValues = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState<boolean>(false);
  const { user, loginMutation, registerMutation } = useAuth();
  const [, navigate] = useLocation();
  const { t, language } = useLanguage();

  // Create validation schemas with translations
  const loginSchema = z.object({
    username: z.string().min(1, t("auth.usernameRequired")),
    password: z.string().min(1, t("auth.passwordRequired")),
  });

  const registerSchema = z.object({
    username: z.string().min(3, t("auth.usernameMinLength")),
    email: z.string().email(t("auth.emailInvalid")),
    password: z.string().min(6, t("auth.passwordMinLength")),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t("auth.passwordsDoNotMatch"),
    path: ["confirmPassword"],
  });

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  // Login form setup
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Register form setup
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Check for verification token in URL when component mounts
  useEffect(() => {
    const verifyEmailToken = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      
      if (token) {
        try {
          const response = await fetch(`/api/verify-email/${token}`);
          const data = await response.json();
          
          if (response.ok) {
            setVerificationSuccess(true);
            setVerificationMessage(t("auth.emailVerificationSuccess"));
          } else {
            setVerificationSuccess(false);
            setVerificationMessage(data.message || t("auth.emailVerificationFailed"));
          }
        } catch (error) {
          console.error("Verification error:", error);
          setVerificationSuccess(false);
          setVerificationMessage(t("auth.emailVerificationError"));
        }
      }
    };
    
    verifyEmailToken();
  }, [t]);

  // Form submission handlers
  const onLoginSubmit = (values: LoginFormValues) => {
    // Reset verification message when attempting to login
    setVerificationMessage(null);
    
    loginMutation.mutate(values, {
      onError: (error: any) => {
        // Check for email not verified error
        if (error.message === "email_not_verified") {
          setVerificationMessage(t("auth.emailNotVerified"));
          setVerificationSuccess(false);
        }
      }
    });
  };

  const onRegisterSubmit = (values: RegisterFormValues) => {
    const { confirmPassword, ...registerData } = values;
    
    // Add current language preference to registration data
    const registerDataWithLanguage = {
      ...registerData,
      language: language
    };
    
    registerMutation.mutate(registerDataWithLanguage, {
      onSuccess: (data) => {
        // Check if the response contains the verification message
        if (data.message === "registration_success_verify_email") {
          setVerificationMessage(t("auth.registrationSuccessVerifyEmail"));
          setVerificationSuccess(true);
        }
      }
    });
  };

  return (
    <Layout>
      <Helmet>
        <title>{t("auth.title")}</title>
        <meta name="description" content={t("auth.description")} />
      </Helmet>
      
      <div className="py-16 bg-background">
        <div className="container mx-auto px-4">
          {/* Verification Messages */}
          {verificationMessage && (
            <div className="mb-8">
              <Alert variant={verificationSuccess ? "default" : "destructive"}>
                {verificationSuccess ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {verificationSuccess 
                    ? t("auth.verificationSuccessTitle") 
                    : t("auth.verificationErrorTitle")
                  }
                </AlertTitle>
                <AlertDescription>
                  {verificationMessage}
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left side - Auth forms */}
            <div>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8">
                  <TabsTrigger value="login">{t("auth.login")}</TabsTrigger>
                  <TabsTrigger value="register">{t("auth.register")}</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login">
                  <Card>
                    <CardHeader>
                      <CardTitle className="heading text-2xl">{t("auth.loginTitle")}</CardTitle>
                      <CardDescription>
                        {t("auth.loginDescription")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...loginForm}>
                        <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                          <FormField
                            control={loginForm.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("auth.username")}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t("auth.usernamePlaceholder")} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={loginForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("auth.password")}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input 
                                      type={showLoginPassword ? "text" : "password"} 
                                      placeholder={t("auth.passwordPlaceholder")} 
                                      {...field}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                                      tabIndex={-1}
                                    >
                                      {showLoginPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span className="sr-only">
                                        {showLoginPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                                      </span>
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <Button 
                            type="submit" 
                            className="w-full" 
                            disabled={loginMutation.isPending}
                          >
                            {loginMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t("auth.loginProcessing")}
                              </>
                            ) : (
                              t("auth.loginButton")
                            )}
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                    <CardFooter className="flex justify-center">
                      <Button 
                        variant="link" 
                        onClick={() => setActiveTab("register")}
                      >
                        {t("auth.noAccount")}
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
                
                <TabsContent value="register">
                  <Card>
                    <CardHeader>
                      <CardTitle className="heading text-2xl">{t("auth.registerTitle")}</CardTitle>
                      <CardDescription>
                        {t("auth.registerDescription")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...registerForm}>
                        <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                          <FormField
                            control={registerForm.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("auth.username")}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t("auth.usernameRegisterPlaceholder")} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={registerForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("auth.email")}</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder={t("auth.emailPlaceholder")} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={registerForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("auth.password")}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input 
                                      type={showRegisterPassword ? "text" : "password"} 
                                      placeholder={t("auth.passwordPlaceholder")} 
                                      {...field}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                      tabIndex={-1}
                                    >
                                      {showRegisterPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span className="sr-only">
                                        {showRegisterPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                                      </span>
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={registerForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("auth.confirmPassword")}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input 
                                      type={showConfirmPassword ? "text" : "password"} 
                                      placeholder={t("auth.confirmPasswordPlaceholder")} 
                                      {...field}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                      tabIndex={-1}
                                    >
                                      {showConfirmPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span className="sr-only">
                                        {showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                                      </span>
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <Button 
                            type="submit" 
                            className="w-full" 
                            disabled={registerMutation.isPending}
                          >
                            {registerMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t("auth.registerProcessing")}
                              </>
                            ) : (
                              t("auth.registerButton")
                            )}
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                    <CardFooter className="flex justify-center">
                      <Button 
                        variant="link" 
                        onClick={() => setActiveTab("login")}
                      >
                        {t("auth.haveAccount")}
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
            
            {/* Right side - Hero content */}
            <div className="bg-primary p-10 rounded-lg text-primary-foreground">
              <h2 className="heading text-3xl md:text-4xl font-bold mb-6">
                {t("auth.welcome")}
              </h2>
              <p className="mb-6">
                {t("auth.welcomeDescription")}
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-primary-foreground bg-opacity-20 flex items-center justify-center mr-4">
                    <span className="text-xl font-bold">1</span>
                  </div>
                  <p>{t("auth.step1")}</p>
                </div>
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-primary-foreground bg-opacity-20 flex items-center justify-center mr-4">
                    <span className="text-xl font-bold">2</span>
                  </div>
                  <p>{t("auth.step2")}</p>
                </div>
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-primary-foreground bg-opacity-20 flex items-center justify-center mr-4">
                    <span className="text-xl font-bold">3</span>
                  </div>
                  <p>{t("auth.step3")}</p>
                </div>
              </div>
              
              <p className="text-sm text-primary-foreground opacity-80 italic">
                {t("auth.quote")}
              </p>
              <p className="text-sm font-medium mt-2 text-primary-foreground">{t("auth.founder")}</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
