import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/store/auth";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoadingOverlay from "@/components/LoadingOverlay";
import { UserRole } from "@shared/types";
import { LucideStethoscope, LucideHospital, LucideActivity } from "lucide-react";

export default function WebLogin() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { login } = useAuth();
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("DOCTOR");
  const [showOtpLogin, setShowOtpLogin] = useState(false);
  const [otp, setOtp] = useState("");

  // OTP-based login
  const requestOtpMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest("POST", "/api/auth/request-otp", { phone });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t('login.otpSent'),
        description: t('login.otpSentDesc'),
      });
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('login.otpRequestFailed'),
        variant: "destructive",
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (data: { phone: string; otp: string; role: UserRole }) => {
      const res = await apiRequest("POST", "/api/auth/verify-web-otp", data);
      return res.json();
    },
    onSuccess: (data) => {
      login(data.token, data.user);
      navigate("/web-dashboard");
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('login.otpVerifyFailed'),
        variant: "destructive",
      });
    },
  });

  // Password-based login (for web dashboard users)
  const loginMutation = useMutation({
    mutationFn: async (data: { phone: string; password: string; role: UserRole }) => {
      const res = await apiRequest("POST", "/api/auth/web-login", data);
      return res.json();
    },
    onSuccess: (data) => {
      login(data.token, data.user);
      navigate("/web-dashboard");
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || "Login failed. Please check your credentials.",
        variant: "destructive",
      });
    },
  });

  const handleOtpRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length === 10) {
      requestOtpMutation.mutate(phoneNumber);
    } else {
      toast({
        title: t('common.error'),
        description: t('login.invalidPhone'),
        variant: "destructive",
      });
    }
  };

  const handleOtpVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length === 4) {
      verifyOtpMutation.mutate({ phone: phoneNumber, otp, role });
    } else {
      toast({
        title: t('common.error'),
        description: t('login.invalidOtp'),
        variant: "destructive",
      });
    }
  };

  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ phone: phoneNumber, password, role });
  };

  const getRoleIcon = (userRole: UserRole) => {
    switch(userRole) {
      case "DOCTOR":
        return <LucideStethoscope className="h-5 w-5" />;
      case "ADMIN":
        return <LucideActivity className="h-5 w-5" />;
      default:
        return <LucideHospital className="h-5 w-5" />;
    }
  };

  const getRoleName = (userRole: UserRole) => {
    switch(userRole) {
      case "DOCTOR": 
        return t('webDashboard.doctor');
      case "ADMIN":
        return t('webDashboard.admin');
      default:
        return t('webDashboard.healthWorker');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex flex-col items-center justify-center p-4">
      {(requestOtpMutation.isPending || verifyOtpMutation.isPending || loginMutation.isPending) && (
        <LoadingOverlay message={
          loginMutation.isPending 
            ? "Logging in..." 
            : requestOtpMutation.isPending 
              ? t('login.sendingOtp') 
              : t('login.verifyingOtp')
        } />
      )}

      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Hero Section */}
        <div className="order-2 lg:order-1 text-center lg:text-left">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            RuTAI உயிர்த்தெழு
          </h1>
          <h2 className="text-xl md:text-2xl font-semibold mb-3 text-gray-700">
            {t('webDashboard.heroTitle')}
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto lg:mx-0">
            {t('webDashboard.heroDescription')}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center lg:items-start">
              <div className="rounded-full bg-blue-100 p-2 mb-2">
                <LucideStethoscope className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-medium">{t('webDashboard.doctor')}</h3>
              <p className="text-sm text-gray-500">{t('webDashboard.doctorDesc')}</p>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center lg:items-start">
              <div className="rounded-full bg-emerald-100 p-2 mb-2">
                <LucideHospital className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="font-medium">{t('webDashboard.phcAdmin')}</h3>
              <p className="text-sm text-gray-500">{t('webDashboard.phcAdminDesc')}</p>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center lg:items-start">
              <div className="rounded-full bg-amber-100 p-2 mb-2">
                <LucideActivity className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="font-medium">{t('webDashboard.healthOfficer')}</h3>
              <p className="text-sm text-gray-500">{t('webDashboard.healthOfficerDesc')}</p>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <div className="order-1 lg:order-2">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-xl">{t('webDashboard.loginTitle')}</CardTitle>
              <CardDescription>
                {t('webDashboard.loginDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="password" onValueChange={(value) => setShowOtpLogin(value === "otp")}>
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger value="password">{t('webDashboard.passwordLogin')}</TabsTrigger>
                  <TabsTrigger value="otp">{t('webDashboard.otpLogin')}</TabsTrigger>
                </TabsList>

                <TabsContent value="password">
                  <form onSubmit={handlePasswordLogin}>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="select-role" className="block mb-2 text-sm font-medium">
                          {t('webDashboard.selectRole')}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['DOCTOR', 'HEALTH_WORKER', 'ADMIN'] as UserRole[]).map((userRole) => (
                            <Button
                              key={userRole}
                              type="button"
                              variant={role === userRole ? "default" : "outline"}
                              className="flex flex-col items-center justify-center py-3 h-auto"
                              onClick={() => setRole(userRole)}
                            >
                              {getRoleIcon(userRole)}
                              <span className="mt-1 text-xs">
                                {getRoleName(userRole)}
                              </span>
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="phone" className="block mb-2 text-sm font-medium">
                          {t('login.mobileNumber')}
                        </label>
                        <div className="flex">
                          <span className="inline-flex items-center px-3 text-sm border border-r-0 border-neutral-100 rounded-l-lg bg-neutral-50">
                            +91
                          </span>
                          <Input
                            type="tel"
                            id="phone"
                            className="rounded-r-lg"
                            placeholder="9876543210"
                            pattern="[0-9]{10}"
                            required
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.slice(0, 10))}
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="password" className="block mb-2 text-sm font-medium">
                          {t('webDashboard.password')}
                        </label>
                        <Input
                          type="password"
                          id="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>

                      <Button type="submit" className="w-full">
                        {t('webDashboard.login')}
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="otp">
                  {!requestOtpMutation.isSuccess ? (
                    <form onSubmit={handleOtpRequest}>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="select-role-otp" className="block mb-2 text-sm font-medium">
                            {t('webDashboard.selectRole')}
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['DOCTOR', 'HEALTH_WORKER', 'ADMIN'] as UserRole[]).map((userRole) => (
                              <Button
                                key={userRole}
                                type="button"
                                variant={role === userRole ? "default" : "outline"}
                                className="flex flex-col items-center justify-center py-3 h-auto"
                                onClick={() => setRole(userRole)}
                              >
                                {getRoleIcon(userRole)}
                                <span className="mt-1 text-xs">
                                  {getRoleName(userRole)}
                                </span>
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label htmlFor="phone-otp" className="block mb-2 text-sm font-medium">
                            {t('login.mobileNumber')}
                          </label>
                          <div className="flex">
                            <span className="inline-flex items-center px-3 text-sm border border-r-0 border-neutral-100 rounded-l-lg bg-neutral-50">
                              +91
                            </span>
                            <Input
                              type="tel"
                              id="phone-otp"
                              className="rounded-r-lg"
                              placeholder="9876543210"
                              pattern="[0-9]{10}"
                              required
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value.slice(0, 10))}
                            />
                          </div>
                        </div>

                        <Button type="submit" className="w-full">
                          {t('login.requestOtp')}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleOtpVerify}>
                      <div className="space-y-4">
                        <p className="text-center">
                          {t('login.enterOtp')} <span className="font-medium">+91 {phoneNumber}</span>
                        </p>
                        
                        <div>
                          <label htmlFor="otp" className="block mb-2 text-sm font-medium">
                            {t('login.otp')}
                          </label>
                          <Input
                            type="text"
                            id="otp"
                            placeholder="Enter 4-digit OTP"
                            required
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.slice(0, 4))}
                            maxLength={4}
                            className="text-center text-lg tracking-widest"
                          />
                        </div>
                        
                        <Button type="submit" className="w-full">
                          {t('login.verifyOtp')}
                        </Button>
                        
                        <div className="text-center">
                          <button
                            type="button"
                            className="text-sm text-primary hover:underline"
                            onClick={() => requestOtpMutation.reset()}
                          >
                            {t('webDashboard.changePhone')}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <div className="text-center w-full text-sm text-gray-500">
                {t('webDashboard.mobileAppLink')}
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate("/")}
              >
                {t('webDashboard.goToMobileApp')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}