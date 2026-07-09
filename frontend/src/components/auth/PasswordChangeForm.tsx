"use client";

import React, { useState } from "react";
import { sileo } from "sileo";

interface Props {
  onDone: () => void;
}

export default function PasswordChangeForm({ onDone }: Props) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      sileo.error({ title: "Passwords don't match", description: "Make sure both passwords are identical" });
      return;
    }
    if (newPassword.length < 6) {
      sileo.error({ title: "Password too short", description: "Minimum 6 characters" });
      return;
    }

    try {
      const res = await fetch("/api/auth/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        sileo.error({ title: "Could not update password", description: data.detail || "Check your current password and try again" });
        return;
      }
      sileo.success({ title: "Password changed", description: "Use your new password next time you sign in" });
      onDone();
    } catch {
      sileo.error({ title: "Something went wrong", description: "Please try again later" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Current password</label>
        <input
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          required
          className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-on-surface-variant mb-1.5">New password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
          className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Confirm new password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onDone}
          className="px-5 py-2.5 rounded-full border border-outline-variant text-on-surface hover:bg-surface-high transition-colors font-medium text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-5 py-2.5 rounded-full bg-on-surface text-surface hover:opacity-90 transition-opacity font-medium text-sm"
        >
          Save
        </button>
      </div>
    </form>
  );
}
