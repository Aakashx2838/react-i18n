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

export const intl = i18next.t.bind(i18next) as IntlFn;

export function useIntl(): IntlFn {
  useTranslation(); // subscribe to language changes for re-renders
  return intl;
}
