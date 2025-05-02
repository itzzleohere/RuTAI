import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import Header from "@/components/Header";
import LoadingOverlay from "@/components/LoadingOverlay";
import { caseFormSchema } from "@shared/types";
import { queryClient } from "@/lib/queryClient";

export default function NewCase() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const form = useForm({
    resolver: zodResolver(caseFormSchema),
    defaultValues: {
      patientName: "",
      age: "",
      gender: "",
      contactNumber: "",
      temperature: "",
      pulse: "",
      bpSystolic: "",
      bpDiastolic: "",
      respiratoryRate: "",
      oxygenSaturation: "",
      chiefComplaint: "",
      symptoms: {
        fever: false,
        cough: false,
        headache: false,
        pain: false,
        shortnessOfBreath: false,
        vomiting: false,
      },
      symptomDescription: "",
      additionalNotes: "",
    },
  });

  const analyzeCase = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cases", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      navigate(`/case/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('newCase.analysisFailed'),
        variant: "destructive",
      });
    },
  });

  const saveDraft = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cases/draft", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: t('newCase.draftSaved'),
        description: t('newCase.draftSavedDesc'),
      });
      navigate("/");
    },
    onError: (error) => {
      // If offline, save to localStorage
      if (!navigator.onLine) {
        localStorage.setItem('case_draft', JSON.stringify(form.getValues()));
        toast({
          title: t('newCase.offlineDraftSaved'),
          description: t('newCase.offlineDraftSavedDesc'),
        });
        navigate("/");
      } else {
        toast({
          title: t('common.error'),
          description: error.message || t('newCase.draftSaveFailed'),
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: any) => {
    analyzeCase.mutate(data);
  };

  const handleSaveDraft = () => {
    saveDraft.mutate(form.getValues());
  };

  // Check for offline status
  useState(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });

  return (
    <>
      <Header 
        title={t('newCase.title')} 
        showBackButton 
        onBackClick={() => navigate("/")}
      />

      {(analyzeCase.isPending || saveDraft.isPending) && (
        <LoadingOverlay message={t('newCase.analyzing')} />
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 pb-8">
          <div className="space-y-6">
            {/* Patient Information Section */}
            <div>
              <h2 className="text-lg font-medium mb-3">{t('newCase.patientInfo')}</h2>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="patientName"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>{t('newCase.patientName')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('newCase.age')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('newCase.gender')}</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('newCase.selectGender')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="M">{t('newCase.male')}</SelectItem>
                          <SelectItem value="F">{t('newCase.female')}</SelectItem>
                          <SelectItem value="O">{t('newCase.other')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>{t('newCase.contactNumber')}</FormLabel>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 text-sm border border-r-0 border-neutral-100 rounded-l-lg bg-neutral-50">
                          +91
                        </span>
                        <Input 
                          className="rounded-l-none" 
                          type="tel" 
                          {...field} 
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                            field.onChange(value);
                          }}
                        />
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Vital Signs Section */}
            <div>
              <h2 className="text-lg font-medium mb-3">{t('newCase.vitalSigns')}</h2>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('newCase.temperature')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1" 
                          placeholder="98.6" 
                          {...field} 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pulse"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('newCase.pulse')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="72" 
                          {...field} 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bpSystolic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('newCase.bpSystolic')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="120" 
                          {...field} 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bpDiastolic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('newCase.bpDiastolic')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="80" 
                          {...field} 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="respiratoryRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('newCase.respiratoryRate')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="16" 
                          {...field} 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="oxygenSaturation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('newCase.oxygenSaturation')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="98" 
                          {...field} 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Symptoms Section */}
            <div>
              <h2 className="text-lg font-medium mb-3">{t('newCase.symptoms')}</h2>
              
              <FormField
                control={form.control}
                name="chiefComplaint"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>{t('newCase.chiefComplaint')}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t('newCase.mainSymptom')} 
                        {...field} 
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="mb-4">
                <FormLabel>{t('newCase.commonSymptoms')}</FormLabel>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    { name: "symptoms.fever", label: t('symptoms.fever') },
                    { name: "symptoms.cough", label: t('symptoms.cough') },
                    { name: "symptoms.headache", label: t('symptoms.headache') },
                    { name: "symptoms.pain", label: t('symptoms.pain') },
                    { name: "symptoms.shortnessOfBreath", label: t('symptoms.shortnessOfBreath') },
                    { name: "symptoms.vomiting", label: t('symptoms.vomiting') },
                  ].map((symptom) => (
                    <FormField
                      key={symptom.name}
                      control={form.control}
                      name={symptom.name as any}
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">
                            {symptom.label}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              <FormField
                control={form.control}
                name="symptomDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('newCase.symptomDescription')}</FormLabel>
                    <FormControl>
                      <Textarea 
                        rows={3}
                        placeholder={t('newCase.describeSymptoms')}
                        {...field} 
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Additional Notes Section */}
            <FormField
              control={form.control}
              name="additionalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('newCase.additionalNotes')}</FormLabel>
                  <FormControl>
                    <Textarea 
                      rows={2}
                      placeholder={t('newCase.additionalNotesPlaceholder')}
                      {...field} 
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="mt-8 space-y-4">
            <Button 
              type="submit" 
              className="w-full"
              disabled={analyzeCase.isPending || isOffline}
            >
              {t('newCase.analyzeAndClassify')}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="w-full"
              onClick={handleSaveDraft}
            >
              {t('newCase.saveAsDraft')}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
