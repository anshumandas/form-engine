/**
 * @form-engine/react — library entry point
 *
 * Quick start:
 *   npm install @form-engine/react
 *
 *   import { FormEngine, FormEngineProvider } from '@form-engine/react';
 *
 *   <FormEngineProvider config={{ apiBase: "https://my-api.example.com" }}>
 *     <FormEngine manifest={manifest} formId="onboarding" onSubmit={handleSubmit} />
 *   </FormEngineProvider>
 */
export { FormEngine, FieldRouter }         from "./components/FormEngine";
export { SafeFormEngine }                  from "./components/FormEngine/safe";
export { FormErrorBoundary }               from "./components/FormEngine/FormErrorBoundary";
export { FormEngineProvider }              from "./components/FormEngineProvider";
export {
  configureFormEngine,
  getConfig,
  resolveApiUrl,
  useFormEngineConfig,
  FormEngineContext,
}                                          from "./libs/config";
export { useFormEngine, useFormEngineInit } from "./hooks/useFormEngine";
export { useFormEngineStore }              from "./store/form-engine-store";
export { loadManifest }                    from "./libs/manifest-loader";
export { evaluateCondition, evaluateComputed, validateField } from "./libs/condition-evaluator";
export { cn, formatDate, debounce }        from "./libs/utils";
export { api, categoryApi, type CategorySummary } from "../../frontend/src/libs/api";
export type {
  FormManifest, FormDef, FormLayout, FormField, FieldBase,
  TextField, MultilineField, RichTextField, BooleanField, NumberField,
  SelectField, MultiselectField, DateField, TimeField, DateTimeField,
  DateRangeField, FileField, RatingField, ColorField, JsonField,
  SignatureField, LocationField, HiddenField, BoundField,
  Page, Section, Collection, SubmitAction, SubmitButtonConfig,
  ConditionOrRef, SimpleCondition, CompositeCondition, ExpressionCondition,
  ConditionRef, NamedCondition, StaticChoice, DynamicChoicesConfig,
  DynamicChoicesWrapper, StaticChoicesWrapper, SourceRefConfig, ChoiceSource,
  FieldAnswers, FormErrors, FormContext,
  FormState, ConfidentialityType, NumberType, AccessLevel, RoleCategory, LayoutType,
} from "./libs/types";
export type { FormEngineConfig, FormEngineAuthConfig } from "./libs/config";
