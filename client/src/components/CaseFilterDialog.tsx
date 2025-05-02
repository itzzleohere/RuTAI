import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/i18n';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { User } from '@shared/types';

export interface FilterOptions {
  statusFilter: string;
  assignmentFilter: string;
  reviewFilter: string;
  healthWorkerFilter: string;
  dateFromFilter: Date | undefined;
  dateToFilter: Date | undefined;
}

interface CaseFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterOptions) => void;
  currentFilters: FilterOptions;
}

export default function CaseFilterDialog({
  isOpen,
  onClose,
  onApplyFilters,
  currentFilters
}: CaseFilterDialogProps) {
  const { t } = useLanguage();
  
  // Local state for filters
  const [statusFilter, setStatusFilter] = useState<string>(currentFilters.statusFilter || "all_statuses");
  const [assignmentFilter, setAssignmentFilter] = useState<string>(currentFilters.assignmentFilter || "all_assignments");
  const [reviewFilter, setReviewFilter] = useState<string>(currentFilters.reviewFilter || "all_reviews");
  const [healthWorkerFilter, setHealthWorkerFilter] = useState<string>(currentFilters.healthWorkerFilter || "all_health_workers");
  const [dateFromFilter, setDateFromFilter] = useState<Date | undefined>(currentFilters.dateFromFilter);
  const [dateToFilter, setDateToFilter] = useState<Date | undefined>(currentFilters.dateToFilter);

  // Update local state when props change
  useEffect(() => {
    setStatusFilter(currentFilters.statusFilter || "all_statuses");
    setAssignmentFilter(currentFilters.assignmentFilter || "all_assignments");
    setReviewFilter(currentFilters.reviewFilter || "all_reviews");
    setHealthWorkerFilter(currentFilters.healthWorkerFilter || "all_health_workers");
    setDateFromFilter(currentFilters.dateFromFilter);
    setDateToFilter(currentFilters.dateToFilter);
  }, [currentFilters, isOpen]);

  // Fetch health workers for the dropdown
  const { data: healthWorkers } = useQuery<User[]>({
    queryKey: ['/api/health-workers'],
    enabled: isOpen, // Only fetch when dialog is open
  });

  const handleApplyFilters = () => {
    onApplyFilters({
      statusFilter,
      assignmentFilter,
      reviewFilter,
      healthWorkerFilter,
      dateFromFilter,
      dateToFilter
    });
    onClose();
  };

  const handleResetFilters = () => {
    setStatusFilter("all_statuses");
    setAssignmentFilter("all_assignments");
    setReviewFilter("all_reviews");
    setHealthWorkerFilter("all_health_workers");
    setDateFromFilter(undefined);
    setDateToFilter(undefined);
    
    onApplyFilters({
      statusFilter: "all_statuses",
      assignmentFilter: "all_assignments",
      reviewFilter: "all_reviews",
      healthWorkerFilter: "all_health_workers",
      dateFromFilter: undefined,
      dateToFilter: undefined
    });
    onClose();
  };

  // Helper for formatted date display
  const formatDisplayDate = (date: Date | undefined) => {
    if (!date) return "";
    return format(date, "PP");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('webDashboard.filterTitle')}</DialogTitle>
        </DialogHeader>
        
        <Accordion type="single" collapsible className="w-full" defaultValue="status">
          {/* Status Filter */}
          <AccordionItem value="status">
            <AccordionTrigger>{t('webDashboard.filterByStatus')}</AccordionTrigger>
            <AccordionContent>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('webDashboard.allStatuses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_statuses">{t('webDashboard.allStatuses')}</SelectItem>
                  <SelectItem value="PENDING">{t('webDashboard.pending')}</SelectItem>
                  <SelectItem value="STABLE">{t('webDashboard.stable')}</SelectItem>
                  <SelectItem value="NEEDS_ATTENTION">{t('webDashboard.needsAttention')}</SelectItem>
                  <SelectItem value="CRITICAL">{t('webDashboard.critical')}</SelectItem>
                  <SelectItem value="CLOSED">{t('webDashboard.closed')}</SelectItem>
                </SelectContent>
              </Select>
            </AccordionContent>
          </AccordionItem>
          
          {/* Assignment Filter */}
          <AccordionItem value="assignment">
            <AccordionTrigger>{t('webDashboard.filterByAssignment')}</AccordionTrigger>
            <AccordionContent>
              <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('webDashboard.allAssignments')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_assignments">{t('webDashboard.allAssignments')}</SelectItem>
                  <SelectItem value="assigned">{t('webDashboard.assigned')}</SelectItem>
                  <SelectItem value="unassigned">{t('webDashboard.unassigned')}</SelectItem>
                </SelectContent>
              </Select>
            </AccordionContent>
          </AccordionItem>
          
          {/* Review Status Filter */}
          <AccordionItem value="review">
            <AccordionTrigger>{t('webDashboard.filterByReviewStatus')}</AccordionTrigger>
            <AccordionContent>
              <Select value={reviewFilter} onValueChange={setReviewFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('webDashboard.allAssignments')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_reviews">{t('webDashboard.allAssignments')}</SelectItem>
                  <SelectItem value="reviewed">{t('webDashboard.reviewed')}</SelectItem>
                  <SelectItem value="not_reviewed">{t('webDashboard.notReviewed')}</SelectItem>
                </SelectContent>
              </Select>
            </AccordionContent>
          </AccordionItem>
          
          {/* Health Worker Filter */}
          <AccordionItem value="health_worker">
            <AccordionTrigger>{t('webDashboard.filterByHealthWorker')}</AccordionTrigger>
            <AccordionContent>
              <Select value={healthWorkerFilter} onValueChange={setHealthWorkerFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('webDashboard.allHealthWorkers')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_health_workers">{t('webDashboard.allHealthWorkers')}</SelectItem>
                  {healthWorkers?.map(worker => (
                    <SelectItem key={worker.id} value={worker.id.toString()}>
                      {worker.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AccordionContent>
          </AccordionItem>
          
          {/* Date Range Filter */}
          <AccordionItem value="date_range">
            <AccordionTrigger>{t('webDashboard.filterByDate')}</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col space-y-4">
                <div className="flex flex-col space-y-2">
                  <Label>{t('webDashboard.filterDateFrom')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateFromFilter && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFromFilter ? formatDisplayDate(dateFromFilter) : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateFromFilter}
                        onSelect={setDateFromFilter}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="flex flex-col space-y-2">
                  <Label>{t('webDashboard.filterDateTo')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateToFilter && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateToFilter ? formatDisplayDate(dateToFilter) : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateToFilter}
                        onSelect={setDateToFilter}
                        disabled={(date) => 
                          dateFromFilter ? date < dateFromFilter : false
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-6">
          <Button variant="ghost" onClick={handleResetFilters} className="w-full sm:w-auto">
            {t('webDashboard.filterReset')}
          </Button>
          <Button onClick={handleApplyFilters} className="w-full sm:w-auto">
            {t('webDashboard.filterApply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}