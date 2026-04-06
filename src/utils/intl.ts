import i18next from "i18next";
import { useTranslation } from "react-i18next";

function generateHash(str: string): string {
  let h1 = 0x01234567 ^ 0x811c9dc5;
  let h2 = 0x89abcdef ^ 0x811c9dc5;

  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x1000193);

    h2 ^= c;
    h2 = Math.imul(h2, 0x1000193);
  }

  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");

  return hex1 + hex2;
}

const PLURAL_SEPARATOR = "||||";

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
    const id = generateHash(str);
    const options = args[0] as Record<string, string | number> | undefined;

    if (str.includes(PLURAL_SEPARATOR)) {
      return t(id, {
        defaultValue: str.split(PLURAL_SEPARATOR)[0].trim(),
        ...options,
      });
    }

    return t(id, { defaultValue: str, ...options });
  };
}

export const intl: IntlFn = createIntl(i18next.t.bind(i18next));

export function useIntl(): IntlFn {
  const { t } = useTranslation();
  return createIntl(t);
}
