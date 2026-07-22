'use client';

import { useEffect, useState } from 'react';
import type { Customer, CustomerStatus, KycStatus } from '@/types';
import type { CustomerInput } from '@/store/use-bank-store';
import {
  compose,
  email as emailRule,
  minimumAge,
  phone as phoneRule,
  required,
  validate,
  type ValidationErrors,
} from '@/lib/utils/validation';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

const STATUS_OPTIONS: Array<{ value: CustomerStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'blocked', label: 'Blocked' },
];

const KYC_OPTIONS: Array<{ value: KycStatus; label: string }> = [
  { value: 'verified', label: 'Verified' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
];

const EMPTY: CustomerInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  addressLine: '',
  city: '',
  country: '',
  dateOfBirth: '',
  status: 'active',
  kycStatus: 'pending',
};

export interface CustomerFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CustomerInput) => void;
  /** Present when editing; absent when creating. */
  customer?: Customer | null;
  /** Emails already taken, used to block duplicates. */
  existingEmails: string[];
}

export function CustomerForm({
  open,
  onClose,
  onSubmit,
  customer,
  existingEmails,
}: CustomerFormProps) {
  const [values, setValues] = useState<CustomerInput>(EMPTY);
  const [errors, setErrors] = useState<ValidationErrors<CustomerInput>>({});
  const [submitting, setSubmitting] = useState(false);

  // Reset the form whenever the dialog opens, so a cancelled edit doesn't
  // leak its values into the next one.
  useEffect(() => {
    if (!open) return;

    if (customer) {
      setValues({
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        addressLine: customer.addressLine,
        city: customer.city,
        country: customer.country,
        // <input type="date"> needs a bare YYYY-MM-DD value.
        dateOfBirth: customer.dateOfBirth.slice(0, 10),
        status: customer.status,
        kycStatus: customer.kycStatus,
      });
    } else {
      setValues(EMPTY);
    }
    setErrors({});
  }, [open, customer]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors = validate(values, {
      firstName: required('First name'),
      lastName: required('Last name'),
      email: compose(required('Email'), emailRule(), (value) => {
        const normalised = value.trim().toLowerCase();
        // Editing a customer must not collide with their own address.
        const taken = existingEmails.some(
          (existing) => existing.toLowerCase() === normalised && existing !== customer?.email,
        );
        return taken ? 'A customer with this email already exists' : null;
      }),
      phone: compose(required('Phone'), phoneRule()),
      addressLine: required('Address'),
      city: required('City'),
      country: required('Country'),
      dateOfBirth: compose(required('Date of birth'), minimumAge(18)),
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    onSubmit({
      ...values,
      email: values.email.trim().toLowerCase(),
      // Normalise to a full ISO timestamp for storage.
      dateOfBirth: new Date(values.dateOfBirth).toISOString(),
    });
    setSubmitting(false);
  };

  const set = <K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? 'Edit customer' : 'New customer'}
      description={
        customer
          ? 'Update this customer’s personal and compliance details.'
          : 'Create a customer record. Accounts can be opened once the record exists.'
      }
      size="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={submitting}>
            {customer ? 'Save changes' : 'Create customer'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            value={values.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            error={errors.firstName}
            required
          />
          <Input
            label="Last name"
            value={values.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            error={errors.lastName}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Email"
            type="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            error={errors.email}
            required
          />
          <Input
            label="Phone"
            type="tel"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            error={errors.phone}
            placeholder="+44 20 7123 4567"
            required
          />
        </div>

        <Input
          label="Address"
          value={values.addressLine}
          onChange={(e) => set('addressLine', e.target.value)}
          error={errors.addressLine}
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="City"
            value={values.city}
            onChange={(e) => set('city', e.target.value)}
            error={errors.city}
            required
          />
          <Input
            label="Country"
            value={values.country}
            onChange={(e) => set('country', e.target.value)}
            error={errors.country}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Date of birth"
            type="date"
            value={values.dateOfBirth}
            onChange={(e) => set('dateOfBirth', e.target.value)}
            error={errors.dateOfBirth}
            required
          />
          <Select
            label="Status"
            value={values.status}
            onChange={(e) => set('status', e.target.value as CustomerStatus)}
            options={STATUS_OPTIONS}
          />
          <Select
            label="KYC status"
            value={values.kycStatus}
            onChange={(e) => set('kycStatus', e.target.value as KycStatus)}
            options={KYC_OPTIONS}
          />
        </div>

        {/* Enables Enter-to-submit without a visible duplicate button. */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
