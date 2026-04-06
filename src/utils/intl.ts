import i18next from "i18next";
import { useTranslation } from "react-i18next";

type ExtractVars<S extends string> =
  S extends `${string}{{${infer Var}}}${infer Rest}`
    ? Var | ExtractVars<Rest>
    : never;

type HasPlural<S extends string> = S extends `${string}||||${string}`
  ? true
  : false;

type VarType<K extends string, Plural extends boolean> = Plural extends true
  ? K extends "count"
    ? number
    : string | number
  : string | number;

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type IntlOptions<S extends string> = Prettify<
  HasPlural<S> extends true
    ? { [K in ExtractVars<S>]: VarType<K, true> } & { count: number }
    : { [K in ExtractVars<S>]: string | number }
>;

type NeedsOptions<S extends string> = [ExtractVars<S>] extends [never]
  ? HasPlural<S> extends true
    ? true
    : false
  : true;

type IntlFn = <S extends string>(
  str: S,
  ...args: NeedsOptions<S> extends true ? [options: IntlOptions<S>] : []
) => string;

// ─── Fast path: bypass i18next's resolver/interpolator pipeline ───

const interpolateRe = /\{\{(\w+)\}\}/g;

let _cachedLng = "";
let _cachedTranslations: Record<string, string> = {};
const _pluralRulesCache = new Map<string, Intl.PluralRules>();

function getTranslations(): Record<string, string> {
  const lng = i18next.language;
  if (lng !== _cachedLng) {
    _cachedLng = lng;
    _cachedTranslations =
      (i18next.store?.data[lng]?.translation as Record<string, string>) ?? {};
  }
  return _cachedTranslations;
}

function getPluralSuffix(lng: string, count: number): string {
  let rules = _pluralRulesCache.get(lng);
  if (!rules) {
    rules = new Intl.PluralRules(lng);
    _pluralRulesCache.set(lng, rules);
  }
  return rules.select(count);
}

export const intl = ((
  key: string,
  options?: Record<string, string | number>,
) => {
  const t = getTranslations();

  if (options === undefined) {
    return t[key] ?? key;
  }

  let template: string | undefined;
  if ("count" in options) {
    const suffix = getPluralSuffix(i18next.language, options.count as number);
    template = t[`${key}_${suffix}`];
  }
  template ??= t[key] ?? key;

  return template.replace(interpolateRe, (_, k) =>
    String(options[k as keyof typeof options] ?? ""),
  );
}) as IntlFn;

export function useIntl(): IntlFn {
  useTranslation(); // subscribe to language changes for re-renders
  return intl;
}
