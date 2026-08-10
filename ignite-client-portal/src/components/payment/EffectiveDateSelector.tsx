import { useMemo } from 'react';
import { addMonths, format, isBefore, startOfDay, addDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EffectiveDateSelectorProps {
  onSelect: (date: Date) => void;
  selectedDate: Date | null;
  /** Only show options on or after this date (e.g. portal opens then). Omit or null = current date. */
  minDate?: string | Date | null;
  /** Max number of options to show (e.g. 1, 3, 6). Omit or null = 6. */
  optionCount?: number | null;
}

/**
 * Generates available billing dates (1st and 15th of each month)
 * for the next 3 months, with a 5-day buffer from today.
 * Optionally filters to dates on or after minDate and limits count.
 */
function getAvailableDates(minDate: Date | null, optionCount: number | null): Date[] {
  const today = startOfDay(new Date());
  const bufferDate = addDays(today, 5); // 5-day buffer
  const threeMonthsFromNow = addMonths(today, 3);
  // Default floor to today when not set (only show dates on or after current date)
  const floor = minDate ? startOfDay(minDate instanceof Date ? minDate : new Date(minDate)) : today;

  const dates: Date[] = [];

  let currentDate = new Date(today.getFullYear(), today.getMonth(), 1);

  for (let i = 0; i < 4; i++) {
    const month = addMonths(currentDate, i);

    const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    if (!isBefore(firstOfMonth, bufferDate) && isBefore(firstOfMonth, threeMonthsFromNow)) {
      if (!isBefore(firstOfMonth, floor)) dates.push(firstOfMonth);
    }

    const fifteenthOfMonth = new Date(month.getFullYear(), month.getMonth(), 15);
    if (!isBefore(fifteenthOfMonth, bufferDate) && isBefore(fifteenthOfMonth, threeMonthsFromNow)) {
      if (!isBefore(fifteenthOfMonth, floor)) dates.push(fifteenthOfMonth);
    }
  }

  const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
  const count = optionCount ?? 6; // default 6 when not set; 0 = show all
  return count > 0 ? sorted.slice(0, count) : sorted;
}

export function EffectiveDateSelector({ onSelect, selectedDate, minDate, optionCount }: EffectiveDateSelectorProps) {
  const availableDates = useMemo(
    () => getAvailableDates(
      minDate != null ? (typeof minDate === 'string' ? new Date(minDate) : minDate) : null,
      optionCount ?? null
    ),
    [minDate, optionCount]
  );

  const formatDateOption = (date: Date) => {
    const dayOfMonth = date.getDate();
    const monthYear = format(date, 'MMMM yyyy');
    const dayLabel = dayOfMonth === 1 ? '1st' : '15th';
    
    return {
      full: `${dayLabel} of ${monthYear}`,
      short: format(date, 'MMM d, yyyy'),
      dayLabel,
      monthYear,
    };
  };

  const isSelected = (date: Date) => {
    return selectedDate?.getTime() === date.getTime();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-primary" />
          Select Your Effective Date
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose when your monthly subscription should begin. Any one-time fees will be charged today.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {availableDates.map((date) => {
            const formatted = formatDateOption(date);
            const selected = isSelected(date);
            
            return (
              <Button
                key={date.toISOString()}
                type="button"
                variant={selected ? 'default' : 'outline'}
                className={cn(
                  'h-auto py-3 px-4 flex flex-col items-center gap-1 relative',
                  selected && 'ring-2 ring-primary ring-offset-2'
                )}
                onClick={() => onSelect(date)}
              >
                {selected && (
                  <CheckCircle2 className="absolute top-2 right-2 h-4 w-4" />
                )}
                <span className="text-lg font-semibold">{formatted.dayLabel}</span>
                <span className="text-xs opacity-80">{formatted.monthYear}</span>
              </Button>
            );
          })}
        </div>
        
        {selectedDate && (
          <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm">
              <span className="text-muted-foreground">Subscription starts: </span>
              <span className="font-medium">{format(selectedDate, 'MMMM d, yyyy')}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Your first monthly charge will occur on this date
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
