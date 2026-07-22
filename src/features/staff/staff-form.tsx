'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { Role, Staff, StaffStatus } from '@/types';
import type { StaffInput } from '@/store/use-bank-store';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, canManageStaffOfRole } from '@/lib/auth/permissions';
import {
  compose,
  email as emailRule,
  phone as phoneRule,
  required,
  validate,
  type ValidationErrors,
} from '@/lib/utils/validation';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

const BRANCHES = [
  'Central HQ',
  'Northgate',
  'Harbour Point',
  'Westfield',
  'Riverside',
  'Airport City',
];

const STATUS_OPTIONS: Array<{ value: StaffStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'on-leave', label: 'On leave' },
  { value: 'suspended', label: 'Suspended' },
];

const EMPTY: StaffInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'teller',
  branch: BRANCHES[0],
  status: 'active',
};

export function StaffForm({
  open,
  onClose,
  onSubmit,
  member,
  existingEmails,
  actorRole,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: StaffInput) => void;
  member?: Staff | null;
  existingEmails: string[];
  /** The signed-in user's role, used to limit assignable roles. */
  actorRole: Role | undefined;
}) {
  const [values, setValues] = useState<StaffInput>(EMPTY);
  const [errors, setErrors] = useState<ValidationErrors<StaffInput>>({});

  useEffect(() => {
    if (!open) return;

    if (member) {
      setValues({
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        phone: member.phone,
        role: member.role,
        branch: member.branch,
        status: member.status,
      });
    } else {
      setValues(EMPTY);
    }
    setErrors({});
  }, [open, member]);

  /**
   * A user can only grant roles strictly below their own, so a manager can
   * never mint another admin.
   */
  const assignableRoles = (['auditor', 'teller', 'manager', 'admin'] as Role[]).filter((role) =>
    canManageStaffOfRole(actorRole, role),
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors = validate(values, {
      firstName: required('First name'),
      lastName: required('Last name'),
      email: compose(required('Email'), emailRule(), (value) => {
        const normalised = value.trim().toLowerCase();
        const taken = existingEmails.some(
          (existing) => existing.toLowerCase() === normalised && existing !== member?.email,
        );
        return taken ? 'A staff member with this email already exists' : null;
      }),
      phone: compose(required('Phone'), phoneRule()),
      branch: required('Branch'),
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({ ...values, email: values.email.trim().toLowerCase() });
  };

  const set = <K extends keyof StaffInput>(key: K, value: StaffInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? 'Edit staff member' : 'Add staff member'}
      description={
        member
          ? 'Update this employee’s role, branch and contact details.'
          : 'Create an employee record and assign their access level.'
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit}>
            {member ? 'Save changes' : 'Add staff member'}
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
            label="Work email"
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
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Branch"
            value={values.branch}
            onChange={(e) => set('branch', e.target.value)}
            error={errors.branch}
            options={BRANCHES.map((branch) => ({ value: branch, label: branch }))}
          />
          <Select
            label="Status"
            value={values.status}
            onChange={(e) => set('status', e.target.value as StaffStatus)}
            options={STATUS_OPTIONS}
          />
        </div>

        {assignableRoles.length > 0 ? (
          <div>
            <Select
              label="Role"
              value={values.role}
              onChange={(e) => set('role', e.target.value as Role)}
              options={assignableRoles.map((role) => ({
                value: role,
                label: ROLE_LABELS[role],
              }))}
              hint={ROLE_DESCRIPTIONS[values.role]}
            />
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            You cannot assign roles at or above your own access level.
          </div>
        )}

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
