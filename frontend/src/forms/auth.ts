/**
 * Auth Forms Manifest — bundled inline, no backend required.
 *
 * This is the TypeScript equivalent of backend/sample_forms/auth_forms.yaml.
 * Because the manifest is imported directly (not fetched), the sign-in and
 * sign-up pages render instantly regardless of backend availability.
 *
 * The submit handlers are wired in auth/page.tsx via the FormEngine's
 * `onSubmit` prop, so actual credential POSTing is decoupled from this file.
 */

import type { FormManifest } from "@form-engine/libs/types";

export const authManifest: FormManifest = {
  manifest_version: "4.0.0",
  manifest_id: "auth",
  forms: {
    signin: {
      form_id: "signin",
      title: "Sign in",
      version: "1.0.0",
      layout: { type: "single-page" },
      form_state: "active",
      submit_button: { label: "Sign in", loading_label: "Signing in\u2026" },
      pages: [
        {
          page_id: "main",
          sections: [
            {
              id: "credentials",
              fields: [
                {
                  id: "email",
                  type: "text",
                  display_as: "email",
                  label: "Email address",
                  required: true,
                  placeholder: "you@company.com",
                  autocomplete: "email",
                },
                {
                  id: "password",
                  type: "text",
                  display_as: "password",
                  label: "Password",
                  required: true,
                  placeholder: "\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7",
                  min_length: 6,
                  autocomplete: "current-password",
                },
              ],
            },
          ],
        },
      ],
    },
    signup: {
      form_id: "signup",
      title: "Create account",
      version: "1.0.0",
      layout: { type: "single-page" },
      form_state: "active",
      submit_button: { label: "Create account", loading_label: "Creating account\u2026" },
      pages: [
        {
          page_id: "main",
          sections: [
            {
              id: "identity",
              fields: [
                {
                  id: "full_name",
                  type: "text",
                  label: "Full name",
                  required: true,
                  placeholder: "Jane Smith",
                  width: "full",
                  autocomplete: "name",
                },
                {
                  id: "email",
                  type: "text",
                  display_as: "email",
                  label: "Email address",
                  required: true,
                  placeholder: "you@company.com",
                  width: "full",
                  autocomplete: "email",
                },
                {
                  id: "password",
                  type: "text",
                  display_as: "password",
                  label: "Password",
                  required: true,
                  placeholder: "\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7",
                  min_length: 8,
                  hint: "At least 8 characters",
                  autocomplete: "new-password",
                },
                {
                  id: "confirm_password",
                  type: "text",
                  display_as: "password",
                  label: "Confirm password",
                  required: true,
                  placeholder: "\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7",
                  autocomplete: "new-password",
                },
              ],
            },
          ],
        },
      ],
    },
  },
} as unknown as FormManifest;
