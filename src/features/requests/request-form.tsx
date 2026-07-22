'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RequestPriority, RequestType, Customer, Staff } from '@/types';
import type { RequestInput } from '@/store/use-bank-store';
import { fullName } from '@/lib/utils/format';
import { required, validate, type ValidationErrors } from '@/lib/utils/validation';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

const TYPE_OPTIONS: Array<{ value: RequestType; label: string }> = [
  { value: 'new-account', label: 'New account' },
  { value: 'card-issue', label: 'Card issue' },
  { value: 'loan-application', label: 'Loan application' },
  { value: 'cheque-book', label: 'Cheque book' },
  { value: 'dispute', label: 'Dispute' },
  { value: 'account-closure', label: 'Account closure' },
];

const PRIORITY_OPTIONS: Array<{ value: RequestPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

/** Sensible default subjects, matching the seeded request wording. */
const DEFAULT_SUBJECTS: Record<RequestType, string> = {
  'new-account': 'Open a new savings account',
  'card-issue': 'Debit card not working',
  'loan-application': 'Personal loan application',
  'cheque-book': 'Request new cheque book',
  dispute: 'Dispute unrecognised transaction',
  'account-closure': 'Close dormant account',
};

interface FormState {
  customerId: string;
  type: RequestType;
  priority: RequestPriority;
  subject: string;
  details: string;
  assignedStaffId: string;
}

export function RequestForm({
  open,
  onClose,
  onSubmit,
  customers,
  staff,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: RequestInput) => void;
  customers: Customer[];
  staff: Staff[];
}) {
  const [values, setValues] = useState<FormState>({
    customerId: '',
    type: 'new-account',
    priority: 'normal',
    subject: DEFAULT_SUBJECTS['new-account'],
    details: '',
    assignedStaffId: '',
  });
  const [errors, setErrors] = useState<ValidationErrors<FormState>>({});

  // Suspended or on-leave staff shouldn't be assignable.
  const assignable = useMemo(() => staff.filter((s) => s.status === 'active'), [staff]);

  useEffect(() => {
    if (!open) return;

    setValues({
      customerId: customers[0]?.id ?? '',
      type: 'new-account',
      priority: 'normal',
      subject: DEFAULT_SUBJECTS['new-account'],
      details: '',
      assignedStaffId: '',
    });
    setErrors({});
  }, [open, customers]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors = validate(values, {
      customerId: required('Customer'),
      subject: required('Subject'),
      details: required('Details'),
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      customerId: values.customerId,
      type: values.type,
      priority: values.priority,
      subject: values.subject.trim(),
      details: values.details.trim(),
      // An empty select value means "leave in the unassigned pool".
      assignedStaffId: values.assignedStaffId || null,
    });
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  /** Changing type swaps in that type's default subject, unless edited. */
  const handleTypeChange = (nextType: RequestType) => {
    setValues((v) => ({
      ...v,
      type: nextType,
      subject: Object.values(DEFAULT_SUBJECTS).includes(v.subject)
        ? DEFAULT_SUBJECTS[nextType]
        : v.subject,
    }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log a service request"
      description="Requests enter the queue and are worked by priority, then age."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={customers.length === 0}>
            Log request
          </Button>
        </>
      }
    >
      {customers.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-text">
          Create a customer before logging a request.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Select
            label="Customer"
            value={values.customerId}
            onChange={(e) => set('customerId', e.target.value)}
            error={errors.customerId}
            options={customers.map((c) => ({
              value: c.id,
              label: `${fullName(c)} · ${c.customerCode}`,
            }))}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Request type"
              value={values.type}
              onChange={(e) => handleTypeChange(e.target.value as RequestType)}
              options={TYPE_OPTIONS}
            />
            <Select
              label="Priority"
              value={values.priority}
              onChange={(e) => set('priority', e.target.value as RequestPriority)}
              options={PRIORITY_OPTIONS}
            />
          </div>

          <Input
            label="Subject"
            value={values.subject}
            onChange={(e) => set('subject', e.target.value)}
            error={errors.subject}
            required
          />

          <Textarea
            label="Details"
            value={values.details}
            onChange={(e) => set('details', e.target.value)}
            error={errors.details}
            rows={4}
            placeholder="Describe what the customer has asked for and any supporting context."
            required
          />

          <Select
            label="Assign to"
            value={values.assignedStaffId}
            onChange={(e) => set('assignedStaffId', e.target.value)}
            options={[
              { value: '', label: 'Leave unassigned' },
              ...assignable.map((s) => ({
                value: s.id,
                label: `${fullName(s)} · ${s.branch}`,
              })),
            ]}
            hint="Unassigned requests stay in the shared pool."
          />

          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </Modal>
  );
}
