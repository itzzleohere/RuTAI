import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/store/auth";
import { useLanguage } from "@/lib/i18n";
import OtpInput from "@/components/OtpInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LoadingOverlay from "@/components/LoadingOverlay";
import { ArrowLeft } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { login } = useAuth();
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState("");
  const [timeLeft, setTimeLeft] = useState(120);
  const [timerActive, setTimerActive] = useState(false);

  const requestOtpMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest("POST", "/api/auth/request-otp", { phone });
      return res.json();
    },
    onSuccess: () => {
      setShowOtpInput(true);
      startOtpTimer();
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
    mutationFn: async (data: { phone: string; otp: string }) => {
      const res = await apiRequest("POST", "/api/auth/verify-otp", data);
      return res.json();
    },
    onSuccess: (data) => {
      login(data.token, data.user);
      navigate("/");
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('login.otpVerifyFailed'),
        variant: "destructive",
      });
    },
  });

  const handleRequestOtp = (e: React.FormEvent) => {
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

  const handleVerifyOtp = () => {
    if (otp.length === 4) {
      verifyOtpMutation.mutate({ phone: phoneNumber, otp });
    } else {
      toast({
        title: t('common.error'),
        description: t('login.invalidOtp'),
        variant: "destructive",
      });
    }
  };

  const startOtpTimer = () => {
    setTimeLeft(120);
    setTimerActive(true);

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timer);
          setTimerActive(false);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  };

  const resendOtp = () => {
    requestOtpMutation.mutate(phoneNumber);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="p-4 pt-6 bg-white">
      {(requestOtpMutation.isPending || verifyOtpMutation.isPending) && (
        <LoadingOverlay message={requestOtpMutation.isPending ? t('login.sendingOtp') : t('login.verifyingOtp')} />
      )}

      <div className="flex justify-between items-center mb-8">
        <button 
          className="p-2 rounded-full hover:bg-neutral-100" 
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-medium">{t('login.title')}</h1>
        <div className="w-10"></div>
      </div>

      {!showOtpInput ? (
        <div className="mb-8">
          <p className="mb-6 text-center">{t('login.phonePrompt')}</p>
          <form id="phone-form" className="max-w-xs mx-auto" onSubmit={handleRequestOtp}>
            <div className="mb-4">
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
            <Button 
              type="submit" 
              className="w-full"
              disabled={phoneNumber.length !== 10}
            >
              {t('login.requestOtp')}
            </Button>
          </form>
        </div>
      ) : (
        <div id="otp-verification" className="max-w-xs mx-auto">
          <p className="mb-4 text-center">
            {t('login.enterOtp')} <span className="font-medium">+91 {phoneNumber}</span>
          </p>
          
          <OtpInput 
            value={otp}
            valueLength={4}
            onChange={setOtp}
          />
          
          <div className="flex justify-between items-center mb-4 mt-4">
            <button 
              className="text-primary text-sm hover:underline"
              onClick={resendOtp}
              disabled={timerActive}
            >
              {t('login.resendOtp')}
            </button>
            <span className="text-sm">{formatTime(timeLeft)}</span>
          </div>
          
          <Button 
            onClick={handleVerifyOtp} 
            className="w-full"
            disabled={otp.length !== 4}
          >
            {t('login.verifyOtp')}
          </Button>
        </div>
      )}
    </div>
  );
}
