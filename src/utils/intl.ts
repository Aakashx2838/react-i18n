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

function createIntl(t: typeof i18next.t): IntlFn {
  return <S extends string>(
    str: S,
    ...args: NeedsOptions<S> extends true ? [options: IntlOptions<S>] : []
  ): string => {
    const options = args[0] as Record<string, string | number> | undefined;
    return t(str, { ...options });
  };
}

export const intl: IntlFn = createIntl(i18next.t.bind(i18next));

export function useIntl(): IntlFn {
  const { t } = useTranslation();
  return createIntl(t);
}
